# SHIP_RECEIPTS: Website Cleanup — Removing all Install/Download UX

## Summary

The direct PowerShell installation path is currently broken (hosting issues). Site-wide UX has been purged of installation call-to-actions to prevent user confusion. The only outbound "Install-ish" path is now the GitHub repository.

## Files Changed

- `apps/manual-site/src/components/layout/Header.tsx`: Removed "Install" nav link and "Install OS" button; added "View on GitHub" CTA.
- `apps/manual-site/src/components/layout/Footer.tsx`: Removed installation-adjacent links.
- `apps/manual-site/src/pages/Install.tsx`: Converted to "Temporarily disabled" placeholder page.
- `apps/manual-site/src/pages/GettingStarted.tsx`: Purged "Installation", "Prerequisites" (local), and "Troubleshooting" (CLI) sections.
- `apps/manual-site/src/pages/Instructors.tsx`: Removed bootstrap/CLI command blocks and hardware-specific failure troubleshooting.
- `apps/manual-site/src/pages/Home.tsx`: Removed "no install" and download-adjacent phrasing.
- `apps/manual-site/src/pages/Examples.tsx`: Removed "Download RedByte" section.
- `apps/manual-site/src/pages/Demo.tsx`: Removed "Install OS" bottom CTA and hardware programming status items.
- `apps/manual-site/src/content/mvpFacts.ts`: Redacted `bootstrapCommand`, `bridgeCommandHardware`, and `bridgeCommandSim`.

## Routes Affected

- `/install`: Now shows a "Temporarily disabled" message with a link to GitHub.
- All other pages: No visible "Install" or "Download" buttons.

## Keyword Verification Results

- `Grep "Install"`: Only appears in component names, the disabled placeholder message, and educational context ("no installation required").
- `Grep "Download"`: 0 hits in public CTAs; remains only in `GuidedTour` text referring to demo site behavior.
- `Grep "pnpm", "iwr", "bootstrap.ps1"`: 0 hits in rendered UI tags.

## Acceptance Tests

- [x] Nav links verified.
- [x] Route placeholder verified.
- [x] Command blocks purged.
- [x] Build Passed: `vite v5.4.21 building for production... ✓ built in 3.67s`
