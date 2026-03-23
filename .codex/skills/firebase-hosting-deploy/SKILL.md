---
name: firebase-hosting-deploy
description: Configure and deploy the POS web app to Firebase Hosting. Use when setting up Firebase project files (`firebase.json`, `.firebaserc`), adding deploy scripts, running production builds, or publishing updates to hosting from the POS project.
---

# Firebase Hosting Deploy

## Overview

Use this skill to apply a stable Firebase Hosting deployment workflow in the POS project, based on deployment notes captured in `podsite-Deploy` markdown files.

## Workflow

1. Validate project readiness:
   - Confirm `npm run build` succeeds.
   - Confirm `dist/` is produced by Vite.
2. Confirm Firebase config files in POS root:
   - `firebase.json`
   - `.firebaserc`
3. Apply hosting config if missing:
   - Set hosting `public` to `dist`.
   - Add SPA rewrite to `index.html`.
4. Deploy:
   - Prefer `npm run deploy` if project script exists.
   - Else run `firebase deploy --only hosting`.
5. Verify deployment URL from CLI output and smoke-test key routes.

## POS Project Defaults

- Build command: `npm run build`
- If no deploy script exists in `package.json`, deploy directly with Firebase CLI.
- Optional script to add:
  - `"deploy": "firebase deploy --only hosting"`

## Commands

```powershell
npm run build
firebase deploy --only hosting
```

## Validation Checklist

1. Build completes without errors.
2. `firebase.json` points to `dist`.
3. SPA routes load after refresh (rewrite active).
4. Hosting URL is reachable and serves latest build.

## References

- Read `references/firebase-deployment-notes.md` for extracted notes from:
  - `podsite-Deploy/readme.md`
  - `podsite-Deploy/HANDOFF.md`
  - `podsite-Deploy/SKILLS.md`
