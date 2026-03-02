# Finish RedByte — Complete Product Plan

**Date:** 2026-03-01
**Authority:** AI_STATE.md wins on all conflicts. Attribution: Connor Angiel only.
**Dev rules:** pnpm only • one commit per logical change • update AI_STATE.md per sprint • `pnpm verify:gates` must pass before any commit

---

## What "Finished" Means

RedByte is finished when:
1. Every student workflow (design → verify → export → hardware) works end-to-end with no known gaps
2. Lab curriculum for ECE141 labs 1–8 has starter presets + gates passing
3. The product is clean (no console leakage, no dead code, no temp clutter)
4. Deployment is stable (CI green, manual smoke passed, Cloudflare serving latest)
5. The IDE is self-explanatory to a first-time student without an instructor present

---

## Current Honest State

| Area | Status | Gap |
|---|---|---|
| Core simulation engine | ✅ Done | — |
| Design surface | ✅ Done | Minor polish (grid snap, multi-select wiring) |
| Verify surface | ✅ Done | Sequential parity with export not confirmed |
| Export surface (VHDL/XDC) | ✅ Done | Must block when IO incomplete; SSD mapping missing |
| Import surface (HDL→circuit) | ⚠️ Scaffolded | Actual VHDL/Verilog parser not implemented |
| Hardware surface | ✅ Done | 7-seg display abstraction missing |
| Project surface | ✅ Done | Lab starter presets missing for labs 4–8 |
| Learning overlays | ❌ Missing | No first-use guidance |
| Keyboard shortcuts panel | ❌ Missing | Shortcuts exist but not discoverable |
| Share link robustness | ⚠️ Partial | Clipboard fallback + decode error modal missing |
| CI/CD | ⚠️ Partial | E0 console budget breach; Linux flakiness |
| Repo hygiene | ❌ Needs work | ~500 tmpclaude-* dirs; dead apps not archived |

---

## Work Breakdown — Ordered by Dependency

---

### TRACK 0 — Repo Hygiene (Do First, Unblocks Everything)
*No gates can be trusted while temp dirs pollute the working tree.*

**0-A: Clean temp dirs from repo root**
- Delete all `tmpclaude-XXXX-cwd` directories from repo root (there are hundreds)
- These are leaked Claude working dirs and should never be committed
- Verify: `git status` shows clean after removal

**0-B: Fix E0 console leakage**
- Budget: 140 lines. Current: 770.
- Audit `packages/rb-apps/src` and `apps/playground/src` for `console.log/warn/error` calls
- Remove or gate behind `process.env.NODE_ENV === 'development'`
- Add a gate test that enforces the budget: `pnpm gates:console-budget`
- Verify: budget passes in CI

**0-C: Archive dead apps**
- Move `apps/lab3-webapp/` → `apps/archive/lab3-webapp/`
- Move `apps/studio/` → `apps/archive/studio/`
- Remove launcher shell (Route 3 in PRODUCT.md, slated for Milestone 7)
- Update `pnpm-workspace.yaml` to exclude archive apps from default builds
- Verify: `pnpm build:unified` still passes

---

### TRACK 1 — Backend / Engine Integrity

**1-A: Sequential verify → export parity (Lane A ship blocker)**
- Problem: `verifySchedule.ts` produces a PASS verdict for a sequential circuit, but the generated VHDL testbench may not exercise the same clocked schedule
- Fix: `testbenchGenerator.ts` must consume the exact same tick schedule used by `verifySchedule.ts`
- Add a gate: given identical circuit + vectors, Verify PASS must imply testbench PASS in Vivado-compatible simulation
- Gate file: `tests/gates/export-verify-parity-sequential.test.ts`
- Verify: `pnpm verify:gates` includes and passes this gate

**1-B: Export blocker for incomplete IO (Lane A ship blocker)**
- Problem: students can download a Vivado Kit even when pin assignments are empty, producing a useless `.xdc` with no pins mapped
- Fix: in `basys3ExportService.ts`, check that every declared input/output node has a corresponding pin assignment before allowing export
- If incomplete: return a structured error + surface a warning in ExportSurface with a "Map pins" CTA that navigates to HardwareSurface
- Gate: `tests/gates/export-io-completeness-gate.test.ts`

**1-C: 7-segment display (SSD) pin mapping (Lane A ship blocker)**
- Problem: Labs 3+ require 7-segment display output. The board profile has the 8 physicalidentifiers (CA–CG + DP + AN0–AN3) but there's no abstraction for treating them as a grouped "SSD" output
- Fix in `rb-board-profiles`: add `SevenSegmentDisplay` composite pin group type
- Fix in HardwareSurface: render SSD group with digit selector + segment mapping preview
- Fix in `basys3ExportService.ts`: emit correct VHDL segment assignment logic for SSD composite outputs
- Gate: `tests/gates/ssd-export-gate.test.ts` validate generated XDC has all 12 SSD pins

**1-D: HDL Import — VHDL/Verilog parser (Milestone 6)**
- Problem: ImportSurface exists but only loads `.rb-lab.zip` circuits; it cannot ingest HDL
- Fix: implement a structural VHDL parser in `packages/rb-apps/src/apps/ide/surfaces/import/`
  - Parse `entity` + `architecture` declarations
  - Map `port` signals to input/output nodes
  - Map `component` instantiations to gate nodes
  - Produce a valid `RBCircuit` graph
- Scope limit: structural VHDL only (no behavioral/process blocks in v1)
- Gate: `tests/gates/import-vhdl-roundtrip-gate.test.ts` — export from a known circuit, re-import, verify node/edge count matches

**1-E: Fix Linux CI flakiness**
- Labs 4 and 5–8 smoke tests fail intermittently on Linux runners
- Audit `tests/smoke/` for timing-dependent assertions and replace with deterministic event-driven waits
- Add `waitForSelector` / `waitForFunction` calls where `waitForTimeout` is used
- Verify: three consecutive green runs on CI

---

### TRACK 2 — Frontend Surface Completion

**2-A: Keyboard Shortcuts panel in Settings**
- Add "Keyboard Shortcuts" tab to Settings modal
- List all global shortcuts with their bindings, organized by surface
- Minimum set to document:
  - `Ctrl+Z` / `Ctrl+Shift+Z` — Undo/Redo
  - `Delete` / `Backspace` — Delete selected
  - `Ctrl+A` — Select all
  - `Ctrl+S` — Save project
  - `Ctrl+Shift+C` — Share circuit (playground)
  - `Space` — Pan canvas
  - `G` — Toggle grid snap
  - `Escape` — Deselect / cancel
  - `R` — Rotate selected gate
  - Number keys `1–8` — Quick palette selection
- Check for conflicts with browser defaults before documenting
- This closes the SHARE_POLISH_TODO.md item #4

**2-B: Share link robustness**
- Implement clipboard fallback modal when `navigator.clipboard.writeText()` fails
- Implement decode error modal with "Clear URL & Start Fresh" button when `?circuit=` param is invalid
- Add `hasLoadedFromURL` ref guard for idempotent URL ingestion
- Add loading spinner overlay during async circuit decode
- These are all documented in `SHARE_POLISH_TODO.md`

**2-C: Learning overlays — first-use onboarding**
- First time a student opens the IDE (no saved project), show a brief 3-step overlay:
  1. "Build" — point at the gate palette
  2. "Verify" — point at the mode tabs
  3. "Export" — point at export tab
- Use `localStorage` flag `rb-onboarding-v1-seen` to show once only
- Add "Skip" and "Next" buttons. No external dependencies.
- Keep overlay content in a static config object (not a CMS)

**2-D: Design surface — grid snap + alignment polish (Lane C)**
- Add `G` hotkey toggle for snap-to-grid (16px grid)
- Add alignment guides (snap to other gate centers while dragging)
- Add multi-gate alignment toolbar (align left/right/top/bottom/distribute)
- These improve circuit readability significantly for export/grading

**2-E: Verify surface — run context explainer (already partially done)**
- Confirm "Run context" block is rendered for sequential schedule scenarios
- Confirm trace log view shows clock edges clearly
- Add "Why did this fail?" inline explanation when a vector fails (show which signal diverged from expected)

**2-F: Project surface — lab starter presets for labs 4–8**
- Each lab in ECE141 needs a starter circuit: pre-placed I/O nodes, correct vector table scaffold, nothing else
- Create starter JSON files at `examples/lab4-starter.json` through `examples/lab8-starter.json`
- Wire them into ProjectSurface's "Start a Lab" gallery section
- Gate: each starter loads without console errors and has at least one input + one output node

**2-G: Hardware surface — debounce guidance**
- When a student maps a physical button (SW0–SW15) to a circuit input, show a callout:
  "Physical buttons bounce. Add a debounce delay or synchronize to clock edges for reliable behavior."
- Show only once per button assignment, dismissable
- Link to a debounce example circuit

---

### TRACK 3 — Marketing Site Completion

**3-A: Landing page content audit**
- Review `apps/manual-site/` for any placeholder/lorem content
- Replace with real product copy describing what RedByte does + who it's for
- Ensure "Open IDE" CTA links to `/os/`

**3-B: Lab guides on manual-site**
- The instructor guide and student quickstart (`INSTRUCTOR_GUIDE.md`, `CLASSROOM_QUICKSTART_STUDENT.md`) should be rendered at `/guides/`
- Build route in manual-site for `/guides/` → render markdown

**3-C: About / attribution page**
- Add `/about` page with project description and attribution (Connor Angiel, ©RedByte)

---

### TRACK 4 — Production Readiness

**4-A: CI all-green (5 GitHub Actions checks)**
- Quality Gate (build + test + lint)
- FPGA Bridge Proof
- Smoke Test (zip install)
- cloudflare-smoke
- Deploy to Cloudflare Pages
- Requires: Track 0 (console leakage), Track 1-E (Linux flakiness) done first

**4-B: Manual smoke run (15 min)**
- Execute the smoke sequence defined in `V1_RELEASE_STATUS.md`:
  1. Boot clean (no console errors)
  2. Virtual lab workflow (design → sim → export → download zip)
  3. Performance mode toggle
  4. Hardware dry-run
  5. Error boundary → Help path
- All 5 sequences pass = production-ready

**4-C: Milestone 7 cleanup (post-CI)**
- Delete shell component (`packages/rb-shell`)
- Rename `apps/playground` → `apps/ide`
- Rename `apps/manual-site` → `apps/marketing`
- Update vite configs, pnpm-workspace.yaml, build scripts
- Update PRODUCT.md + README to reflect new structure

---

### TRACK 5 — Quality Gates Completion

These gate tests need to exist and pass in `pnpm verify:gates`:

| Gate | File | Status |
|---|---|---|
| sim:repeatability | existing | ✅ |
| sim:loop-detection | existing | ✅ |
| rbproject:roundtrip | existing | ✅ |
| lab:export-verify-gate | existing | ✅ |
| export-verify-parity-sequential | **NEW** | ❌ |
| export-io-completeness | **NEW** | ❌ |
| ssd-export | **NEW** | ❌ |
| import-vhdl-roundtrip | **NEW** | ❌ |
| gates:console-budget | **NEW** | ❌ |
| lab-starter-load (labs 4–8) | **NEW** | ❌ |

---

## Execution Order (Sprint Map)

```
Sprint A  (Track 0)     Repo hygiene — temp dirs, console leakage, archive dead apps
Sprint B  (Track 1-A/B) Sequential parity + export IO blocker
Sprint C  (Track 1-C)   SSD pin mapping + hardware surface
Sprint D  (Track 2-A/B) Keyboard shortcuts + share link polish
Sprint E  (Track 2-C/D) Learning overlays + design grid snap
Sprint F  (Track 2-E/F) Verify explainer + lab starter presets
Sprint G  (Track 2-G)   Debounce guidance + hardware UX
Sprint H  (Track 1-D)   HDL import parser (VHDL structural)
Sprint I  (Track 3)     Marketing site content + guides + about
Sprint J  (Track 4-A/B) CI all-green + manual smoke run
Sprint K  (Track 1-E)   Linux CI flakiness (can run in parallel with H/I)
Sprint L  (Track 5)     All new gates written + passing
Sprint M  (Track 4-C)   Milestone 7 cleanup (rename, archive, delete shell)
```

Each sprint = one or more commits, each commit = one logical change.

---

## Definition of Done

- [ ] `pnpm verify:gates` — all gates pass including 6 new gates from Track 5
- [ ] `pnpm build:unified` — clean build, 0 warnings
- [ ] E0 console budget: ≤ 140 occurrences
- [ ] Export surface: blocked when IO incomplete
- [ ] Sequential verify PASS → testbench PASS (confirmed by gate)
- [ ] 7-segment display mapping works end-to-end
- [ ] Learning overlay shows on first launch
- [ ] Keyboard shortcuts discoverable in Settings
- [ ] Lab starters for labs 1–8 in gallery
- [ ] HDL import roundtrips a structural VHDL entity
- [ ] Marketing site has real content, no placeholders
- [ ] 5 CI checks green on latest main
- [ ] Manual smoke run passed (all 5 sequences)
- [ ] Temp dirs removed from repo root
- [ ] Dead apps archived
- [ ] AI_STATE.md updated after each sprint

---

## What Is Out of Scope (Intentionally)

- Real-time collaboration
- Cloud sync / remote storage
- Analog simulation / SPICE
- BOM export for breadboard builds
- LMS integration / auto-grading
- PDF schematic export
- Multiplayer circuit building

These are documented in PRODUCT.md as non-goals and will not block "finished" status.

---

*Plan owner: Connor Angiel. Written: 2026-03-01.*
