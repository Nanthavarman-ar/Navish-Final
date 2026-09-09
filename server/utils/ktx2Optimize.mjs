// Server-side (Node) KTX2 re-encode of an already-uploaded model's textures - the piece
// that couldn't run client-side. See components/utils/modelOptimizer.ts's own comment for
// the full history: KTX2 was tried twice before, both in the browser (gltf-transform/cli's
// own toKTX2 needs to shell out to a native `ktx`/`toktx` binary via child_process, which a
// browser tab can't do at all; the browser-WASM fallback tried instead, `ktx2-encoder`,
// produced missing/black textures and took ~4 minutes on a 32MB model). Neither problem
// exists here: this runs in a real Node process (Railway), so the real native encoder
// (KTX-Software's `ktx` CLI, ≥4.4.0 - see the Dockerfile for how it gets installed) is
// actually usable.
//
// Deliberately NOT a replacement for the existing client-side pipeline
// (components/utils/modelOptimizer.ts: weld/dedup/prune/simplify/meshopt + WebP textures,
// run at upload time, blocking nothing). This module only ever runs AFTER a model is
// already live on WebP - see server.js's /optimize-ktx2 route and server/index.tsx's
// queue-ktx2-optimize/ktx2-ready endpoints for the full async, best-effort flow. A failure
// anywhere in here should never be able to take down an already-working model.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer/decoder';
import { MeshoptEncoder } from 'meshoptimizer/encoder';
import sharp from 'sharp';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

// @gltf-transform/cli cannot be `import`ed normally: confirmed directly (not assumed) by
// running `node -e "import('@gltf-transform/cli')"` in this project - it throws
// `TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received
// undefined` from inside its own top-level module code (@donmccurdy/caporal's `Program`
// constructor calls `path.basename(process.argv[1])`, which is undefined here since this
// is a real Node server process, not a CLI invocation with a script path in argv[1]).
// Despite exporting `toktx` as a genuinely composable function from its public API, the
// package isn't actually safe to import as a library as-is.
//
// Reimplementing toktx()'s CLI-flag logic by hand was the alternative considered - rejected
// because that logic is real and non-trivial (per-slot UASTC/ETC1S option handling, sRGB
// vs. linear color space -> --assign-tf/--assign-primaries, channel-mask -> --format,
// thread count), and getting a subtle detail wrong with no way to test it locally (this
// dev environment has no Docker/native `ktx` binary either) risks a worse, quieter bug than
// the one this whole server-side move exists to fix. Temporarily setting process.argv[1] to
// a dummy value works around the crash (confirmed directly the same way) without touching
// any of that logic - done here, once, lazily on first use, and restored immediately
// after, specifically so the mutation window is a single import (ESM modules are cached
// after their first import - every later call reuses the same cached module instance, this
// shim never runs again for the life of the process) rather than something that could ever
// interleave with something else on this server reading process.argv[1] during a real job.
let gltfTransformCliPromise = null;
function getGltfTransformCli() {
  if (!gltfTransformCliPromise) {
    gltfTransformCliPromise = (async () => {
      const originalArgv1 = process.argv[1];
      process.argv[1] = originalArgv1 || 'ktx2Optimize-import-shim.js';
      try {
        return await import('@gltf-transform/cli');
      } finally {
        process.argv[1] = originalArgv1;
      }
    })();
  }
  return gltfTransformCliPromise;
}

let ioPromise = null;
function getIO() {
  if (!ioPromise) {
    ioPromise = (async () => {
      await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
      // Same registerExtensions/registerDependencies setup as modelOptimizer.ts's client-
      // side WebIO - the document being read here already has EXT_meshopt_compression
      // applied (the client's own upload-time pass), so both decoder and encoder need to
      // be registered even though this module never touches geometry itself: without them,
      // reading/re-writing a document that declares that extension is not guaranteed safe.
      return new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
          'meshopt.decoder': MeshoptDecoder,
          'meshopt.encoder': MeshoptEncoder,
        });
    })();
  }
  return ioPromise;
}

// toktx() (@gltf-transform/cli) only accepts image/png or image/jpeg source textures -
// anything else (confirmed by reading its source: cli.mjs's toktx() checks
// `srcMimeType !== "image/png" && srcMimeType !== "image/jpeg"`) is silently skipped with
// just a warning log, no error - meaning every WebP texture coming out of the client's own
// upload-time optimization would otherwise pass through completely untouched, and this
// whole job would quietly do nothing. Decoding back to PNG first (via sharp - the same
// library gltf-transform/cli's own "ktx2" preset uses as its `encoder` for this exact
// toktx() call) is what actually makes KTX2 conversion apply to those textures at all.
// This is a decode-recompress round trip through WebP - a real, accepted quality trade for
// not needing to change the client-side upload flow (which would mean uploading original,
// larger, uncompressed source textures to R2 just for this job to consume, and paying that
// cost on every upload rather than only for the small fraction of that texture data that
// KTX2 conversion is applied to here).
async function decodeNonPngJpegTexturesToPng(document) {
  const textures = document.getRoot().listTextures();
  await Promise.all(textures.map(async (texture) => {
    const mimeType = texture.getMimeType();
    if (mimeType === 'image/png' || mimeType === 'image/jpeg') return;
    const image = texture.getImage();
    if (!image) return;
    const pngBuffer = await sharp(Buffer.from(image)).png().toBuffer();
    texture.setImage(new Uint8Array(pngBuffer)).setMimeType('image/png');
    if (texture.getURI()) {
      texture.setURI(texture.getURI().replace(/\.[a-z0-9]+$/i, '.png'));
    }
  }));
}

/**
 * Re-encodes every eligible texture in a GLB's bytes to KTX2 and returns the new GLB bytes.
 * Mirrors gltf-transform/cli's own reference "ktx2" preset (`gltf-transform optimize
 * --texture-compress ktx2`): UASTC for normal/occlusion/metallic-roughness maps (higher
 * quality, needed since those encode direction/scalar data, not color you can lossily
 * approximate), ETC1S for everything else (smaller, fine for base color/emissive). Two
 * passes because each mode's own options (rdo, quality, etc.) only apply within that mode.
 */
export async function reencodeGlbToKtx2(glbBuffer) {
  const { toktx, Mode } = await getGltfTransformCli();
  const io = await getIO();
  const document = await io.readBinary(new Uint8Array(glbBuffer));

  await decodeNonPngJpegTexturesToPng(document);

  const totalTextures = document.getRoot().listTextures().length;

  // toktx()'s own `slots` option only accepts a RegExp (matched per-slot via
  // String.prototype.match), not a predicate function - confirmed by reading its source
  // (cli.mjs's toktx()). The ETC1S pass's pattern is this same UASTC set, negated via a
  // lookahead, rather than an independent list, so the two passes can never disagree about
  // which slot goes through which mode.
  const uastcSlots = /^(normalTexture|occlusionTexture|metallicRoughnessTexture)$/;
  const etc1sSlots = /^(?!normalTexture$|occlusionTexture$|metallicRoughnessTexture$).+$/;
  await document.transform(
    toktx({ encoder: sharp, mode: Mode.UASTC, slots: uastcSlots, level: 4, rdo: true, rdoLambda: 4 })
  );
  await document.transform(
    toktx({ encoder: sharp, mode: Mode.ETC1S, quality: 255, slots: etc1sSlots })
  );

  const convertedTextures = document.getRoot().listTextures()
    .filter((t) => t.getMimeType() === 'image/ktx2').length;

  const glbBytes = await io.writeBinary(document);
  return { glbBytes: Buffer.from(glbBytes), totalTextures, convertedTextures };
}

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) throw new Error('R2_ACCOUNT_ID is not set');
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  });
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// Same key-derivation approach as the R2 keys server/index.tsx's own /r2-start-upload
// already generates (models/{timestamp}-{name}) - just appended, so the KTX2 variant lives
// alongside the original under the same prefix rather than needing its own naming scheme.
function deriveKtx2Key(originalKey) {
  return `${originalKey.replace(/\.(glb|gltf)$/i, '')}.ktx2.glb`;
}

/**
 * Full job: download the original GLB from R2, re-encode its textures to KTX2, upload the
 * result under a new key (original left untouched), and return that key. Throws on any
 * failure - the caller (server.js's /optimize-ktx2 route) is responsible for catching this
 * and reporting 'failed' status back to the Edge Function rather than leaving the model
 * record stuck on 'pending' forever.
 */
export async function runKtx2OptimizeJob({ r2Key }) {
  const bucket = requireEnv('R2_BUCKET_NAME');
  const client = getR2Client();

  const getResult = await client.send(new GetObjectCommand({ Bucket: bucket, Key: r2Key }));
  const originalBytes = await streamToBuffer(getResult.Body);

  const { glbBytes, totalTextures, convertedTextures } = await reencodeGlbToKtx2(originalBytes);

  const ktx2Key = deriveKtx2Key(r2Key);
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: ktx2Key,
    Body: glbBytes,
    ContentType: 'model/gltf-binary',
  }));

  return { ktx2Key, totalTextures, convertedTextures };
}
