# Product Hardening Ticket — Dual mapping UI authority clarity (Phase 3b)

## Ticket

- **Title:** Project vs Hardware Map Pins — one authority story
- **Date:** 2026-04-22
- **Owner:** Connor Angiel
- **Surface:** Project, Hardware, Export (handoff labels)
- **Journey segment:** Map Pins / board prep / export recovery
- **Environment:** Playwright `ide-mapping-pipeline-coherence`; Vitest `hardwareSurface.readiness`, `projectWorkflowAuthority`
- **Linked GitHub issue:** #77 (recovery thread)

## Runtime scenarios

| # | Path | Observation (pre-fix) |
|---|------|------------------------|
| **A** | Hardware first with incomplete mapping | Left dock titled **Map Pins** (peer to Project); hero **Open Map Pins** only switched **Hardware** map tab — label implied Project workflow |
| **B** | Project → Hardware | Main callout already mentioned Project; dock still said **Map Pins** with no primary framing |
| **C** | Export blocked → recovery | Gate CTAs already improved in **a44ee625**; shared `map-pins` intent still said **Open Map Pins** while **Export** `handlePrimaryHandoff` jumped to **Hardware** only |

## Narrow blocker register

| Sev | Title | Confusion | Evidence | Root cause | Next action |
|-----|-------|-----------|----------|------------|-------------|
| **SEV-2** | **“Open Map Pins” meant “stay on Hardware”** | Student expects Project table | Hero + blocked CTA label vs `setHwMode('map')` only | Product language says **Map Pins** (spine name) but action never leaves Hardware | **Primary:** `onGoToProject` when wired; label **Open Project — Map Pins**; secondary board view optional |
| SEV-3 | Dock header **Map Pins** | Looks like second primary editor | `ide-hw-map-dock` h3 | Same label as Project section / spine | Rename dock to **Pin readiness** + one-line authority |
| SEV-3 | Stage caption “Assign every… click board” | Board-first | `hardwareStageCaption` | Copy prioritized click-board over Project | Lead with **Project → Map Pins** |

## Chosen blocker

**SEV-2 — “Open Map Pins” on Hardware meant “stay on this surface’s map tab,”** not “open the Project pin table.” **`map-pins` handoff** used the same label while **Export** routed to **Hardware** only. Students experienced **two peer editors** (Project Map Pins vs Hardware Map Pins) with **misleading navigation language**.

## Fix summary

- **`deriveHardwareExportFailureTruth`:** `map-pins` CTA label → **Open Project — Map Pins**; copy names **Project → Map Pins** first.
- **`ExportSurface`:** `handlePrimaryHandoff` **`map-pins`** → **`onGoToProject` first**; IO incomplete callout primary button → Project when wired (small mixed-EOL surgical patch).
- **`HardwareSurface`:** Blocked/advisory **`map-pins`** intent → **`onGoToProject` when set**; next-action hero when mapping incomplete → **primary Project**, secondary **Board quick-assign view**; left dock title **Pin readiness** + authority line; stage caption + dock hint + board callout reframed; export repair copy says **Project → Map Pins**.
- **`ProjectSurface`:** Map Pins subcopy — **main place to type pin codes** + Hardware reads same table.
- **CSS:** Dock header stacks subtitle cleanly.

## Disposition

- **Status:** fixed in slice
- **Commit:** `eb0c69911c23d000b16c0fa837928a3116d471fb` — `fix(ide): Phase 3b — Project-first mapping authority (Hardware/Export)` on `main`

## Attribution

Connor Angiel
