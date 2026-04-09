---
type: decision
status: accepted
area: verify
date: 2026-04-09
related:
  - "[[Verify Engine]]"
  - "[[ADR-003 Verify Matrix Role Attributes and Amber Evidence Accent]]"
---

# ADR-004 — Stimulus-First Observation Default

## Context

The Verify surface previously framed all sessions as assertion/compare sessions by default. When a student arrived in Verify, the first-run panel asked them to "fill in expected outputs" before running. `nextRunUsesAssertions` was auto-armed whenever `totalExpectedCaseCount > 0`, meaning any imported project with expected vectors would immediately force the student into compare mode even on first entry.

This model conflicted with how students actually learn sequential verification:

1. Student builds a circuit
2. Student drives inputs and observes what happens on the waveform
3. Student decides whether observed behavior is correct
4. Only then does authoring expected checks make sense

Forcing step 4 before step 2 created cognitive load: students had no basis to know what to expect until they'd observed the circuit's actual output. It also made the first-run experience feel like a test they might fail before they'd even seen the circuit behave.

## Decision

**Verify launches in observation/trace mode by default.**

- `nextRunUsesAssertions` initializes `false` unless the most recent persisted run was an assertion-backed compare run
- Expected-output canvas lanes are hidden by default (`showExpectedOutputs = false` in `VerifySurface`)
- A "Checks" toggle in the StimulusCanvas toolbar opens the expected-output layer when the student explicitly wants to author assertions
- `handleToggleExpectedOutputs` coerces `nextRunUsesAssertions = true` and expands the ScenarioBuilderPanel when the student opens Checks

**Mode language updated to reflect the model:**

- "Run stimulus" (not "Run testbench" or "Run Compare") for the default first run
- "Compare" / "Compare again" for assertion-backed runs (not "Run Compare")
- "Checks" / "output checks" replacing "expected outputs" throughout
- "Save observed as checks" replacing "Save as expected"

## Consequences

**Positive:**
- First run is instant: student clicks Run, waveform shows results, no pre-flight form to fill
- Checks are an explicit authoring step, not a hidden implicit state from imported vectors
- The session status (`SIMULATION` badge by default) correctly reflects that no assertions are armed until the student opts in

**Negative:**
- Imported projects with existing expected outputs do not auto-arm compare mode; students must click the Checks toggle to re-enable assertions. This is intentional — the first entry should always be observation-first.
- `nextRunUsesAssertions` initialization changed: `|| (!lastRun && totalExpectedCaseCount > 0)` branch removed. Any test that assumed default-assert mode when expected cells exist must be updated.

## Test impact

- `verifySurface.authoring.test.tsx`: tests that accessed expected-output canvas cells needed `fireEvent.click(getByTestId('ide-stimulus-checks-toggle'))` before the interaction
- `verifySurface.workstation.test.tsx`: session mode badge `CHECKS` → `SIMULATION` for first-entry state; session title updated; reference mode label updated
- `buildVerifySessionViewModel.test.ts`: run label / title copy updated throughout
- `ideApp.labday-wiring.test.tsx`: testids `ide-verify-empty-run` / `ide-verify-run` retired — all checks use `ide-vcb-run`
- `ideWorkbenchShell.test.tsx`: collapsed rail width `'0px'` → `'26px'`
