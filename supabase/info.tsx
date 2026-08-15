/* Strict Supabase configuration for production-safe auth/billing flows. */
const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const rawProjectId = (import.meta.env.VITE_SUPABASE_PROJECT_ID || '').trim();

if (!rawSupabaseUrl || !rawAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

const normalizedSupabaseUrl = rawSupabaseUrl.replace(/\/+$/, '');
const projectIdFromUrl = normalizedSupabaseUrl.match(
  /^https?:\/\/([^./]+)\.supabase\.co/
)?.[1];

export const supabaseUrl = normalizedSupabaseUrl;
export const projectId = rawProjectId || projectIdFromUrl || '';
export const publicAnonKey = rawAnonKey;
