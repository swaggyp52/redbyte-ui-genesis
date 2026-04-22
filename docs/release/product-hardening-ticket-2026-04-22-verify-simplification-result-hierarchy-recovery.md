# Product Hardening Ticket

## Ticket

- Title: Verify simplification and result hierarchy recovery
- Date: 2026-04-22
- Owner: Codex
- Surface: Verify
- Journey segment: Design -> Verify -> Hardware / Export
- Mode: Verify
- Environment:
  - Fresh machine / clean browser profile: in progress
  - OS: Windows
  - Browser: Chromium (Playwright runtime replay)
  - Node: in repo environment
  - pnpm: in repo environment
- Obsidian note: n/a
- Linked GitHub issue: n/a

## Problem

- Observed behavior: Verify still behaved like an internal session console instead of a guided student workflow. On first landing the header mixed `Run · observe only` with a second compare action and a repeated status line; after stale edits the header could surface different ideas of the next run; failure states still depended on the drawer to expose the useful guidance.
- Expected behavior: A first-time student should understand within seconds what Verify is for, what the next run will do, whether they are observing or comparing, what passed or failed, and what to do next.
- Why this matters: Verify is one of the highest-friction parts of the student path. Confusing run intent or weak result hierarchy makes the product feel untrustworthy even when simulation itself is technically correct.
- Severity: high

## Reproduction

- Exact repro steps:
  - Scenario A — first landing before any run
    - Route/path: `Project landing -> Load signal-tour starter -> mode-button-verify`
    - Student goal: understand what Verify is for and what the first run will do
    - Primary action shown before fix: `Run · observe only`, plus a second compare action in the same row
    - What was confusing before fix: header text read like multiple equal-weight session controls (`Run · observe only Use saved checks READY DRAFT · OBSERVE · READY TO RUN · DEFAULT`)
  - Scenario B — first observe-only run
    - Route/path: `signal-tour -> Verify -> ide-vcb-run`
    - Student goal: observe outputs without comparing checks
    - Result after fix: `Observation only`, `8 observed rows`, `Observe·Outputs observed — stimulus captured·Defaultt0Combinational stimulus mode`
  - Scenario C — compare/check run
    - Route/path: `signal-tour -> Verify -> ide-vcb-use-saved-checks -> ide-vcb-run`
    - Student goal: compare saved checks against the current run
    - Result after fix: `Checks aligned`, compare mode remains explicit, pass hero leads with `Checks passed · 32 cases`
  - Scenario D — stale after design edit
    - Route/path: `signal-tour -> Verify compare run -> mode-button-design -> place Input from palette on ide-design-live-canvas -> mode-button-verify`
    - Student goal: understand what is stale and what the next safe action is
    - Result after fix: `Update run · observe only`, `Needs update`, `Observe current circuit`, primary stale callout says `Results are from an older build`
  - Scenario E — failed compare run
    - Route/path: `signal-tour -> Verify -> open assertions -> flip ide-stimulus-expected-ld0-t0 -> ide-vcb-use-saved-checks -> ide-vcb-run`
    - Student goal: understand what failed and what to do next
    - Result after fix: `Checks need review`, drawer hint `Focus LD0 at t0`, drawer guidance `If the expected values are wrong, update them below. If the circuit is wrong, fix it in Design.`
- Reproducibility: 5/5 runtime scenarios reproduced locally in the preview build
- First known version or date: 2026-04-22 recovery slice

## Evidence

- Screenshot / recording:
  - Local runtime captures were recorded for scenarios A-E (`verify-phase6-scenarioA/B/C/D/E-*.png`) during this slice and then kept as local-only artifacts outside the committed repo.
- Console excerpt:
  - Scenario A before fix: `Run · observe only Use saved checks READY DRAFT · OBSERVE · READY TO RUN · DEFAULT`
  - Scenario A after fix: `Run · observe only Next run Observe only Compare checks READY Observe·Ready to run·Default`
  - Scenario D after fix: `Update run · observe only ... Needs update Observe·Observe current circuit·Default...`
  - Scenario E after fix: `Checks need review`, `Focus LD0 at t0`, `Outputs don't match the expected values... Open checks / Open in Design`
- Test / gate output:
  - Focused Vitest suites for `VerifyCommandBar`, `VerifySurface.workstation`, `verifySurface.frontend-dedup`, and `ideApp.labday-wiring` passed after the fix.
  - `pnpm --filter @redbyte/playground build` passed.
  - `pnpm build:unified` passed.
- Additional artifacts:
  - Runtime replay was performed against the real preview app at `http://127.0.0.1:4173/`.

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md` section 4.4 Verify Surface, section 9.3 Verify
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md` sections 7.3 and 9
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md`
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md`
- QA / rehearsal clause(s): `docs/release/manual-assignment-qa-script.md`, `docs/release/v1-release-checklist.md`

## Acceptance Proof

- Minimum acceptance proof:
  - Replay first-run Verify scenarios in the running app
  - Identify the top blocker from runtime evidence
  - Implement one product-quality fix that clarifies run intent or result hierarchy
- Required test / gate command(s):
  - Focused Verify tests for touched behavior
  - `pnpm build:unified`
- Required manual proof:
  - Runtime replay of scenarios A-E after the fix
- Screenshot or recording expectation:
  - Verify landing and at least one post-run state showing improved hierarchy

## Verify Blocker Register

1. Severity: high
   - Title: Verify header hides or duplicates the next-run story
   - Student workflow affected: first landing, compare arming, stale rerun
   - Runtime evidence: first landing showed `Run · observe only` plus an additional compare CTA and repeated state labels; stale replay briefly exposed conflicting observe/compare cues until the header was unified around one mode source
   - Likely root cause: run mode lived in multiple places (`nextRunUsesAssertions`, status/meta copy, utility menu placement) instead of one canonical header contract
   - Why it matters: students cannot tell what the main action will do, which makes Verify feel unsafe to trust
   - Recommended action: make observe/compare a visible `Next run` selector, remove run-mode switching from `Tools`, and dedupe repeated header labels
2. Severity: medium
   - Title: Failure guidance still requires opening Details
   - Student workflow affected: compare fail triage
   - Runtime evidence: the useful `Open checks / Open in Design` guidance appears only after opening the drawer; the collapsed state only hints `Focus LD0 at t0`
   - Likely root cause: mismatch guidance is still treated as secondary analysis instead of first-line classroom feedback
   - Why it matters: students can miss the recovery path and stall on a red state
   - Recommended action: keep one-line next-step guidance visible even before the drawer opens
3. Severity: medium
   - Title: Compare pass state still carries a lot of metadata chrome
   - Student workflow affected: pass -> hardware/export handoff
   - Runtime evidence: even after the fix, the pass hero still competes with hashes/scenario metadata immediately below the main success story
   - Likely root cause: run-proof detail is colocated too close to the primary classroom CTA set
   - Why it matters: success states should feel decisive, not technical
   - Recommended action: collapse metadata further behind the details disclosure once pass hierarchy is stable
4. Severity: medium
   - Title: No-check / trace-first wording still leans on reference jargon
   - Student workflow affected: observe-only and stale observe-first flows
   - Runtime evidence: `Session details` still says things like `Observation run only — no saved checks`
   - Likely root cause: technical reference language remains in the low-visibility details layer
   - Why it matters: first-time students do not naturally think in terms of reference modes
   - Recommended action: replace remaining reference-mode jargon with student-facing classroom language

## Chosen Blocker

- Selected blocker: `Verify header hides or duplicates the next-run story`
- Why it won:
  - It affected every required runtime scenario, not just one edge state.
  - It was the clearest cause of first-time confusion on the live surface.
  - A narrow header contract fix could improve first-run, compare, and stale flows together without drifting into broader Verify redesign.

## Root Cause

- The Verify header used more than one source of truth for run intent and session meaning:
  - the primary run label
  - the compare toggle placement
  - session status/meta labels
  - stale-state fallback logic
- Because those sources were not structurally unified, the surface could say the same thing three times, hide the mode switch inside `Tools`, or briefly show mismatched observe/compare cues after a design change.

## Fix

- Product decision:
  - Verify now treats observe vs compare as an explicit header choice, not a hidden utility.
- Implemented behavior:
  - `VerifyCommandBar` always shows a visible `Next run` mode selector when compare is available or already active.
  - `Tools` no longer owns the run-mode switch; it only holds secondary utilities.
  - The session strip dedupes repeated labels so the same status is not repeated as pill + meta + title.
  - Draft sessions no longer contradict themselves with `READY` in the pill and `Draft` in the meta line.
  - Stale titles and mode badges now use the same canonical next-run mode as the primary run CTA.

## Docs Review

- Docs that must be reviewed if behavior changes:
  - `docs/IDE_SYSTEM_MAP.md`
  - `docs/manuals/RedByte_Product_Manual.md`
- Docs that must be updated if behavior changes:
  - This ticket
  - `AI_STATE.md`
  - One exact manual/system-map doc only if user-facing truth changes

## Disposition

- Status: fixed locally, validated, awaiting local commit
- Fix PR / commit: pending local commit
- Notes:
  - This ticket is the working evidence record for Phase 6 Verify simplification and result hierarchy recovery.

## Attribution

Connor Angiel
