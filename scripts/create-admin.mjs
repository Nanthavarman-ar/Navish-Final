#!/usr/bin/env node
// One-time / idempotent provisioning script for the SINGLE fixed admin account.
// Run this locally (never through the browser, never through the public API) -
// it needs the Supabase SERVICE ROLE key, which must never ship to client code
// or be pasted into chat/anywhere public.
//
// Usage (PowerShell):
//   $env:SUPABASE_URL="https://xgljnawquknqrjezqhgo.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="<service_role key from Supabase dashboard>"
//   $env:ADMIN_EMAIL="admin@yourdomain.com"
//   $env:ADMIN_USERNAME="admin"
//   $env:ADMIN_PASSWORD="a-strong-password"
//   node scripts/create-admin.mjs
//
// Refuses to create a second admin: if an admin account already exists with a
// different email, it exits with an error instead of creating another one.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrator';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (Project Settings > API > service_role) in your shell env first.');
  process.exit(1);
}
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in your shell env first.');
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 8) {
  console.error('ADMIN_PASSWORD must be at least 8 characters.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function listAllUsers() {
  const users = [];
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) return users;
    page += 1;
  }
}

async function upsertKvRecord(user) {
  const { error } = await supabase.from('kv_store_cf230d31').upsert({
    key: `user:${user.id}`,
    value: {
      id: user.id,
      name: ADMIN_NAME,
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      role: 'admin',
      createdAt: new Date().toISOString(),
      assignedModels: [],
      lastActive: new Date().toISOString(),
    },
  });
  if (error) {
    console.warn(
      'Warning: could not write admin profile to kv_store_cf230d31 (run the SQL setup first if this table does not exist yet):',
      error.message
    );
  }
}

async function main() {
  const users = await listAllUsers();
  const existingAdmin = users.find((u) => u.user_metadata?.role === 'admin');

  if (existingAdmin && existingAdmin.email !== ADMIN_EMAIL) {
    console.error(
      `An admin account already exists (${existingAdmin.email}). This app allows only ONE admin, ` +
      `so a second one was NOT created. To replace the admin, delete/demote the existing account first ` +
      `in the Supabase dashboard, or re-run with ADMIN_EMAIL=${existingAdmin.email} to update it instead.`
    );
    process.exit(1);
  }

  // Covers both: an account already flagged admin, and a same-email account
  // that exists (e.g. created manually via the dashboard) but is missing the
  // role/username metadata this app relies on.
  const target = existingAdmin || users.find((u) => u.email === ADMIN_EMAIL);

  if (target) {
    const { data, error } = await supabase.auth.admin.updateUserById(target.id, {
      password: ADMIN_PASSWORD,
      user_metadata: { name: ADMIN_NAME, username: ADMIN_USERNAME, role: 'admin' },
    });
    if (error) throw error;
    await upsertKvRecord(data.user);
    console.log(`Updated existing account to admin: ${data.user.email}`);
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    user_metadata: { name: ADMIN_NAME, username: ADMIN_USERNAME, role: 'admin' },
    email_confirm: true,
  });
  if (error) throw error;
  await upsertKvRecord(data.user);
  console.log(`Created admin account: ${data.user.email}`);
}

main().catch((err) => {
  console.error('Failed:', err.message || err);
  process.exit(1);
});
