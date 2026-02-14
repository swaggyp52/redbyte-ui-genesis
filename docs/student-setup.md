# Student Setup + Rehearsal Runbook

Purpose: validate that a fresh student machine can complete the golden path end-to-end with no tribal knowledge.

## Scope

- Distribution path: git clone or zip extract
- Runtime path: `pnpm install` then `pnpm dev`
- Product path: Dashboard -> Studio -> Simulate -> Hardware -> Verify -> Package -> Export
- Audience: student mode only

## Preflight (before rehearsal)

- Use a fresh Windows user profile (no prior RedByte state).
- Connect Basys3 by USB.
- Confirm Node + pnpm are installed.
- Open repo root.

## Rehearsal Checklist (record pass/fail)

Fill this table during the run. Every line must be explicitly marked.

| Step | Pass | Fail | Notes |
|---|---|---|---|
| 1. Install + launch (`pnpm install`, `pnpm dev`) | [ ] | [ ] | |
| 2. App loads (no blank screen, no fatal-looking console errors) | [ ] | [ ] | |
| 3. First Run Wizard `bridge_check` passes | [ ] | [ ] | |
| 4. First Run Wizard `board_detect` passes | [ ] | [ ] | |
| 5. First Run Wizard `programmer_check` passes | [ ] | [ ] | |
| 6. First Run Wizard `known_good_program` passes | [ ] | [ ] | |
| 7. First Run Wizard `sample_capture` passes | [ ] | [ ] | |
| 8. First Run Wizard `doctor_export` passes + JSON downloaded | [ ] | [ ] | |
| 9. Dashboard opens and Studio is reachable in one click | [ ] | [ ] | |
| 10. Student mode blocks instructor-only surfaces | [ ] | [ ] | |
| 11. Edit HDL and see inline errors | [ ] | [ ] | |
| 12. Run simulation, waveform appears, probes usable | [ ] | [ ] | |
| 13. Determinism rerun gives same trace outcome | [ ] | [ ] | |
| 14. Hardware program to Basys3 succeeds OR fails with actionable guidance | [ ] | [ ] | |
| 15. Verify gates are understandable and fail-closed | [ ] | [ ] | |
| 16. Package + export bundle succeeds | [ ] | [ ] | |
| 17. Bundle validation succeeds in verifier flow | [ ] | [ ] | |

## Procedure

### 1) Install / Launch

1. Clone repo or extract zip.
2. In repo root run:
   - `pnpm install`
   - `pnpm dev`
3. Open local URL printed by Vite.
4. Confirm shell renders without blank screen.

### 2) First Run Wizard

The wizard happy path (actual implemented step IDs):

1. `bridge_check` (bridge reachable)
2. `board_detect` (Basys3 detected)
3. `programmer_check` (openFPGALoader available)
4. `known_good_program` (program known-good bitstream)
5. `sample_capture` (capture run sample)
6. `doctor_export` (doctor report JSON ready)
7. `done`

For each step:

- Click `Run step`
- Confirm status changes to `pass`
- If `fail`, capture `errorCode` and remediation text in Notes

### 3) Golden Path Use

1. Open Dashboard.
2. Open Studio from Dashboard in one click.
3. Verify student-mode surface area remains narrow:
   - Allowed: Dashboard, Studio, Playground, Settings, Files.
   - Blocked/instructor-only apps do not open via normal navigation.

### 4) Simulation

1. In Studio, edit HDL.
2. Confirm syntax/compile errors are shown inline.
3. Run simulation.
4. Confirm waveform appears and probes can be used.
5. Rerun same simulation and confirm deterministic outcome.

### 5) Hardware

1. Program Basys3.
2. Confirm success message if program completes.
3. If program fails, confirm message is actionable (specific next step, not vague failure).

### 6) Verify -> Package -> Export

1. Move through verification gates.
2. Confirm gate failures explain what to fix.
3. Package evidence.
4. Export bundle.
5. Validate bundle in verifier path.

## Top 5 Troubleshooting Modes

Use these as first-response checks during class.

1. Bridge offline (`bridge_offline`)
   - Symptom: wizard fails at `bridge_check`.
   - Action: start bridge service, verify `http://127.0.0.1:4242/health`, retry.

2. Basys3 not detected (`board_missing`)
   - Symptom: `board_detect` fails with no boards.
   - Action: reseat USB, power-cycle board, verify cable/data path, retry detect.

3. Programmer missing or failing (`program_failed`, `permission_denied`)
   - Symptom: `programmer_check` or `known_good_program` fails.
   - Action: install/repair openFPGALoader, run terminal as needed, check device permissions.

4. Bitstream unavailable (`bitstream_missing`)
   - Symptom: `known_good_program` fails before device flash.
   - Action: provide known-good bitstream source (localStorage/env), rerun step.

5. Export/verification confusion
   - Symptom: bundle exports but user cannot validate readiness.
   - Action: verify gate status first, re-run verify/package, then export and validate in the intended verifier flow.

## Rehearsal Output to Attach

- Completed checklist table (this doc)
- Doctor report JSON from wizard
- One exported submission bundle
- 3-5 line summary of any failed steps + created fix tickets
