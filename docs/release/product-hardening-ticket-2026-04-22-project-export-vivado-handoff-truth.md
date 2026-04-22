# Product Hardening — Project / Export / Vivado handoff truth (Campaign E)

- **Title:** Project + Export readiness agreement + Vivado handoff clarity
- **Date:** 2026-04-22
- **Owner:** Connor Angiel
- **Surface:** Project, Export (Vivado path)
- **Journey:** Map pins → Verify → Export bundle → Vivado / board

## Problem

- Students can read **“export available”** on Project while Export still requires **Build Current Bundle** (no successful bundle yet).
- Vivado steps exist but the **file-level story** (what the ZIP is for) can feel secondary to internal gate jargon.

## Blocker register (max 5)

| Sev | Title | Affected | Evidence | Root | Action |
|-----|-------|----------|------------|------|--------|
| P0 | “Export available” without a built bundle | Project → Export | `exportAvailable` true when `lastExport` undefined | naming vs `hasSuccessfulExportBundle` | Map-pins + hero copy: “not built yet” vs “stale rebuild” |
| P1 | Vivado handoff is procedural but not file-centric | Export success / ready | “Open in Vivado” subcopy | copy order | Add explicit RTL/XDC/xpr/what-next line |
| P2 | Internal gate labels vs student goals | Export | (deferred) | — | follow-up |
| P3 | workflowTruthRows dead path | n/a | unused memo | (deferred) | no change this slice — avoid scope creep |

## Acceptance

- [x] Project **Export readiness** blurb (Map Pins header) matches **no bundle / stale** semantics vs `hasSuccessfulExportBundle`.
- [x] Export “Open in Vivado” includes **key files** + what “ready for Vivado” means; hero status on Project distinguishes **no bundle** vs **stale bundle**.
- [x] `ide:gate:export-ready-contract` updated for current DOM (`<details>` gates, `ide-export-artifact-preview`).
- [x] Focused vitest + `pnpm build:unified`.

## Disposition

- **Status:** fixed (this pass)
- **Commits:** (see `AI_STATE.md` Change Log 2026-04-22 Campaign E)

## Attribution

Connor Angiel
