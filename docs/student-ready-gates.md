# Student-Ready Gates (No Board Required)

This document defines the minimum acceptance gates for a classroom-safe RedByte release when FPGA hardware and external toolchains may be unavailable.

All gates are deterministic and should be validated by automated tests where possible.

## Gate 1 — Boot and Navigation

- App boots without white screen.
- Launcher renders core apps.
- `/toolchain` and `/setup` routes render when tools are missing.

## Gate 2 — Logic Playground Core

- New project can be created.
- Core digital logic simulation runs and updates outputs deterministically.
- Debug/step controls do not freeze the UI.

## Gate 3 — Lab App Core

- Lab app loads without runtime crash.
- IO controls respond in simulation mode.

## Gate 4 — Virtual Lab Safety

- Virtual lab route/component loads without fatal crash.
- If 3D cannot initialize, fallback messaging is shown instead of hard failure.

## Gate 5 — Import/Export Integrity

- Project export completes.
- Re-import verifies integrity and restores project content.
- Verification warnings are explicit and non-fatal when possible.

## Gate 6 — Reproducibility

- Recorded simulation replay is deterministic for the same inputs.
- Reproducibility verification report can be generated.

## Gate 7 — Examples Workflow

- Examples are discoverable from student-facing UI.
- Opening an example works without manual project setup.
- Example projects remain export/import compatible.

## Gate 8 — Toolchain Graceful Degradation

- Missing tools are surfaced with actionable fixes.
- Implement/program actions are blocked when prerequisites are not met.
- Doctor report export is always available.

## Gate 9 — Submission Bundle

- One-click submission bundle includes project export, logs, and verification artifacts.
- Bundle output naming and structure are deterministic.
- Bundle includes `submission-gates.json` with schema `rb_submission_gates_v1` (`labId`, deterministic `timestamp`, `context`, and gate `result`).

## Gate 10 — Doctor Report Readiness Summary

- Doctor report includes a `studentReadiness` section with ordered gate results.
- Each failing/warning gate includes a concrete next action.

