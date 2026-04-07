---
type: architecture
status: active
area: infrastructure
updated: 2026-04-07
related:
  - "[[Claude Session Mode]]"
  - "[[Canonical Notes Policy]]"
  - "[[Note Schema]]"
  - "[[Verify Engine]]"
  - "[[2026-03-25 Verify Refactor Plan]]"
---

# RedByte Engineering Brain

---

## What is broken right now

BUG-003 is closed. The `React.act` crash documented there no longer reproduces in the current repo state.

```dataview
TABLE area, priority, status
FROM "05 Bugs"
WHERE status = "open" OR status = "investigating" OR status = "blocked"
SORT priority DESC
```

---

## What system am I working in?

Pick one - this is your workspace for today:

| Mode | Open these notes |
|---|---|
| **Verify Debug** | [[Verify Engine]] - [[Verify Hint System]] - `05 Bugs/` (verify area) |
| **Export + Vivado** | [[Connection Model]] - [[Export Contracts]] - [[Basys 3 Mapping]] |
| **Architecture + Planning** | [[Canonical Notes Policy]] - `04 Decisions/` - this dashboard |

Full routing details: [[Workspace Routing]]

---

## What Claude should read before acting

Always:

- [[Canonical Notes Policy]] - before creating any note
- [[Note Schema]] - before writing any Properties block
- [[Claude Session Mode]] - if this is a new session

For verify work: [[Verify Engine]] + [[Verify Hint System]]
For export work: [[Connection Model]] + [[Export Contracts]]
For project workflow / onboarding work: [[Project Surface]]
For test work: [[Test Infrastructure]]
For Design workflow hierarchy work: [[Design Surface]]

---

## What is the next action

**Runtime hardening moved from planning into closure work.**

Completed in this batch:

1. fixed the failing `ide-verify-workbench-contract` gate by opening the left verify dock before querying signal rows
2. fixed pipeline strip drift so Map Pins now shows `pass` when required mapping is complete (`RBP1001` absent)
3. captured runtime issue board at `docs/roadmap/RedByte_Runtime_Issue_Board_2026-04-02.md`
4. fixed RIB-003 so PASS waveform now shows mapped input stimulus lanes by default
5. fixed RIB-004 by making the Import ZIP file input intrinsically hidden in markup (no CSS-only hiding dependency)
6. fixed RIB-007 by exposing first-look quick sample demos (including blocked behavioral examples) without hidden workbench-only navigation
7. fixed RIB-008 by aligning first-look manual-path guidance copy with the now-visible quick-demo actions
8. fixed RIB-009 by wiring the behavioral-import blocker CTA to actual Design navigation (label/route contract now truthful)

Immediate sequence:

1. clean-tree classroom signoff is now confirmed (`CLASSROOM_READY`)
2. continue remaining product-hardening slices from gap audit / product contract tracks, not generic chrome work
3. keep runtime board current as new live defects are discovered

Pre-lab audit override (2026-03-29):

- Do not spend the next batch on more Design chrome polish until the student path is trustworthy.
- Completed in this batch:
  - loaded blank-origin projects now use truthful `Fresh Project` framing instead of `Blank Project`
  - boundary IO rows now normalize to student-facing labels (`Input N` / `Output N`) and restored vectors rekey to those sanitized ids
  - draft Verify trace sessions now frame the work as a runnable testbench instead of generic simulation
  - Verify first-run CTA readiness now follows the real vector authority, so custom-vector sessions no longer hide the primary run action
  - classroom signoff harness now exports shared starter loading, idle Design keeps `Live Simulation` directly reachable, and repo-status gate contracts have been realigned to current product truth
  - `node .\scripts\repo-status.mjs` now returns `39/39 checks passed`, and `pnpm -s classroom:signoff --allow-dirty` now returns `10/10 checks passed` / `CLASSROOM_READY`
- Remaining pre-lab blockers confirmed by live audit + signoff:
  - live hardware remains unproven in this environment (`classroom:hw:check` reports bridge unavailable / Basys3 unknown)
  - strict clean-tree classroom signoff still needs a clean working tree before operator use without `--allow-dirty`

Pre-lab must-fix order:

1. live Basys3 rehearsal on the actual bridge/toolchain setup
2. rerun `classroom:signoff` from a clean working tree before release / classroom handoff

Canonical next-phase roadmap:

- `docs/roadmap/redbyte-classroom-gap-handoff.md`

Gap audit and product contract (2026-04-01):

- `docs/roadmap/RedByte_Gap_Audit.md` — brutally honest product-legitimacy audit. 14 gaps identified, scorecard produced. Screenshot freeze: **not approved**.
- `docs/contracts/RedByte_Product_Contract.md` — target-state blueprint defining what RedByte must become. Separate from the current-state Product Manual.
- Two-layer truth model established: current-state docs (manual, traceability, conformance) stay factual; target-state docs (product contract) stay aspirational but testable.
- Key findings: README claims OS-era features (3D editing, time-travel debugging). Manual overclaims 6+ non-existent features. Sequential path boundaries (falling-edge, multi-clock, active-low reset) are detected but not blocked. Design-time circuit errors (driver conflicts, combinational loops, floating drivers) only surface at export time.

P6 verify workflow legitimacy — Phase 6A landed (2026-04-01):

- Assertion mismatches now keep the student in Verify first. Fail-state CTAs expose `Edit expected outputs` from both the fail hero and mismatch panel.
- `Open in Design` remains available for live logic defects, but it is no longer the only recovery path for assertion-backed failures.
- Stale verify evidence remains explicitly distinct from failure. Stale authored references stay on rerun / re-author / keep-reference actions rather than collapsing into generic FAIL guidance.
- Unsupported verify setups remain design-side problems and continue to surface an `Open Design` recovery path instead of pretending the testbench is fixable in Verify.
- Targeted render coverage now guards: Verify-first mismatch recovery, stale-state messaging, unsupported routing, and sequential timing guidance.

P6 waveform / oscilloscope legitimacy — first slice landed (2026-04-01):

- The assertion overlay now inherits the live waveform `tickWidth`, so zooming the oscilloscope no longer leaves expected/observed cells on a stale 48 px grid.
- Fail-window investigation now renders the assertion overlay against `zoomedTicks`, not the full timeline, so the evidence panel describes the same visible window as the waveform itself.
- Targeted coverage now guards both parts of this contract: AssertionCanvas runtime geometry and VerifySurface fail-window tick sync.

P6 waveform / oscilloscope legitimacy — second slice landed (2026-04-01):

- The waveform frame now removes redundant chrome bands: no signal digest strip, no in-frame tick explainer, no legend strip, and no cursor readout table competing with the traces.
- The idle ghost viewport now sizes to the real container width and drops the fixed-width `ARMED · AWAITING RUN` treatment.
- Fail-window emphasis is stronger directly in the scope, so mismatch regions are easier to spot before opening any side panels.
- Targeted workstation coverage now guards the subtractive chrome contract so those bands do not quietly reappear.

P5 design editor legitimacy landed (2026-04-01, commit 006c571c):

- **Drag undo granularity fixed**: RAF-batched node moves now use `isIntermediate: true`, skipping `emitCircuitMutation`. New `handleNodeMoveCommit` fires once at pointer-up (cancels pending RAF, commits with `isIntermediate: false`). One undo entry per drag, not ~120.
- **Wire preview aligned to port**: Preview line now starts at ±24 world-unit port offset (uses `isInputPort()` from wireValidation.ts) instead of node body center.
- **Deletion feedback counts cascade wires**: Keyboard Delete shows "Removed 2 nodes and 5 wires." via `onDeleteFeedback` prop wired to `setActionToast` in DesignSurface.

P6 export/hardware legitimacy — GAP-007 closed (2026-04-01, commit 7e152e14):

- **Export header pill now three-state**: `exportTrusted → Ready (green)` / `downloadReady && !trusted → Available (warn)` / `blocked → Blocked (error)`. No longer shows green "Ready" when verify has not passed.
- **Callout title/body per-state**: "Verify has not run" / "Verify is stale" / "Assertions differ" with specific, plain body text. Was generic "advisory compare state".
- **8 new tests** in `projectHealth.test.ts`: all four verify states via `deriveProjectVerifyState` + `hasCurrentPassingVerify` authority contract.

P6 export/hardware legitimacy — initial slice landed (2026-04-01, commit 404c44a8):

- **Preview README rewrite**: `basys3Bundle.ts:buildReadme` was describing a manual "Create new RTL project" Vivado setup that does not match the actual ZIP format (a pre-configured project folder). Now describes the correct "Open Project" workflow with the right artifact list. Golden SHAs for both golden export tests regenerated.
- **Tool version aligned**: ExportSurface was showing `Vivado 2024.1+` while the project folder targets `2024.2+`. Fixed display string.
- **Test ID dedup**: `ide-export-vivado-command` was on 4 elements across 3 render branches; now only on the actual command element.
- **Regression test**: `basys3-bundle-gate.test.ts` now asserts README contains "Open Project" and not "Create a new RTL project" (5/5 passing).
- Remaining open: GAP-013 (live Basys3 rehearsal proof). GAP-014 clean-tree discipline is validated; current clean-tree signoff blocker is bounded to repo-health execution timeout (`pnpm -s repo:status` hit the 600000ms signoff command timeout), not dirty-tree ambiguity.
- GAP-014 mitigation landed: `classroom:signoff --allow-dirty` is now explicitly degraded (`DEV_BYPASS_ONLY`) and can no longer emit `CLASSROOM_READY`.

Gap audit updated: Phase 6 initial slice complete. Next: Phase 6 remaining (GAP-007, 008, 013, 014).

P4 design-time canvas health landed (2026-04-01):

- README.md — complete rewrite removing OS Genesis branding, 3D editor claims, time-travel debugging, automatic bug localization, wrong dev commands, wrong test count (433→220), Student Portal URL, Logic Playground workflow. Replaced with accurate six-surface IDE description.
- Product Manual — removed 6 overclaims: Export Grading Report, verify replay, FPGA Bridge troubleshooting section, RB Lab ZIP section, LogicPlaygroundApp/LabWorkspaceApp as standalone contexts. Fixed undo history 50→100 levels. Expanded keyboard shortcuts from 5 to 24 (3 sections verified against KeyboardShortcutsModal.tsx).
- Print HTML — matching changes to HTML companion.
- DOC_INDEX.md — complete rewrite. Two-layer truth model documented. Stale/OS-era docs explicitly marked. Product contract + gap audit sections added.
- Note Schema — added `hardware`, `import`, `project` to area field values.
- Canonical Notes Policy — added ADR-002, 5 missing architecture notes, product contract section.

Next: P1 sequential boundary enforcement / trust restoration (not visual polish).

Latest completed documentation work:

- `2026-04-01` — Product manual hardened to verified state. 9 factual corrections applied to both `.md` and `.html`. PDF regenerated (408 KB). 6 architecture SVG diagrams created. Traceability matrix (49 claims), conformance governance doc, and claim audit doc produced. Manual wired into README.md and DOC_INDEX.md. `pnpm docs:manual:pdf` build script added.

  Corrections applied (source-verified):
  - `constraints.xdc` → `top.xdc` (basys3Bundle.ts L191)
  - `top_tb` → `tb_top` (testbenchGenerator.ts L292-293, vivadoProjectFolder.ts L36)
  - "Write HDL" → "Paste HDL" (ImportSurface.tsx L1990)
  - "up to 7 hints" → "14 diagnostic conditions" (verifyHints.ts L48-121)
  - NOR/XNOR removed from active palette list; noted as type-defined but unregistered
  - COMPONENT_MAP: "26 types" → "37 HDL name variants → 9 node types"
  - VHDL keyword validation claim removed (not implemented)
  - SubmissionInspectorApp: clarified as architectural context, not separate launch target
  - ZIP contents: expanded from 3 to 9 files

Latest completed classroom-trust slices:

- `2026-03-30` - Basys3 export now treats every switch/button input as non-clock in XDC and sanitizes label-derived top ports into Vivado-legal identifiers; real Vivado routed a six-case matrix (`signal-tour`, `two-bit-counter`, `DLatch`, `DFF`, `TFF`, `JKFF`) after regeneration.
- `2026-03-30` - exported entity-based testbench generation now resolves stable ids and Basys3 pin-derived aliases onto declared entity refs; the live browser export for the blank AND circuit now emits `SW(0)` / `SW(1)` stimulus and compiles cleanly under Vivado `xvhdl`.
- `2026-03-29` - bottom console/footer demotion landed; quiet Design now hides the empty workbench console, keeps diagnostic access when warnings/errors exist, and reduces the footer to a readiness-only signal.
- `2026-03-29` - blank-project truth + boundary-label cleanup landed; loaded scratch projects now present `Fresh Project`, unlabeled/legacy boundary IO rows promote to student-facing labels, and restored vectors rekey to sanitized IO ids.
- `2026-03-29` - first-run Verify draft sessions now use testbench language for trace authoring, and the first-run footer uses total live vector authority so custom-vector sessions still surface the primary run CTA.
- `2026-03-29` - classroom signoff proof recovered; shared starter loading, idle Design live-simulation reachability, and gate-truth alignment now drive `repo-status` and dirty-tree `classroom:signoff` green again.

Latest product-hardening completions (2026-04-06):

- workflow spine + shared step authority alignment landed in the shared `projectWorkflowAuthority` path
- Design-surface interaction landed its first contract slice through sequential inspector hardening
- Hardware / Export failure truth now uses one dominant status / CTA taxonomy across both surfaces
- Project overview boot truth is restored: `ide:gate:project-overview-contract` now passes after fixing the `primaryProjectCta` boot-order crash in `IdeApp.tsx`
- repo hygiene pass split the dirty Verify/import UI workstream out of the active branch before starting Project work
- Project loaded-state readability and next-action hierarchy landed:
  - the loaded hero now owns one dominant `Next step`
  - source / determinism / import fidelity moved into the visible loaded-project reference card
  - Mapping / Verify / Export now render as one three-card workflow snapshot instead of competing CTA rows
- `pnpm repo:status` is now blocked by `IDE Evidence Capsule Contract`, not by Project overview boot/render failure

Latest design-rescue completions (2026-04-07):

- confirmed `feat/design-phase-b-editing-power` is the canonical Design rescue line; the adjacent rescue branches are already contained ancestors, so no history rewrite or rescue-branch merge was required
- hardened grouped selection capture so box-select now works by standard node-body overlap instead of node origin only, and additive marquee preserves the current group
- focused Design validation now proves the trusted loop end-to-end: bounds-aware marquee -> grouped selection -> Arrow-key nudge / duplicate / delete continuation
- landed the first grouped layout cleanup actions in Design: the multi-select inspector now exposes `Align left` and `Align top`, both reusing the existing mutation path and preserving the selected group

Use its recommended implementation order:

1. **Workflow spine + shared step authority** - Project, left rail, pipeline strip, headers, and CTAs must agree on done / blocked / next / why
2. **Design-surface interaction** - editor legitimacy for wires, selection, undo/redo, dense circuits, and sequential authoring
3. **Hardware/export failure truth** - actionable failure taxonomy, recovery paths, and artifact/readiness clarity
4. **Onboarding / empty-state** - first-run clarity, required vs optional steps, and known-good starter authority
5. **Sequential / clocked trust** - consistent timing language and proof across Verify, Export, and Hardware

Examples, starters, and classroom ops should ride inside those tracks as proof obligations, not as separate top-tier roadmap lanes.

Next product-hardening action:

- continue Design Phase B with grouped layout power by adding one simple tidy/distribute action on top of the now-trustworthy marquee / align / duplicate / nudge loop

---

## Session workflow

```
Start -> [[Session Startup Checklist]]
Work  -> [[Claude Session Mode]]
Tests -> [[Post Run Extraction]]
End   -> [[Session Shutdown Checklist]]
```

---

## Install status

| Item | Status |
|---|---|
| `CLAUDE.md` | Present in repo root |
| `redbyte-obsidian-maintainer` skill | Installed at `.claude/skills/redbyte-obsidian-maintainer/SKILL.md` |
| Dataview plugin | Needs install in Obsidian |
| Workspaces | Create: Verify Debug - Export + Vivado - Architecture + Planning |
| Post-test hooks | Not yet - use checklists manually first |

Full install order: [[Operational Readiness Review]]

---

## Test baseline (2026-03-26) - 168 pure-logic passing + 52 render passing (all green)

```
export-authority-chain-contract  49   signal-inventory-contract   18
invalidation-contract            10   buildVerifySessionViewModel  5
projectRuntime.verify-authority  15   verifyHints                 16
verifyScenario                   30   diagnostics.contract         4
basys3-port-lint                  2   basys3-port-naming-phase1   10
audit-determinism                 1   verifyContract.reset         8
```

Render harness (all 9 suites green):

- `verifySurface-fail-state` 3 - `verifySurface.failure-context` 2 - `verifySurface.authoring` 11
- `verifySurface.three-panel` 3 - `verifySurface.workstation` 23 - `verifySurface.hints-bridge` 3
- `verifySurface.failure-patterns` 5 - `verifySurface.waveform-priority` 1 - `verifySurface.combo-kmap-provenance` 1

---

## Architecture map

**Active:** [[Design Surface]] - [[Project Surface]] - [[Verify Engine]] - [[Connection Model]] - [[Verify Hint System]] - [[Test Infrastructure]] - [[Note Schema]] - [[Workspace Routing]] - [[Automation Strategy]]

**Stubs (expand when touching):** [[Export Contracts]] - [[Signal Inventory]] - [[Authority Chain]] - [[Bridge Protocol]] - [[Basys 3 Mapping]]

**Decisions:** [[ADR-001 Enforce Structured Connection Format]] - [[ADR-002 Truth Table Selection Does Not Auto-Switch Tabs]]

**Recent export truth fixes (resolved 2026-03-26, preserve and do not reopen):**
- [[BUG-013 Basys3 Export Port Sanitizer Produced Vivado-Illegal Identifiers]] - Basys3 export now collapses separator runs and trims edge underscores before label-derived names reach `top.vhd` / `top.xdc`; the shipped `two-bit-counter` example now synthesizes and routes in real Vivado (`2026-03-30`)
- [[BUG-012 Basys3 Switch and Button Clock Buffer Inference]] - switch/button input ports now always emit `CLOCK_BUFFER_TYPE NONE`, and real Vivado implementation now routes switch-driven `DLatch` / `DFF` / `TFF` / `JKFF` matrix cases without `Place 30-574` (`2026-03-30`)
- [[BUG-011 Export Testbench Stable-ID Stimulus Drift]] - entity-based export now resolves stable vector ids against declared entity refs and blocks undeclared stimulus/assertion targets (`2026-03-30`)
- [[BUG-007 Export Verify Gate Tone Mismatch]] - stale-after-pass export state is advisory `STALE`, not a red blocker (`b5cf70c7`)
- [[BUG-008 Export Vivado Steps Mismatch Download Label]] - visible Vivado steps now prioritize the normal Open Project flow (`849eca4f`)
- [[BUG-009 Export RBEV Diagnostics Shown When Blocked]] - advisory RBEV evidence no longer appears inside hard-blocker lists (`88d7a30f`)
