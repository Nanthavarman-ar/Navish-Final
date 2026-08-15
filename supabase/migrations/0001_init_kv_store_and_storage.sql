-- Fixes "Failed to load model(s)" on this project (xgljnawquknqrjezqhgo):
-- the backend (server/index.tsx, server/kv_store.tsx) reads/writes a table
-- and a storage bucket that were never created in THIS Supabase project
-- (they existed only in an older project this template was copied from).
-- Run this once in Supabase Dashboard > SQL Editor.

-- Key/value store used for user profiles, model metadata, audit log, etc.
create table if not exists public.kv_store_cf230d31 (
  key text not null primary key,
  value jsonb not null
);

alter table public.kv_store_cf230d31 enable row level security;

-- Only the service role (used by the Edge Function backend) may access this
-- table directly; it is never queried from the browser with the anon key.
drop policy if exists "service role only" on public.kv_store_cf230d31;
create policy "service role only" on public.kv_store_cf230d31
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Storage bucket the backend uploads/serves 3D models from.
insert into storage.buckets (id, name, public)
values ('make-cf230d31-models', 'make-cf230d31-models', false)
on conflict (id) do nothing;
