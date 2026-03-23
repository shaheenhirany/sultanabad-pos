---
name: podsite-printing-implementation
description: Implement, debug, and validate Podsite printing features across browser print, RawBT Android printing, and SH-Print native plugin flows. Use when changing ticket/list print layouts, fixing print button behavior, updating Android print service/plugin code, or validating 58mm thermal print output.
---

# Podsite Printing Implementation

## Overview

Use this skill to make printing changes safely in the Podsite project. Keep behavior aligned across web print, RawBT text printing, and SH-Print native Bluetooth ESC/POS printing.

## Workflow

1. Confirm which path is affected: `web`, `rawbt`, or `sh-print`.
2. Read `references/printing-reference.md` for file map, constraints, and known fixes.
3. Apply smallest possible change in the relevant frontend or Android files.
4. Validate with the checklist below before concluding.

## Path Selection

- Use `web` path when the request is desktop/laptop print preview (`window.print()`).
- Use `rawbt` path when Android text print is sent via `rawbt:` scheme.
- Use `sh-print` path when using native plugin calls (`PrinterSettings` Capacitor plugin).

## Implementation Rules

1. Keep RawBT output text-only and CRLF-friendly; do not add image/QR assumptions.
2. Keep SH-Print button handlers async-safe for modal interactions.
3. Avoid introducing extra feed/cut behavior that creates long blank tails.
4. Keep ticket printing isolated to ticket content and preserve 58mm print constraints.
5. Preserve fallback behavior: Android print path + web browser print path.

## Validation Checklist

1. Browser print preview renders ticket/list content without extra UI noise.
2. RawBT launch works on Android and text formatting stays readable.
3. SH-Print button triggers once per tap and actually prints.
4. No long blank tail after list/ticket prints.
5. Changes do not break ticket/scan flows tied to print actions.

## Commands

Use these from the project root:

```powershell
rg -n -i "print|rawbt|PrinterSettings|window.print|TicketModal|IdCardsModal" src android
npm run build
```

## References

- Read `references/printing-reference.md` for:
  - markdown review summary used to build this skill
  - printing architecture and file touchpoints
  - known fixes and regression checklist
