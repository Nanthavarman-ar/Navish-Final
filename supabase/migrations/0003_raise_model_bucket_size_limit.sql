-- Fixes uploads failing with 413 "Maximum size exceeded" from the resumable-upload
-- endpoint: the models bucket (created in migration 0001) never had an explicit
-- file_size_limit set, so it fell back to whatever this project's global Storage size
-- limit is.
--
-- Set to 50MB - the maximum Supabase's Free plan allows at all (Project Settings >
-- Storage > "Global file size limit" cannot be raised past that without upgrading to
-- Pro or higher; this bucket's own limit can never exceed the global one regardless of
-- what's set here). Staying on the Free plan for now, so this makes the bucket's real,
-- explicit ceiling match what will actually work rather than relying on an implicit
-- default. If/when the project moves to a paid plan: raise the Dashboard's global limit
-- first, then bump this to whatever's needed (up to 500GB on Pro+), and raise
-- admin/UploadPage.tsx's client-side maxSize check to match.
--
-- Run this once in Supabase Dashboard > SQL Editor (same as migrations 0001/0002).

update storage.buckets
set file_size_limit = 52428800 -- 50MB, in bytes
where id = 'make-cf230d31-models';
