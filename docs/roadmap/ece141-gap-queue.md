# ECE141 Gap Queue (Executable)

Status: Active  
Date: 2026-02-18  
Owner: Connor Angiel

## Scope Lock

- Basys3 only.
- Boot pipeline is out of scope for this queue.
- Queue order is strict: Lane A -> Lane B -> Lane C.

## Lane A — Ship-Blockers

### A1. Sequential verify/export parity (clocked labs)
1. Lab(s) affected: Lab 6, Lab 7, Lab 8
2. Student-visible symptom: Verify can appear to pass while exported testbench semantics do not match clocked behavior expectations.
3. Root cause: Verify runner and testbench generation do not share one deterministic schedule contract for sequential/clocked designs.
4. Exit criteria:
   - Verify and generated `testbench.vhd` use the same declared schedule (`clocked_macro` vs `combinational`).
   - Fixture `03-vivado-ish-clocked` runs through import -> verify -> export parity gate.
   - Export includes generated testbench content (not placeholder text) when vectors exist.
5. Gate/test to add:
   - Vitest parity gate on fixture 03: import fixture, run verify schedule, generate/export testbench, assert schedule parity.
6. Commit sequence (2–6 atomic commits):
   - `feat(verify): add shared sequential schedule contract for verify and testbench`
   - `fix(export): generate testbench from vectors in basys3 export service`
   - `test(gates): add fixture03 import->verify->export parity gate`

### A2. Export block on incomplete IO mapping
1. Lab(s) affected: Lab 3, Lab 4, Lab 5, Lab 7, Lab 8
2. Student-visible symptom: Export can proceed with incomplete mappings, leading to Vivado failures or misleading readiness.
3. Root cause: Export validation does not hard-block all unmapped required ports with a deterministic actionable list.
4. Exit criteria:
   - Export returns blocked state with explicit missing ports.
   - UI and API show same missing-port list order deterministically.
5. Gate/test to add:
   - Vitest gate: export fails when required ports are unmapped.
6. Commit sequence (2–6 atomic commits):
   - `fix(export): enforce required-port mapping block in basys3 export validation`
   - `test(export): add unmapped-port blocking gate`

### A3. Basys3 seven-segment/buttons/switches mapping correctness
1. Lab(s) affected: Lab 3, Lab 5, Lab 8
2. Student-visible symptom: Students cannot confidently map display/button-heavy labs to valid Basys3 constraints.
3. Root cause: Mapping coverage and diagnostics are strongest for switch/LED flows and weaker for 7-segment/button-centered flows.
4. Exit criteria:
   - Basys3 mapping table includes required aliases for these lab flows.
   - Exported XDC is deterministic and pin-valid for those aliases.
   - Warnings are actionable when unsupported aliases appear.
5. Gate/test to add:
   - Vitest gate with 7-seg/button fixture asserting deterministic XDC assignments.
6. Commit sequence (2–6 atomic commits):
   - `feat(export): add basys3 alias coverage for seven-seg/button flows`
   - `test(export): add 7seg-button xdc parity gate`

## Lane B — Lab Enablement

### B1. Seven-segment abstraction module
1. Lab(s) affected: Lab 3, Lab 5, Lab 8
2. Student-visible symptom: Students can wire segment logic incorrectly and struggle to debug segment polarity/select lines.
3. Root cause: No minimal, canonical SSD abstraction with deterministic defaults in IDE workflows.
4. Exit criteria:
   - Students can instantiate SSD abstraction with explicit inputs/outputs and known pin expectations.
   - Verify vectors can target SSD outputs consistently.
5. Gate/test to add:
   - Vitest coverage for SSD abstraction logic and port contract.
6. Commit sequence (2–6 atomic commits):
   - `feat(design): add minimal seven-segment abstraction block`
   - `test(verify): add ssd abstraction vector tests`

### B2. Debounce/clock-divider guidance path
1. Lab(s) affected: Lab 6, Lab 7, Lab 8
2. Student-visible symptom: Button-driven clock behavior is unstable/confusing in hardware compared with simulation.
3. Root cause: No first-class guidance surface for debounce and clock-divider decisions in student flow.
4. Exit criteria:
   - Project/Verify surfaces show deterministic guidance when button-clock patterns are detected.
   - Export readiness includes warning text for raw-button clock risk.
5. Gate/test to add:
   - UI contract test for warning visibility when button-as-clock pattern is present.
6. Commit sequence (2–6 atomic commits):
   - `feat(project): add clock/debounce guidance diagnostics`
   - `test(ui): add button-clock warning contract gate`

### B3. Minimal lab-start project presets
1. Lab(s) affected: Lab 1 through Lab 8
2. Student-visible symptom: Students start from empty or misleading setups; setup overhead is high.
3. Root cause: No minimal, correctness-first starter projects keyed to each lab objective.
4. Exit criteria:
   - One minimal preset per lab category (combinational/arithmetic/sequential/FSM/display).
   - Presets include initial vectors and required mapping checklist.
5. Gate/test to add:
   - Fixture loader gate ensuring each preset loads and has required metadata.
6. Commit sequence (2–6 atomic commits):
   - `feat(project): add minimal ece141 starter presets`
   - `test(gates): add preset load contract gate`

## Lane C — Polish

### C1. Manual-linked learning overlays
1. Lab(s) affected: Lab 1 through Lab 8
2. Student-visible symptom: Students cannot quickly map IDE state to what lab handouts ask for.
3. Root cause: Mode surfaces do not yet expose concise "manual step mapping" guidance.
4. Exit criteria:
   - Each mode has optional contextual help linking to lab-step intent.
   - No additional surface replaces IDE workflow; overlays are additive only.
5. Gate/test to add:
   - Playwright structure check for help entrypoint presence in each mode.
6. Commit sequence (2–6 atomic commits):
   - `feat(ui): add lab-step contextual overlays`
   - `test(gates): add mode-help entrypoint contract`

### C2. Productivity micro-UX (shortcuts and change diff)
1. Lab(s) affected: Lab 1 through Lab 8
2. Student-visible symptom: Students lose track of what changed between iterations and run verification inefficiently.
3. Root cause: Limited visibility for project delta and keyboard-driven workflow in core modes.
4. Exit criteria:
   - Deterministic "what changed" panel for project-level deltas.
   - Stable shortcuts documented and testable.
5. Gate/test to add:
   - Vitest/Playwright checks for diff panel rendering and shortcut action hooks.
6. Commit sequence (2–6 atomic commits):
   - `feat(ui): add project delta panel and mode shortcuts`
   - `test(ui): add shortcut and diff-panel contract tests`

## Execution Rule

- No Lane B or Lane C implementation starts until all Lane A items are green.
