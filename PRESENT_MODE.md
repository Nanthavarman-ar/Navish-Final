# Present mode (client presentation)

Opening `/demo/<shareId>` (the existing no-login share link) now starts in **PRESENT** mode:
only the model + a minimal glass UI. All workspace/editor panels, the top bar, toolbars
and keyboard shortcuts are hidden and disabled.

There is **no way** to reach the workspace UI from a demo or client link: no URL flag, no
long-press, no PIN. The workspace is only available through the admin login at `/workspace`.
In present mode the workspace runs with `isAdmin={false}` and `presentMode`, which renders none
of its editor UI, ignores its keyboard shortcuts and `?feature=` links, and refuses every
feature toggle except VR/AR.

## One folder per client

Every client project can have its own files, keyed by the share id of the link:

```
public/projects/<shareId>/config.json      branding + settings (falls back to public/config.json)
public/projects/<shareId>/homes.json       homes data          (falls back to public/homes.json)
public/projects/<shareId>/panoramas/       360 images
public/projects/<shareId>/photos/, plans/  whatever homes.json points to
```

`config.json`: clientName, clientLogo, tagline, accentColor, contactLink (https/mailto/tel,
`{home}` is replaced by the home name), units ("m2"/"ft2"), cutHeightRatio
(0..1, where in a level the section cut happens), cutCaps, naming (regex patterns).

## Model naming (Blender) - needed per client

| Object | Name | Notes |
|---|---|---|
| each level (slab/walls of that level) | `Floor_01`, `Floor_02` ... | one object (or group) per level |
| each home | `Home_101`, `Home_102` ... | first digits = level (101 -> level 1, 1204 -> level 12) |
| roof | `Roof` | hidden whenever a floor is sliced |
| facade/site | `Exterior`, `Facade`, `Shell` or `Site` | hidden in "Interior" view |

Keep them as separate objects, don't join them, keep names through export. Different
naming? Change the `naming` regexes in config.json instead of renaming. If a home's level
cannot be read from its number, set `"floor"` in homes.json.

Make homes.json placeholders from a model:
`node scripts/generate-homes.mjs model.glb public/projects/<shareId>` - or open the present
link and run `__presentExportHomes()` in the browser console (works without homes.json).
`homes.example.json` shows every field. `id` must match the mesh name.

## 360 rooms

Files: `/projects/<shareId>/panoramas/<homeId>_<room>_<time>.jpg`, for example
`Home_101_living_day.jpg`; room = the keys in homes.json `rooms`
(living, dining, bedroom, balcony ...); time = `morning`, `day`, `sunset`, `night`.
- Equirectangular, 2:1. **4096x2048** JPEG (quality ~80, aim < 1.5 MB). 
- Optional phone version: same name + `_m` (`Home_101_living_day_m.jpg`, **2048x1024**,
  < 500 KB) - phones load it automatically when present.
- Not every time is needed: the slider only offers the ones that exist (one image = no slider).
- Hotspots (labels that jump to another room) go in homes.json `hotspots`; yaw/pitch in degrees.

## Deploy (Vercel; `vercel.json` already exists)

1. Push this branch to GitHub, open it in Vercel -> "Add New Project" -> pick the repo.
   Framework: Vite. Build `npm run build`, output `dist`. Add the same env vars you use today
   (Supabase URL/keys) under Settings -> Environment Variables.
2. Put each client's files in `public/projects/<shareId>/`, commit, push (Vercel redeploys).
3. Netlify instead: build `npm run build`, publish `dist`, and add a `_redirects` file with
   `/*  /index.html  200` for the single-page app.
4. QR code: `npm i` then `npm run qr -- https://YOUR-SITE/demo/<shareId> client-name`
   -> `qr/client-name.png` (2400 px, error-correction H) and `qr/client-name.svg` (print at any size).

## Pre-delivery checklist

- [ ] Link opens with no login on a phone (not on your Wi-Fi: use mobile data) and on desktop.
- [ ] No editor panels, buttons or keyboard shortcuts appear; only the client's name/logo.
- [ ] Floors: tap a floor and the picker; slice, white caps, up/down, Back all work.
- [ ] Every home has a pin; hover card (desktop), tap card (phone), side panel / bottom sheet.
- [ ] ft2/m2 toggle changes the numbers; "Book a call" opens the right link.
- [ ] 360: every room tab loads, time slider crossfades, hotspots jump, Exit works.
- [ ] VR headset: enter VR, pins visible, controller ray opens the info panel, 360 works.
- [ ] Slow network (browser dev tools "Slow 4G"): model and first 360 image stay usable.
- [ ] Adding `?workspace=1` or `?feature=showPropertyInspector` to the link changes nothing.
- [ ] config.json has the real client name/logo/colour; homes.json has no empty areas.

## What changed (undo)

Edited: `components/BabylonWorkspace.tsx` (new optional `presentMode` prop + gates, and a
`naviz:present-xr` listener), `components/DemoViewer.tsx`, `components/utils/meshMerging.ts` (Floor/Home/Roof/Exterior are never merged/instanced), `package.json` (qrcode dev dependency, 2 scripts).
New: `data/`, `presentation/`, `ui/`, `scripts/make-qr.mjs`, `scripts/generate-homes.mjs`,
`public/config.json`, `public/homes.json`, `public/homes.example.json`, this file.

Undo everything: `git checkout main` (or delete the branch `feature/present-mode`).
Undo only present mode for demo links: revert `components/DemoViewer.tsx`.
The model, baked textures, materials, lights, glow/bloom, pipeline and XR setup are not edited;
nothing runs in `/workspace` differently (`presentMode` defaults to false).

## Known limits - please test

This was written without being able to run the app. Verify on a real model: the
white-cap trick (back faces of the clipped meshes) can look different on some exports;
fade-out of frozen materials may snap instead of fading; VR pin selection depends on the
XR pointer-selection feature being on.
