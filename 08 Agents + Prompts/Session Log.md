---
type: handoff
status: active
area: infrastructure
updated: 2026-04-26
related:
  - "[[Session Startup Checklist]]"
  - "[[Session Shutdown Checklist]]"
  - "[[RedByte Engineering Brain]]"
---

# Session Log

Rolling handoff log. **Add new sessions at top. Remove oldest when count exceeds 5.**

Format: `## YYYY-MM-DD — [one-line summary]`  
Use the [[Session Template]] to generate the raw content; paste the "End of session" block here.

---

## 2026-04-27 — Product audit + Project Bridge vocabulary scrub

**What changed:**
- Full product-use audit of all 5 surfaces (Project, Design, Verify, Map Pins, Export) — walked live app and read source
- Committed `4480ad77`: Project Bridge vocabulary scrub — removed "Project Bridge" label, determinism hash from header, Simulation top, Target part, Scenario authority rows, hash from Verify/Export fields, Import fidelity field when native, "Project Hash:" from status bar
- Updated `docs/ACTIVE_WORK.md` — Priority 1 reflects Slice A done, next slice is Verify pre-run empty state
- 47 tests green across all project surface suites; `verify:gates` exit 0

**What is true now:**
- Project surface now shows students only: project name, kind label, hardware readiness pill, Target board, Verify status, Export status — all signal, no developer noise
- Status bar no longer leaks determinism hash in any non-design mode
- Import fidelity is only surfaced for non-native imports (reconstructed / partial) where it's actionable

**What is still open:**
- Verify pre-run empty state: right waveform panel (884px) is blank before first run — reads as broken layout
- Verify post-run command bar: 15+ data items crammed into 47px strip
- `window.confirm()` for Reset/Restore actions blocks browser thread (spawned as separate task)
- E2/E3 matrix rows for `golden-basys3-switch-and` and `signal-tour` (need connected bench)

**Exact next action:** Open `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx` — find the pre-run right panel (waveform region, `ide-verify-waveform` or similar). Currently empty before any run. Add a "Run to see waveform" placeholder or instruction panel in that space. Check `docs/ide/03-verify.md` for the current spec before changing layout.

---

## 2026-04-26 — Control Tower v1 committed + origin synced

**What changed:**
- Control Tower v1 committed (`c7500702`): ACTIVE_WORK.md cockpit, Session Template, Support Matrix, Session Log, Engineering Brain WIP board, Claude Session Mode frontmatter docs
- Rebased clean onto origin/main (2 commits: one-click startup hardening `408d4846`, branch-protection debt note `e8fd751e`)
- Repo is now clean, linear, and synced with origin

**What is true now:**
- `docs/ACTIVE_WORK.md` is the daily cockpit — imported by `CLAUDE.md` at every agent startup
- OS-era docs self-declare as SUPERSEDED at line 1; 18 canonical docs have `doc_status: current` + `used_by_claude: true` YAML frontmatter
- One-click startup: `pnpm start` or `run.bat` launches RedByte locally (Vivado 2024.2 path hardened)
- RC1 posture unchanged: `two-bit-counter` E1+E2 (live bench). `golden-basys3-switch-and` + `signal-tour` E1 only.

**What is still open:**
- E2/E3 matrix rows for `golden-basys3-switch-and` and `signal-tour` (need connected bench)
- BUG-003: React 19 / testing-library incompatibility (pre-existing)
- Branch protection not yet configured (tracked in AI_STATE.md)

**Exact next action:** On connected bench — run `pnpm lab:vivado:hw-probe`, then program `golden-basys3-switch-and` `.bit`, observe LD0 behavior, log to `out/vivado-cert/vivado_program_golden_and.log`.

---

## 2026-04-26 — Repo operating system reset + Vivado/hardware hardening

**What changed:**
- `CLAUDE.md` rewritten as repo constitution (truth hierarchy, @imports `docs/ACTIVE_WORK.md`)
- `docs/ACTIVE_WORK.md` created as bounded work queue
- `docs/DOC_INDEX.md` updated — stale zone declared, active links at top
- 22 OS-era docs marked SUPERSEDED/HISTORICAL (00-canon/00-08, STUDENT_WORKFLOW, smoke checklists, etc.)
- Vivado export fidelity hardened (`be52fb09`), security-lock import/export consolidated (`845cffdd`), board clock semantics reset (`69e89999`), Basys3 board planner truth locked (`047291c1`)

**What is true now:**
- OS-era docs no longer compete with current truth — they self-declare at line 1
- CLAUDE.md loads ACTIVE_WORK.md at startup via @import
- RC1 posture: `two-bit-counter` has E1 + E2 (live bench). `golden-basys3-switch-and` + `signal-tour` have E1 only.
- Board clock: CLK100MHZ→W5 is canonical. `CLOCK_BUFFER_TYPE NONE` on switch inputs.

**What is still open:**
- E2/E3 matrix rows for `golden-basys3-switch-and` and `signal-tour` (need connected bench)
- BUG-003: React 19 / testing-library incompatibility (pre-existing)

**Exact next action:** Run `pnpm verify:gates` to confirm green baseline, then continue E2/E3 matrix completion on connected bench.

---

## 2026-04-15 — Verify sequencer step-editor + Map Pins structured V2

**What changed:**
- Verify manual-event step editing: inline update, reorder, delete (was append-only)
- `scenario.steps[]` now drives deterministic compatibility vectors for replay/verification
- Map Pins: `hardwareMappingV2` stack (scalar/bit/slice/bus/group) exposed
- `applyHardwareMappingEdit` runtime action: structured mutations re-project into `projectIoRows`
- 4 files, 41 tests green (Map Pins editor + Hardware surface + persistence/export guard)

**What is true now:**
- Verify step authoring is runtime-backed; typed fields for target/value/expected/label/duration/pulse
- Map Pins structured mutations stay canonical through verify/export dirty semantics

**What is still open:**
- Design/HDL-linked guided pickers for bus/slice (so structured entries can't drift from real ports)
- Verify kind-specific step polish once Map Pins structured truth is stable

**Exact next action:** Add Design/HDL-linked guided pickers for bus/slice creation on Map Pins.

---

## 2026-04-14 — Hardware/Export mapping authority + Lab 8 classroom readiness

**What changed:**
- [[BUG-018 Hardware Export Mapping Authority Drift]]: blank/custom Hardware opens on Map Pins with Design-first guidance; mapped starter flows no longer hide required-port gaps behind contradictory status; Export no longer ghosts `rst_btnc` or disables valid EN/RST rows
- Basys3 binding refs anchor the shared alias story across Export validation + entity-based testbench
- Lab 8 Verify: explicit reset rows + authored `ENTER` 0,1,0 pulses shipped; students can run invalid and valid traces in ordinary IDE Verify
- Lab 8 exports: `CLOCK_BUFFER_TYPE NONE` on SW5, `set_false_path` timing suppression for switch/button-driven latch paths
- 3 test files, 30 tests green (Export + Hardware surface); 2 test files, 66 tests green (Lab 8)

**What is true now:**
- Lab 8 starter Verify is preloaded and runnable without importing an empty vector table
- Hardware/Export authority is coherent on both blank-origin and starter-load paths

**What is still open:**
- One browser contract/gate for blank/home → Signal Tour → 2-Bit Up Counter mapping/export trust path

**Exact next action:** Add browser contract gate for classroom student paths if risk remains; otherwise resume next highest product-risk slice.

---

## 2026-04-13 — Hard visual architecture + Verify workspace recovery

**What changed:**
- Project reads as workflow front door (two deliberate start lanes; loaded = one current-focus hero)
- Design: right rail flattened to Selection → inline facts → Actions → Live/Signal State → Details
- Verify: command bar = sole session authority; left dock = Signal guide; waveform = primary evidence
- [[BUG-016]] fixed: Verify workspace grid collapse recovered (629px stimulus / 681px waveform)
- [[BUG-017]] fixed: shared compact workbench row theft resolved
- 8 files, 134 tests green; `http://127.0.0.1:4179/os/` browser validation complete

**What is true now:**
- Shell geometry changes must be tied to measured browser-visible regressions, not surface-local CSS guesses
- Verify uses one full-width lab frame with inner lab grid owning stimulus/waveform split

**Exact next action:** Keep future Verify layout work tied to measured browser-visible regressions.
