// Uploads a model (or thumbnail) file DIRECTLY from the browser to Supabase Storage,
// instead of proxying the whole file body through the /upload-model Edge Function the
// way this app used to. Edge Functions are not a reliable path for large request bodies -
// fine for a few MB, but this app needs to support model uploads up to 5GB. Large files
// go through Supabase Storage's TUS resumable-upload protocol, which can pick up from
// where it left off after a network drop instead of restarting the whole transfer from
// zero - the real fix for "slow/unstable network" reliability, not just raw throughput.
//
// Requires the storage.objects RLS policies in
// supabase/migrations/0002_direct_upload_storage_policies.sql (admin-only insert/update/
// select on the models bucket) - without them every direct call here is rejected by RLS,
// which is exactly why uploads previously had to be proxied through the Edge Function's
// service-role key instead.
import * as tus from 'tus-js-client';
import { supabase, projectId } from '../../supabase/client';

const BUCKET_NAME = 'make-cf230d31-models';

// Supabase's TUS implementation requires exactly this chunk size (its resumable-upload
// backend is built around 6MB parts) - not just a tuning knob.
const TUS_CHUNK_SIZE_BYTES = 6 * 1024 * 1024;

// Files at or under this size use Storage's plain single-request upload - simpler, and
// there's nothing meaningful to resume in a file this small anyway. Matches Supabase's
// own documented recommendation for when to prefer TUS over a standard upload.
const RESUMABLE_THRESHOLD_BYTES = 6 * 1024 * 1024;

export interface DirectUploadProgress {
  bytesUploaded: number;
  bytesTotal: number;
}

/**
 * Uploads `file` directly to the models storage bucket under `models/` or
 * `thumbnails/`, and returns the storage path it landed at (to hand to
 * /finalize-model-upload afterwards). Requires an active, authenticated Supabase
 * session - callers should ensure the user is signed in before calling this.
 */
export async function uploadFileDirectToStorage(
  file: File,
  pathPrefix: 'models' | 'thumbnails',
  onProgress?: (progress: DirectUploadProgress) => void
): Promise<string> {
  const fileName = `${Date.now()}-${file.name}`;
  const filePath = `${pathPrefix}/${fileName}`;

  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error('Authentication required to upload');
  }

  if (file.size <= RESUMABLE_THRESHOLD_BYTES) {
    const { error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, file);
    if (error) throw error;
    onProgress?.({ bytesUploaded: file.size, bytesTotal: file.size });
    return filePath;
  }

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-upsert': 'false'
      },
      chunkSize: TUS_CHUNK_SIZE_BYTES,
      uploadDataDuringCreation: true,
      // Clears the locally-stored fingerprint once done, but leaves it in place on
      // failure/interruption specifically so findPreviousUploads() below can offer a
      // resume the next time this same file is picked (even across a page reload or
      // browser restart, not just a brief network blip within one session).
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: BUCKET_NAME,
        objectName: filePath,
        contentType: file.type || 'application/octet-stream',
        cacheControl: '3600'
      },
      onError: (error) => reject(error),
      onProgress: (bytesUploaded, bytesTotal) => {
        onProgress?.({ bytesUploaded, bytesTotal });
      },
      onSuccess: () => resolve()
    });

    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    }).catch(() => {
      // Couldn't check for a resumable upload (e.g. storage disabled) - start fresh
      // rather than failing outright.
      upload.start();
    });
  });

  return filePath;
}

export interface FinalizeModelUploadParams {
  filePath: string;
  fileName: string;
  fileSize: number;
  format: string;
  thumbnailPath?: string;
  title: string;
  description: string;
  tags: string;
  assignedClients: string[];
}

/**
 * Registers the model record for a file already uploaded via uploadFileDirectToStorage
 * above, by calling the Edge Function's lightweight finalize endpoint (a small JSON
 * request - no file bytes) rather than /upload-model, which still expects to receive
 * the whole file itself.
 */
export async function finalizeModelUpload(functionsBaseUrl: string, params: FinalizeModelUploadParams): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${functionsBaseUrl}/finalize-model-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(params)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to finalize model upload');
  }
  return data;
}
