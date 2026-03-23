# POS Handoff

## Project Snapshot
- App: React + Vite POS (`src/App.jsx`, `src/styles.css`)
- Hosting: Firebase Hosting
- Live URL: https://canteen-sultanabad.web.app
- Firebase Project: `canteen-sultanabad`
- Firestore: enabled, default DB created in `me-central2` (Dammam)
- Android package: `com.sultanabad.canteen.pos`

## Current Data Model / Sync
- Source of truth is Firestore document:
  - Collection: `pos_state`
  - Document: `shared`
- Local storage is fallback/cache only (`sultanabad_pos_state_v1`).
- Cloud sync status is shown in sidebar (`Cloud sync: ...`).
- Firestore rules currently open for this path:
  - `firestore.rules` allows read/write on `/pos_state/{docId}`.

## Key Functional Changes Done
- Cross-device sync implemented (laptop + Android web).
- Per-device cart behavior:
  - Cart is local per device/user.
  - Shared data (inventory/menu/finance/transactions) syncs through Firestore.
- Fixed delete persistence regressions:
  - Menu sets no longer reappear after refresh.
  - Menu items no longer reappear after refresh.
- Cart payload optimized:
  - Cart no longer stores image blobs (prevents Firestore doc size overflow/revert issues).
- Menu item images:
  - Image field is now URL-based only (no file uploads stored in Firestore).
  - Staff can paste a direct HTTPS image URL (e.g. Unsplash/Imgur/own hosting) into the Image URL field.
  - If empty, a default placeholder food image is used:
    - `https://images.unsplash.com/photo-1545324053-41b04f1a8e8a?q=80&w=870&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D`.
- Inventory guard behavior:
  - `+` disabled when no available stock.
  - Cart/menu `+` cannot exceed stock.
  - Quantity controls (`- qty +`) emphasized for better visibility.
  - Mobile menu cards improved so menu name, available stock, and price (`Rs. ...`) stay readable.
- Removed features:
  - Import/Export backup buttons and handlers removed.
  - Discount removed from logic/UI/orders.
  - `Last Ordered` block removed from Order Summary.
- Finance/mobile UI updates:
  - Finance layout compacted for Android.
  - Recent Transactions date-only format: `DD-MMM-YY`.
  - Empty menu set now shows empty list (not all items).
  - `Order ID` in transactions is re-printable (tap ID or Reprint button).
  - Removed finance top cards: `Total Orders` and `Average Order`.
  - `Sale Window` and date selectors resized for mobile one-line fit.
  - Month breakup hidden by default; shows after selecting month chips.
  - Default finance day view is set to today.
  - Dashboard filter chips (`All Menu`, custom sets) moved to Finance page only.
  - Yearly `Menu Wise Sales Report` now shows `Qty x Rate` (`Rs.` included) in:
    - On-screen table
    - Print output
    - Yearly chart row labels
  - Finance month cards (`Jan`-`Dec`) compacted to reduce screen usage.
- Desktop/laptop list compaction:
  - `Manage Items` list now uses compact multi-card layout.
  - `Inventory` list now uses compact multi-card layout.

## Authentication / Login
- Implemented Firebase Authentication (Email/Password) login.
- Startup login gate added for web + APK.
- APK/mobile header updates:
  - Logout moved to top-right near brand/cloud-sync area.
  - User label shortened (email suffix/domain removed, e.g. no `@gmail.com`).
- Login screen redesigned and centered for Android/webview.
- Login copy updated to:
  - `Sign in with email to continue Inventory and finance reports.`
  - `Use your provided credentials.`
  - `@ Designed by Shaheen Hirani`

## Printing Status
- Order receipt print path:
  1. Native SH-Print plugin (`window.PrinterSettings.printText`) when available in native app.
  2. Browser popup print fallback (RawBT removed as default path).
- Order creation print guard:
  - If required printer flow fails, order is not created/confirmed.
- Finance print buttons added for:
  - Today Item Wise Breakup
  - Selected Month Item Wise Breakup
  - Menu Wise Sales Report (table only, no graph)
- All print outputs now include header:
  - `SULTANABAD CANTEEN`
- Text print formatting refinements:
  - Global left margin added (`PRINT_LEFT_MARGIN_SPACES = 1`).
  - Header/title/subtitle centered in text print output.
  - Today Item Wise print compacted to one-line rows:
    - `Item | QxR | Rev` format (e.g. `4x70`, no `Rs.` prefix).
  - Menu Wise Sales Report print compacted to one-line rows:
    - `Item | Qty x Rate | Rev` with shortened item label and single-line Total row.
  - Trailing blank text reduced via trimmed output to reduce paper waste.
- Printer Settings button:
  - Shown next to cloud sync area.
  - Visible only on `Finance` tab.

## Notifications / App Update Control
- Push notifications integrated for Android via Capacitor + FCM.
- Device tokens stored in Firestore collection: `device_tokens`.
- Update policy driven by Firestore doc: `app_config/pos`
  - `latestVersion`
  - `minSupportedVersion`
  - `updateUrl`
  - `updateMessage`
- Added admin helper scripts:
  - `scripts/send-fcm.mjs`
  - `scripts/set-app-update.mjs`
- Documentation:
  - `NOTIFICATIONS.md`

## Branding
- App logo updated to `App Logo.png` / `src/assets/app-logo.png`.
- Sidebar top-left icon replaced with circular logo.
- Login screen uses same logo.

## Important Files
- `src/App.jsx`: app logic, Firebase Auth login/logout, Firestore sync, print flows, finance print actions, notifications/update prompts, client-side logging
- `src/styles.css`: mobile UI, finance responsiveness, centered login design
- `src/firebase.js`: Firebase app + Firestore + Auth init
- `firebase.json`: hosting + firestore config
- `firestore.rules`
- `firestore.indexes.json`
- `android/app/google-services.json`: Firebase Android config (must match `com.sultanabad.canteen.pos`)

## Commands
- Dev: `npm run dev`
- Build: `npm run build`
- Hosting deploy (always use `--only hosting` for this project):
  - `firebase deploy --only hosting`
- Firestore + hosting deploy (when rules/indexes changed):
  - `firebase deploy --only "firestore,hosting" --project canteen-sultanabad`
- Android sync: `npx cap sync android`
  - Run this after UI/data changes so the Android app picks up the latest web assets.
- Signed APK build (JDK 21 required):
  - `cmd /c "set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr&& set PATH=%JAVA_HOME%\bin;%PATH%&& cd android && gradlew.bat assembleRelease"`
  - Output: `android/app/build/outputs/apk/release/app-release.apk`

## Known Risk / Follow-up
- Firestore rules are open (`allow read, write: if true`) for rapid operations.
- Firebase Auth is enabled, but Firestore rules are not yet auth-restricted.
- Production no longer auto-seeds demo menu data:
  - In production, if `pos_state/shared` is missing, the app shows `Cloud sync: missing shared menu` and **does not** write demo/default menu content.
  - Auto-seeding from local/default state is now limited to `import.meta.env.DEV` (local dev only) to avoid overwriting real menu data.
- App-level client logs:
  - Client writes structured log entries to Firestore collection `client_logs` for unusual events (e.g. missing `pos_state/shared` in prod, cloud sync failures, sales history subscription failures, sale persist/delete failures).
  - Each log includes `eventType`, `data`, `createdAt` (serverTimestamp), and `appVersion`.
- Recommended next tasks:
  - Add auth-based Firestore security rules and role controls.
  - Add account provisioning SOP (create/disable staff emails).

## Last Verified
- Build: passing (`npm run build`) on February 18, 2026
- Deploy: successful to `https://canteen-sultanabad.web.app` on February 18, 2026
- Signed APK: `android/app/build/outputs/apk/release/app-release.apk`
  - Last build time: February 18, 2026, 9:11:28 AM
  - Size: 5,586,493 bytes
