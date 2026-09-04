import { supabase } from '../../supabase/client';

export interface FinalizeModelUploadParams {
  // Exactly one of these two - filePath for a file uploaded directly to Supabase
  // Storage, r2Key for one uploaded via uploadFileToR2 (components/utils/r2ModelUpload.ts)
  // instead. In practice only the r2Key path is actually used (admin/UploadPage.tsx) -
  // the Supabase Storage direct-upload path this was originally paired with
  // (uploadFileDirectToStorage) was never wired up to any caller and has been removed.
  filePath?: string;
  r2Key?: string;
  fileName: string;
  fileSize: number;
  format: string;
  thumbnailPath?: string;
  thumbnailR2Key?: string;
  title: string;
  description: string;
  tags: string;
  assignedClients: string[];
}

/**
 * Registers the model record for a file already uploaded to storage, by calling the
 * Edge Function's lightweight finalize endpoint (a small JSON request - no file bytes)
 * rather than /upload-model, which still expects to receive the whole file itself.
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
