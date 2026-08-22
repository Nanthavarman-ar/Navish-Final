-- Fixes uploads failing with 413 "Maximum size exceeded" from the resumable-upload
-- endpoint: the models bucket (created in migration 0001) never had an explicit
-- file_size_limit set, so it fell back to whatever this project's global Storage size
-- limit is - which is capped at 50MB on Supabase's Free plan REGARDLESS of anything set
-- here or in application code, and can only be raised (up to 500GB) on the Pro plan or
-- higher via Project Settings > Storage > "Global file size limit" in the Dashboard
-- (there is no SQL equivalent for that specific global setting - it must be raised
-- there first, and this bucket's own limit can never exceed it).
--
-- Run this once in Supabase Dashboard > SQL Editor (same as migrations 0001/0002) -
-- AFTER raising the project's global Storage size limit if currently on the Free plan.

update storage.buckets
set file_size_limit = 5368709120 -- 5GB, in bytes
where id = 'make-cf230d31-models';
