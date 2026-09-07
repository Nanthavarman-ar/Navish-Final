// Uploads a model (or thumbnail) file directly from the browser to Cloudflare R2, via
// S3-compatible multipart upload - chosen over Supabase Storage for large models because
// Supabase's Free plan hard-caps every bucket at 50MB (see
// supabase/migrations/0003_raise_model_bucket_size_limit.sql), while R2's free tier is
// 10GB of TOTAL storage with no per-file size cap and no egress fees at all.
//
// Unlike Supabase's TUS-based resumable upload, R2 has no built-in resumable protocol -
// this implements the equivalent resilience manually: the file is split into ~8MB parts,
// each requested and uploaded (via a short-lived presigned URL from the Edge Function),
// and any single part that fails is retried on its own with backoff rather than needing
// to restart the whole file from byte zero. That per-part retry is what actually matters
// on a slow/unstable connection - restarting a 200MB upload from scratch because one part
// hiccuped is the failure mode this is built to avoid.
//
// Parts upload CONCURRENTLY (see PARALLEL_PARTS below), not one at a time - each part is
// two full network round-trips (an Edge Function call for a presigned URL, then the PUT
// itself to R2), and for a large file split into dozens/hundreds of 8MB parts, doing them
// strictly sequentially means paying that round-trip latency dozens/hundreds of times in a
// row with nothing overlapping. /r2-part-url is stateless per call (just signs a URL for
// whatever partNumber it's given, no server-side ordering requirement - see
// server/index.tsx), so nothing about correctness depends on parts starting or finishing
// in numeric order; only /r2-complete-upload's own parts list needs to be sorted by
// partNumber before it's sent; see below.
//
// Requires the four /r2-* Edge Function endpoints in server/index.tsx, and the R2
// bucket's CORS policy to allow PUT from this app's origin AND expose the ETag response
// header (browsers hide it by default - without Access-Control-Expose-Headers: ETag,
// every part upload will appear to succeed but this code can't read back the ETag it
// needs to complete the multipart upload).
import { supabase } from '../../supabase/client';

// S3/R2 multipart upload requires every part except the last to be at least 5MB - 8MB
// keeps comfortably above that while keeping part count (and so request count) reasonable
// even for a large file.
const CHUNK_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_PART_RETRIES = 5;
// Matches the AWS SDK's own Upload helper default (queueSize: 4) - enough to overlap
// several round-trips' worth of latency and use more of the available bandwidth than one
// stream can alone, without opening so many connections at once that a slower/shared
// connection's parts start meaningfully competing with each other for bandwidth.
const PARALLEL_PARTS = 4;

export interface R2UploadProgress {
  bytesUploaded: number;
  bytesTotal: number;
}

async function callFunction(functionsBaseUrl: string, path: string, body: unknown): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error('Authentication required to upload');
  }

  const response = await fetch(`${functionsBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(body)
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Request to ${path} failed (${response.status})`);
  }
  return data;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function uploadPartWithRetry(url: string, chunk: Blob): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_PART_RETRIES; attempt++) {
    try {
      const response = await fetch(url, { method: 'PUT', body: chunk });
      if (!response.ok) {
        throw new Error(`Part upload failed with status ${response.status}`);
      }
      const eTag = response.headers.get('ETag') || response.headers.get('etag');
      if (!eTag) {
        throw new Error('Upload succeeded but no ETag was returned - check that the R2 bucket\'s CORS policy exposes the ETag header');
      }
      return eTag;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_PART_RETRIES) {
        await sleep(Math.min(1000 * 2 ** attempt, 15000));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Part upload failed after retries');
}

export interface R2UploadResult {
  key: string;
  // Public URL (getR2PublicUrlBase()/key) - immediately fetchable, no signing needed.
  // Used directly as a BABYLON.VideoTexture source for InteractiveFixtures' TV videos.
  url: string;
}

/**
 * Uploads `file` to R2 via multipart upload and returns the object key/public URL it
 * landed at (the key goes to /finalize-model-upload as r2Key for a model upload; the url
 * is what a TV fixture's video plays directly from).
 */
export async function uploadFileToR2(
  functionsBaseUrl: string,
  file: File,
  pathPrefix: 'models' | 'thumbnails' | 'fixture-videos',
  onProgress?: (progress: R2UploadProgress) => void
): Promise<R2UploadResult> {
  const { uploadId, key } = await callFunction(functionsBaseUrl, '/r2-start-upload', {
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    pathPrefix
  });

  const totalParts = Math.max(1, Math.ceil(file.size / CHUNK_SIZE_BYTES));
  const parts: { partNumber: number; eTag: string }[] = [];

  try {
    // Simple worker-pool: PARALLEL_PARTS "workers" each pull the next not-yet-started
    // part number and process it (get a presigned URL, upload with retry) until none are
    // left. bytesUploaded is tracked as a running total of completed parts' own sizes,
    // not by partNumber order - parts finish out of numeric order under concurrency, so
    // "the end offset of the highest part started so far" (the old sequential loop's
    // implicit progress measure) would no longer correctly reflect what's actually done.
    let nextPartNumber = 1;
    let bytesUploaded = 0;
    const runWorker = async () => {
      while (true) {
        const partNumber = nextPartNumber++;
        if (partNumber > totalParts) return;

        const start = (partNumber - 1) * CHUNK_SIZE_BYTES;
        const end = Math.min(start + CHUNK_SIZE_BYTES, file.size);
        const chunk = file.slice(start, end);

        const { url } = await callFunction(functionsBaseUrl, '/r2-part-url', { key, uploadId, partNumber });
        const eTag = await uploadPartWithRetry(url, chunk);
        parts.push({ partNumber, eTag });

        bytesUploaded += end - start;
        onProgress?.({ bytesUploaded, bytesTotal: file.size });
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(PARALLEL_PARTS, totalParts) }, () => runWorker())
    );
    // S3-compatible multipart completion (R2 included) requires the parts list sorted
    // ascending by PartNumber - concurrent workers finish in whatever order their
    // individual round-trips happen to land in, not numeric order.
    parts.sort((a, b) => a.partNumber - b.partNumber);

    const result = await callFunction(functionsBaseUrl, '/r2-complete-upload', { key, uploadId, parts });
    return { key, url: result.url };
  } catch (error) {
    // Best-effort - the upload has already failed either way, this just stops an
    // incomplete multipart upload from sitting in the bucket accruing storage cost.
    callFunction(functionsBaseUrl, '/r2-abort-upload', { key, uploadId }).catch(() => {});
    throw error;
  }
}
