// Client-side glTF/GLB optimization run at upload time (components/admin/UploadPage.tsx),
// before the file reaches the R2 multipart upload flow (r2ModelUpload.ts). Nothing about
// the upload path or the model viewer needs to change for this to work:
//
// - Geometry compression uses meshopt (EXT_meshopt_compression), not Draco - Draco's own
//   encoder (draco3dgltf) is documented Node-only, while meshoptimizer's encoder/decoder
//   are genuinely browser-usable. Babylon's own glTF loader (@babylonjs/loaders) already
//   has built-in EXT_meshopt_compression decode support, so compressed files just load
//   normally with zero viewer-side changes.
// - Texture compression converts to WebP via @gltf-transform/functions' documented
//   browser-only mode (no `sharp` encoder needed). Babylon's loader already supports
//   EXT_texture_webp too.
//
// Every step here is wrapped so a failure just means "upload the original file
// unoptimized" - optimization is a bonus, never a reason an otherwise-fine upload fails.
import { Document, WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, weld, meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer/decoder';
import { MeshoptEncoder } from 'meshoptimizer/encoder';

export interface ModelOptimizationResult {
  file: File;
  optimizations: string[];
  originalSize: number;
  optimizedSize: number;
}

let ioPromise: Promise<WebIO> | null = null;

// Built once, reused across every upload in the session - MeshoptEncoder/Decoder's own
// .ready promises (WASM instantiation) are the expensive part, not constructing WebIO.
function getIO(): Promise<WebIO> {
  if (!ioPromise) {
    ioPromise = (async () => {
      await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
      const io = new WebIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
          'meshopt.decoder': MeshoptDecoder,
          'meshopt.encoder': MeshoptEncoder,
        });
      return io;
    })();
  }
  return ioPromise;
}

/**
 * Optimizes a .glb/.gltf File: welds duplicate vertices, prunes unused data, converts
 * textures to WebP (except normal maps - see below), and meshopt-compresses geometry.
 * Returns null if optimization couldn't be applied (malformed file, unsupported feature,
 * etc) - the caller should fall back to uploading the original file in that case.
 */
export async function optimizeGlbFile(
  file: File,
  onStage?: (stage: string) => void
): Promise<ModelOptimizationResult | null> {
  try {
    const io = await getIO();
    const bytes = new Uint8Array(await file.arrayBuffer());
    const document: Document = await io.readBinary(bytes);
    const optimizations: string[] = [];

    onStage?.('Removing duplicate data...');
    await document.transform(weld(), dedup(), prune());
    optimizations.push('Removed duplicate vertices/data');

    onStage?.('Compressing textures...');
    // Normal maps encode a surface direction, not color - lossy WebP recompression
    // distorts that data and produces subtly wrong lighting (the same class of bug
    // already fixed for normal maps elsewhere in this codebase - see
    // components/ui/chart.tsx's ... no, see MaterialEditor.tsx's gammaSpace fix).
    // Excluding the normalTexture slot avoids reintroducing it here.
    await document.transform(
      textureCompress({ targetFormat: 'webp', resize: [2048, 2048], slots: /^(?!normalTexture).*$/ })
    );
    optimizations.push('Compressed textures to WebP');

    onStage?.('Compressing geometry...');
    document.createExtension(EXTMeshoptCompression).setRequired(true);
    await document.transform(meshopt({ encoder: MeshoptEncoder }));
    optimizations.push('Compressed geometry (meshopt)');

    onStage?.('Finalizing...');
    const optimizedBytes = await io.writeBinary(document);
    const optimizedFile = new File(
      [optimizedBytes],
      file.name.replace(/\.(glb|gltf)$/i, '.glb'),
      { type: 'model/gltf-binary' }
    );

    return {
      file: optimizedFile,
      optimizations,
      originalSize: file.size,
      optimizedSize: optimizedFile.size,
    };
  } catch (error) {
    console.warn('Model optimization failed - uploading original file unoptimized:', error);
    return null;
  }
}
