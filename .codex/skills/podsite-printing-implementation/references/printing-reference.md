# Podsite Printing Reference

## Markdown Review Scope

Reviewed markdown sources under `podsite-Deploy`:

- `HANDOFF.md`
- `readme.md`
- `SKILLS.md`
- `AGENTS.md`
- `ANDROID_RELEASE_APK_STEPS.md`
- `linkdin.md`
- `Linkdinpost.md`
- `specs/001-secure-attendance-portal/*.md`

## Printing Architecture Summary

1. Browser path:
   - Uses `window.print()` flows for desktop/laptop printing.
2. RawBT path:
   - Android text print via `rawbt:` URL scheme.
   - Keep output text-only and compatible with CRLF formatting.
3. SH-Print path:
   - Native Bluetooth ESC/POS flow exposed through `PrinterSettings` Capacitor plugin.

## Key Files

Frontend:

- `src/components/TicketModal.jsx`
- `src/components/IdCardsModal.jsx`
- `src/styles/print.css`

Android plugin/service:

- `android/app/src/main/java/seniorcitizen/sbd/PrinterSettingsPlugin.java`
- `android/app/src/main/java/seniorcitizen/sbd/print/BluetoothPrinter.java`
- `android/app/src/main/java/seniorcitizen/sbd/print/EscPosEncoder.java`
- `android/app/src/main/java/seniorcitizen/sbd/print/Dithering.java`
- `android/app/src/main/java/seniorcitizen/sbd/print/PrintPreferences.java`
- `android/app/src/main/java/seniorcitizen/sbd/print/RawbtPrintService.java`
- `android/app/src/main/java/seniorcitizen/sbd/print/RawbtPrinterDiscoverySession.java`
- `android/app/src/main/java/seniorcitizen/sbd/print/PrinterSettingsActivity.java`

Android settings UI:

- `android/app/src/main/res/layout/activity_printer_settings.xml`
- `android/app/src/main/res/xml/rawbt_printservice.xml`

## Known Fixes To Preserve

1. SH-Print modal tap race:
   - Use deferred invocation in modal handlers (`setTimeout(..., 0)` pattern) to avoid no-op taps.
2. Long blank-tail print issue:
   - Avoid aggressive cut/feed behavior in native print plugin logic.
3. Platform behavior:
   - SH-Print is app-only.
   - RawBT path handles Android text print; browser path remains available for non-Android.

## Product Constraints From Specs

- Ticket output must align with 58mm thermal print constraints.
- Print mode must isolate ticket content and avoid non-ticket UI.
- Ticketing actions must remain tied to valid registrant/scan flows.

## Regression Checklist

1. Ticket preview and print layout remain 58mm friendly.
2. Android RawBT launch still works and payload formatting stays readable.
3. SH-Print triggers reliably from modal buttons.
4. No long blank tail on ticket/list prints.
5. Browser print still works for desktop users.
