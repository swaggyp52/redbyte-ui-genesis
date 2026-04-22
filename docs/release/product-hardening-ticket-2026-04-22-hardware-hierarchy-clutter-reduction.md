# Product Hardening — Hardware hierarchy & clutter (2026-04-22)

## Ticket

- **Title:** PHASE 7 — Hardware hierarchy + clutter reduction
- **Date:** 2026-04-22
- **Surface:** IDE → Hardware (student-facing)
- **Disposition:** In progress / fixed in local slice (see git closeout in session report)
- **Primary student question addressed:** *Within seconds, can I see whether Verify → Export → Program is on track, without digging into a collapsed console?*

## Runtime scenarios (evidence from code + shell inspection)

| Scenario | Route / path | Student goal | What surfaced first (before fix) | Friction | Primary product issue |
|----------|--------------|-------------|-----------------------------------|----------|------------------------|
| **A — First visit** | `currentMode === 'hardware'` in `IdeApp` (no hash required for mode) | See board status and what to do | Panel title, command strip with dense meta chips, stage rail, then board | **Workflow chain + readiness lived in the bottom “Hardware Console” while `consoleMode` was collapsed** | Readiness and dependency order were not in the first visual scan of the workbench |
| **B — Mapping incomplete (from Project/Export)** | Same; Map Pins tab / `map` initial mode when pins missing | Know Project owns typing; quick-assign is secondary | `mapDock` + long “Board view — same mapping as Project” callout + stage caption | Repeated authority copy (dock + callout) | Hierarchy: explanation competes with action |
| **C — Board / bridge** | `ioBus` live state in inspector; no separate “bridge” string in this surface | Is connection healthy? | Live table when not in `map` mode | “Bridge” is implied via transport, not a single headline (acceptable for this slice) | Optional follow-up: clearer connected/disconnected line |
| **D — Ready to continue** | `bringup` / `proof` / primary CTA in command strip | Obvious next step | CTAs in strip + many callouts (drift, starter seal, SSD, debounce) | Multiple panels compete | Secondary: demote non-blocking teaching callouts when possible |

## Hardware blocker register (max 5)

1. **Severity: high** — **Workflow + readiness hidden in collapsed console**  
   - **Workflow:** Any student opening Hardware.  
   - **Evidence:** `IdeSurfaceLayout` used `consoleMode="collapsed"`; dependency strip and `ide-hardware-readiness-callout` were only in `console` slot.  
   - **Root cause:** Shell defaults prioritized a minimized console; students rarely expand it, so the clearest “1 → 2 → 3” story was off-screen.  
   - **Why it matters:** Violates the “runtime truth in view” and “action vs status” rules for the bring-up path.  
   - **Action taken (this slice):** Hoist dep chain + readiness into main panel (`ide-hw-workflow-ribbon`); set `consoleMode="hidden"` for Hardware.  

2. **Severity: medium** — **Duplicate / dense meta in command strip** (status pill + chips).  
   - **Workflow:** Scannability of blocked vs ready.  
   - **Action:** Defer: trim or collapse meta row in a follow-up.  

3. **Severity: medium** — **Project authority explained twice** (map dock + map callout).  
   - **Workflow:** Map incomplete from Project/Export.  
   - **Action:** Defer: collapse long callout behind “Why?” disclosure.  

4. **Severity: low** — **Stage caption verbosity** in `hardwareStageCaption` for `map` when pins missing.  
   - **Action:** Defer: shorten to one classroom sentence + CTA.  

5. **Severity: low** — ** teaching callouts** (7-seg, debounce) stack above the board.  
   - **Action:** Defer: show only in relevant stage or behind disclosure.  

## Chosen top blocker

**#1 — Workflow and readiness not visible in the primary workspace (collapsed console).** Fixed by moving the Verify → Export → Program chain and the readiness callout into the main Hardware panel and hiding the unused bottom console for this mode.

## Files touched in slice

- `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx`
- `packages/rb-apps/src/apps/ide/ide-root.css`
- `packages/rb-apps/src/apps/ide/__tests__/hardwareSurface.readiness.test.tsx` (assertions + explicit `afterEach(cleanup)` for stable RTL runs)

## Validation (session)

- `pnpm --filter @redbyte/rb-apps exec vitest run src/apps/ide/__tests__/hardwareSurface.readiness.test.tsx` — pass (19 tests)
- `pnpm build:unified` — pass

## Attribution

Connor Angiel (product + implementation session)
