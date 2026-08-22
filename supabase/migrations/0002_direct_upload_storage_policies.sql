-- Enables direct browser-to-Storage uploads for large model files (previously every
-- upload's full file body was proxied through the Edge Function, using the service-role
-- key to bypass RLS entirely - workable for small files, but Edge Functions are not a
-- reliable path for large request bodies, well before the 500MB-5GB this app needs to
-- support). With RLS enabled on storage.objects and no policy defined here, ANY direct
-- client access (even from an authenticated admin) was denied outright - this is why
-- the proxy-through-the-Edge-Function approach was the only thing that worked at all.
--
-- These mirror the exact same admin check server/index.tsx's /upload-model handler
-- already enforces (user_metadata->>role = 'admin'), just moved to the storage layer so
-- the browser can talk to Storage directly while keeping the same restriction.
-- Run this once in Supabase Dashboard > SQL Editor (same as migration 0001).

drop policy if exists "admin upload models" on storage.objects;
create policy "admin upload models" on storage.objects
  for insert
  with check (
    bucket_id = 'make-cf230d31-models'
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- TUS resumable uploads PATCH (append bytes to) an in-progress object across multiple
-- requests, which Postgres RLS sees as an UPDATE on storage.objects, not another INSERT.
drop policy if exists "admin update models" on storage.objects;
create policy "admin update models" on storage.objects
  for update
  using (
    bucket_id = 'make-cf230d31-models'
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  with check (
    bucket_id = 'make-cf230d31-models'
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Lets the client (and the TUS protocol itself, to detect/resume an in-progress upload)
-- check that a file actually landed before calling the Edge Function to finalize it.
drop policy if exists "admin read own uploads" on storage.objects;
create policy "admin read own uploads" on storage.objects
  for select
  using (
    bucket_id = 'make-cf230d31-models'
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
