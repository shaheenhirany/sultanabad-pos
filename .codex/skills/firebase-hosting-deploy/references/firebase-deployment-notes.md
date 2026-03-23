# Firebase Deployment Notes (Source: podsite-Deploy markdown)

## Source Files Reviewed

- `C:\Users\Shaheen\.openclaw\workspace\podsite-Deploy\readme.md`
- `C:\Users\Shaheen\.openclaw\workspace\podsite-Deploy\HANDOFF.md`
- `C:\Users\Shaheen\.openclaw\workspace\podsite-Deploy\SKILLS.md`

## Extracted Deployment Patterns

1. Build before deploy:
   - `npm run build`
2. Web deploy command used in project notes:
   - `npm run deploy` (script wrapper)
   - `firebase deploy --only hosting` (direct CLI)
3. Firebase hosting target example:
   - Project: `seniorcitizensbd`
   - URL: `https://seniorcitizensbd.web.app`

## Firebase Setup Notes From Handoff

- Firebase-backed stack in source project: Auth + Firestore.
- Key deployment-related files called out:
  - `firebase.json`
  - `firestore.rules`
  - `src/firebase.js`
- Operational note:
  - First admin should exist in Firebase Auth, with role rules stored in Firestore `users`.

## How To Apply This To POS Project

1. Ensure POS has Firebase Hosting config files:
   - `firebase.json`
   - `.firebaserc`
2. Ensure hosting points to Vite output:
   - `public: "dist"`
3. For single-page app routing, include rewrite:
   - `source: "**"` -> `destination: "/index.html"`
4. Use deployment flow:
   - `npm run build`
   - `firebase deploy --only hosting`
5. Optional in `package.json` scripts:
   - `"deploy": "firebase deploy --only hosting"`

## Minimal firebase.json Template (SPA + dist)

```json
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```
