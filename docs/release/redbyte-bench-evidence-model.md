# RedByte Bench Evidence Model

**Date:** 2026-05-06
**Purpose:** Define the durable evidence model for post-Vivado bench classification so RedByte never conflates build, programming, and observed behavior proof.

## Evidence levels

### E0 - Generated export package exists

Minimum evidence:
- RedByte produced VHDL/XDC/Tcl/handoff artifacts.
- Target row has export artifacts that can be audited.

### E1 - Vivado build evidence

Minimum evidence:
- Vivado project opened from the generated export.
- Synthesis completed.
- Implementation completed.
- Bitstream was generated.
- Warnings are classified and preserved.

### E2 - Programming evidence

Minimum evidence:
- Board target detected.
- Bitstream programming succeeded.
- Programming method and board target are recorded.

### E3 - Observed behavior evidence

Minimum evidence:
- Physical board behavior observed against expected controls/outputs.
- Observation record includes expected vs observed results.
- Observation status is pass/fail/uncertain.
- Observation evidence type is documented (manual, photo/video, automated readback, or log-only note).
- `can_promote_to_E3` is explicitly `yes` only when observed behavior matches expectation.

## Non-conflation rule

E3 cannot be inferred from E2.

Programming success is hardware-delivery evidence, not behavior-proof evidence. A target remains at E2 until observation is explicitly recorded and marked promotable.

## Warning classes

- `acceptable`
- `expected/no-clock/combinational`
- `confusing but nonblocking`
- `needs RedByte explanation`
- `needs RedByte preflight`
- `build blocker`
- `programming blocker`
- `observation blocker`

## Classifier rules

- If bitstream generated but not programmed: maximum `E1`.
- If programmed but not observed: maximum `E2`.
- If observed manually and expected behavior matches: `E3`.
- If observation is uncertain: stay `E2` and set observation status to uncertain.
- Never auto-promote to `E3`.

## Output contract

`pnpm rb:bench:evidence:classify` writes both files under a specific run folder:

- `.redbyte/bench/runs/<timestamp>/evidence-classification.md`
- `.redbyte/bench/runs/<timestamp>/evidence-classification.json`

Each target row includes:

- `target_id`
- `export_status`
- `vivado_build_status`
- `synthesis_status`
- `implementation_status`
- `bitstream_status`
- `program_status`
- `observed_behavior_status`
- `evidence_level`
- `warnings`
- `warning_classes`
- `blockers`
- `redbyte_gap`
- `recommended_next_action`

## Observation workflow

`pnpm rb:bench:evidence:observe -- <target-id>` writes/updates:

- `.redbyte/bench/runs/<timestamp>/<target-id>/board-observation.md`

Required observation fields:

- target
- bitstream path
- board target
- programmed yes/no
- expected controls
- expected outputs
- observation steps
- controls toggled
- observed outputs
- pass/fail/uncertain
- evidence type
- observer
- timestamp
- notes
- can_promote_to_E3
