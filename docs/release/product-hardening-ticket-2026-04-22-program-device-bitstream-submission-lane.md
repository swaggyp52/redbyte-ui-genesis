# Program device / bitstream / submission (Campaign F)

- **Date:** 2026-04-22
- **Owner:** Connor Angiel
- **Surfaces:** Hardware (board workflow), related Export/Verify handoff

## Blocker register (max 5)

| Sev | Title | Impact | Action (this pass) |
|-----|--------|--------|---------------------|
| P0 | **"Build a bitstream" in Map stage** — RedByte only exports a Vivado project, not a `.bit` | Map caption misled about toolchain boundary | **Fix copy** in `hardwareStageCaption` (map) |
| P0 | **Program CTA implied `.bit` in hand** — "Open the .bit" sounds like a file from RedByte | Pre-flight / proof CTA | **Fix copy**: ZIP → synthesize in Vivado → **then** .bit + Hardware Manager |
| P1 | **Step 3 "✓ Ready"** vs board not programmed | Ribbon overclaims | **Relabel** to "✓ In Vivado" (or "Handoff ok") when handoff is clear |
| P2 | **No submission / lab expectations** | Students guess what to turn in | **Add** `ide-hardware-submission-hint` when handoff is clear |
| — | (deferred) Full proof bundle UX | — | Out of scope |

## Acceptance

- [x] Map and proof captions distinguish **export ZIP** (RedByte) from **bitstream** (Vivado).
- [x] Program handoff explains **Vivado generates** the `.bit` after **Generate Bitstream**.
- [x] Optional: ribbon step 3 status text; submission hint.
- [x] `hardwareSurface.readiness` (or related) + `pnpm build:unified`.

## Disposition

- **Status:** **fixed** (slice 1 — readiness boundary + submission hint)
- **Record:** single local commit, message `fix(ide): Campaign F — Vivado/bitstream boundary + program handoff truth` (use `git log -1` on this branch for SHA)
- **Slice type:** student-facing
- **Upstream risk:** **low** (localized `HardwareSurface` + readiness tests + docs)
- **Likely conflicts:** `HardwareSurface.tsx`, `hardwareSurface.readiness.test.tsx` if main touches Hardware/ribbon simultaneously
- **Re-land:** re-apply the same copy/test expectations; run `vitest` on readiness + `pnpm build:unified`

## Attribution

Connor Angiel
