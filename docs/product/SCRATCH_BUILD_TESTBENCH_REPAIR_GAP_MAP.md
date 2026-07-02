# Scratch Build Testbench Repair Gap Map

Date: 2026-07-01
Status: Round 14A working map

This map translates the current student pain into product gaps for the core RedByte promise: build a digital logic circuit from scratch, write a testbench, verify it, repair mistakes, and export a Basys3-ready E0 package without falling into Vivado too early.

## A. Scratch Design Creation

### A1. Scratch build proof is too narrow

- Severity: High
- Current evidence: Round 3 proved a blank adder path, but the current gate stack does not yet cover a general three-input scratch circuit with at least two outputs, student labels, and either several primitive gates or a FullAdder plus extra logic.
- Affected surface: Design
- Likely source files: `packages/rb-apps/src/apps/ide/surfaces/DesignSurface.tsx`, `packages/rb-apps/src/apps/ide/projectRuntime.ts`, `scripts/gates/ide-blank-adder-authoring-depth.mjs`
- Smallest useful fix: Add a browser gate that builds a nontrivial combinational design from Build Fresh using board inputs, board outputs, labels, a FullAdder, and extra combinational logic.
- Required before Gannon pilot: Yes

### A2. Scratch labels are useful but not yet part of repair proof

- Severity: Medium
- Current evidence: Existing gates prove labels can be authored, but testbench failure guidance must use those labels instead of internal row IDs.
- Affected surface: Design and Verify
- Likely source files: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`, `packages/rb-apps/src/apps/ide/viewmodels/buildVerifyStudentViewModel.ts`
- Smallest useful fix: Require failure repair UI to show the student-facing output label, case number, inputs, expected value, and observed value.
- Required before Gannon pilot: Yes

## B. Testbench Creation

### B1. Observe-to-check authoring exists but is not proven for general scratch work

- Severity: High
- Current evidence: Verify supports Observe, saved expected outputs, and Compare; prior gates cover starter and adder paths, not a general scratch design with multiple outputs.
- Affected surface: Verify
- Likely source files: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`, `packages/rb-apps/src/apps/ide/surfaces/ScenarioBuilderPanel.tsx`, `packages/rb-apps/src/apps/ide/components/StimulusCanvas.tsx`
- Smallest useful fix: Gate the normal student flow: author inputs, run Observe, save observed outputs, intentionally edit an expected output, then run Compare.
- Required before Gannon pilot: Yes

### B2. Expected-output edits are possible but not framed as a repair action

- Severity: High
- Current evidence: Expected cells and lower mismatch panels can update values, but a student who enters a wrong expected value can miss the direct repair action.
- Affected surface: Verify
- Likely source files: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`, `packages/rb-apps/src/apps/ide/surfaces/VerifyFailureExplanationPanel.tsx`
- Smallest useful fix: Add a first-class failure repair panel with "Edit expected value", "Use observed value as expected", "Open in Design to inspect wiring", and "Rerun Compare".
- Required before Gannon pilot: Yes

## C. Failure Diagnosis

### C1. Failure details are present but too easy to miss

- Severity: High
- Current evidence: The current Verify surface has mismatch guidance, failure explainer rows, and an "Accept observed" strip, but much of it lives below the main waveform or inside drawer/detail regions.
- Affected surface: Verify
- Likely source files: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`, `packages/rb-apps/src/apps/ide/ide-root.css`
- Smallest useful fix: Surface the first failing case directly under the run summary so failure diagnosis is visible immediately after Compare FAIL.
- Required before Gannon pilot: Yes

### C2. The next repair decision is not explicit enough

- Severity: High
- Current evidence: Existing copy says the circuit or expected values may be wrong, but it does not give a compact action set at the failure point.
- Affected surface: Verify
- Likely source files: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`
- Smallest useful fix: Present the fork clearly: fix the expected value, accept the observed value as the expectation, inspect wiring in Design, or rerun Compare.
- Required before Gannon pilot: Yes

## D. Repair Workflow

### D1. Wrong expected output must be repairable without knowing row IDs

- Severity: High
- Current evidence: Runtime supports vector updates by vector ID and signal, but the visible repair must not ask the student to understand those identifiers.
- Affected surface: Verify
- Likely source files: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`, `packages/rb-apps/src/apps/ide/viewmodels/buildVerifyStudentViewModel.ts`
- Smallest useful fix: Drive repair from the selected failure and show case number, tick, label, expected, observed, and input vector.
- Required before Gannon pilot: Yes

### D2. Repair must make immediate re-compare obvious

- Severity: High
- Current evidence: Existing expected-value edit helpers can update state, but the student still needs an obvious next Compare action after repair.
- Affected surface: Verify
- Likely source files: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`
- Smallest useful fix: Keep a visible "Rerun Compare" action in the repair panel and ensure it calls Compare mode directly.
- Required before Gannon pilot: Yes

### D3. Stale evidence must remain visible after later testbench edits

- Severity: High
- Current evidence: The product has stale-state machinery, but Round 14A needs a direct proof that changing a circuit or testbench after PASS makes current vs stale obvious.
- Affected surface: Verify and Export
- Likely source files: `packages/rb-apps/src/apps/ide/surfaces/VerifySurface.tsx`, `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx`, `packages/rb-apps/src/apps/ide/projectRuntime.ts`
- Smallest useful fix: Gate that a post-PASS expected-output edit shows stale Verify guidance and prevents Export from representing stale evidence as trusted current evidence.
- Required before Gannon pilot: Yes

## E. Export Confidence

### E1. Export trust must be tied to current PASS evidence

- Severity: High
- Current evidence: Export has draft/trusted and provenance states, but this specific scratch-build repair flow needs proof that failed or stale Compare evidence is not presented as trusted.
- Affected surface: Export
- Likely source files: `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx`, `packages/rb-apps/src/apps/ide/surfaces/export/ExportSurfacePrimitives.tsx`
- Smallest useful fix: Gate that Export shows stale or pending trust after a post-PASS testbench edit, then shows current Compare PASS after repair and rerun.
- Required before Gannon pilot: Yes

### E2. E0 boundary must remain explicit

- Severity: Medium
- Current evidence: Export gates already guard E0/E1/E2/E3 wording, but every new export confidence proof should keep that boundary in view.
- Affected surface: Export
- Likely source files: `packages/rb-apps/src/apps/ide/surfaces/ExportSurface.tsx`, `packages/rb-apps/src/apps/ide/viewmodels/buildExportViewModel.ts`
- Smallest useful fix: Include E0/export-package boundary assertions in the scratch repair gate and do not imply Vivado E1, bitstream E2, or board E3 proof.
- Required before Gannon pilot: Yes
