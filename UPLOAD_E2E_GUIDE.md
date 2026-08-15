# Model Upload E2E Testing Guide

## Prerequisites

1. Start the dev server: `npm run dev` (from `Naviz/` directory)
2. Open the app in Chrome (e.g. http://localhost:5173)
3. Have a sample 3D file (`.glb`, `.gltf`, `.fbx`, `.obj`, etc.)

---

## Admin Upload Flow

1. **Login as Admin**
   - Go to `/admin/login` or use the login page with admin credentials
   - Navigate to Admin Dashboard

2. **Open Upload**
   - Click **Upload Models** in the sidebar (or go to `/admin/upload`)

3. **Fill and Upload**
   - Enter **Title** (required)
   - Optionally add description and tags
   - Drag & drop or click to add 3D model file(s)
   - Click **Start Upload**

4. **Verify**
   - Upload queue shows progress
   - On success: "Saved X MB" with checkmark
   - Click **Preview** to open model in workspace
   - If backend fails: fallback to localStorage + local blob; model still loads

---

## User (Client) Upload Flow

1. **Login as Client**
   - Go to `/client/login` or use client credentials
   - Navigate to Client Dashboard

2. **Subscription (if needed)**
   - Click **Upload Model** → `/client/upload`
   - If no active plan: select Silver/Gold/Platinum, choose duration, complete payment (demo)
   - After payment: form appears

3. **Upload**
   - Enter **Title**
   - Add file (glb, gltf, fbx, obj, stl, ply; max 500MB)
   - Click **Upload & Open in Workspace**

4. **Verify**
   - Progress shown during upload
   - Redirects to `/workspace` with model loaded
   - Backend: tries Supabase `upload-model` edge function first; on failure, uses local file (data URL)

---

## Backend Integration

- **Admin**: `POST https://{projectId}.supabase.co/functions/v1/make-server-cf230d31/upload-model`
- **User**: Same endpoint with `uploaderRole: 'client'`
- Both use `Authorization: Bearer {access_token}` from Supabase session
- Fallback: local blob/data URL when API fails (e.g. edge function not deployed)
