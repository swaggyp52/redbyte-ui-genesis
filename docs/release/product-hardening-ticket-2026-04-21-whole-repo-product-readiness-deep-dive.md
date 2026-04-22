# Product Hardening Ticket: Whole-Repo Product Readiness Deep Dive + First High-Severity Fix

## Ticket

- Title: Whole-repo product readiness deep dive, risk register, and first high-severity fix
- Date: 2026-04-21
- Owner: Connor Angiel
- Surface: Whole IDE product (`packages/rb-apps/src/apps/ide/**`, shared runtime state, critical student workflow gates)
- Journey segment: Fresh entry -> starter load -> design edit -> verify -> project mapping -> hardware -> export -> rename-heavy / partial / unsupported flows
- Mode: Student lab machine
- Environment:
  - Fresh machine / clean browser profile: targeted via fresh Playwright browser context against local preview
  - OS: Windows
  - Browser: Chromium (Playwright/local)
  - Node: `v20.19.0`
  - pnpm: `10.24.0`
- Obsidian note: none
- Linked GitHub issue: none

## Problem

- Observed behavior:
  - RedByte has accepted hardening slices, but the highest remaining product risks are now the subtle trust, determinism, and cross-surface legitimacy failures that only show up under deeper runtime replay and repo inspection.
  - Repo health, tests, and individual surfaces may look stronger than the product actually feels under realistic student use.
- Expected behavior:
  - RedByte should behave like a coherent, deterministic, classroom-usable IDE whose states, wording, workflow, and runtime authority hold up under both normal and broken student flows.
- Why this matters:
  - At this stage, the biggest remaining risks are not isolated cosmetic flaws. They are product-readiness failures that can break trust even when the app looks mostly correct.
- Severity: high

## Reproduction

- Exact repro steps:
  1. Audit current runtime from fresh entry through the major student workflow.
  2. Inspect repo-level authorities, tests, and state ownership for split-brain or stale truth risks.
  3. Replay rename-heavy, partial-data, and unsupported flows to surface brittle behavior.
  4. Rank discovered issues by classroom severity, trust damage, and actionability.
- Reproducibility: pending audit
- First known version or date: 2026-04-21 deep-dive request

## Evidence

- Screenshot / recording:
  - `artifacts/product-readiness-detached-starter-identity-restore.png`
- Console excerpt:
  - `[RB_BOOT] RB_APPS_REGISTER_TIMEOUT (IDE) {ms: 5000}` (warning only; observed before and after this slice)
- Test / gate output:
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/projectRuntime.persistence.test.ts packages/rb-apps/src/apps/ide/__tests__/projectBridgePanel.test.tsx packages/rb-apps/src/apps/ide/__tests__/projectSurface.continuity.test.tsx` -> pass
  - `pnpm --filter @redbyte/playground build` -> pass
  - `pnpm build:unified` -> pass
  - `pnpm repo:status` -> fails on pre-existing `IDE ZIP Import Contract`
- Additional artifacts:
  - `artifacts/product-readiness-detached-starter-identity-proof.txt`

## Risk Register

### SEV-1 classroom blockers

- None confirmed in this audit pass.

### SEV-2 trust-breakers / determinism failures

- Title: Detached starter restore erases project identity and reopens as `Untitled Project`
  - Affected workflow: fresh load -> starter-derived restore -> Project / Design / Verify / Hardware / Export
  - Why it matters: the shell claims the student is in `Untitled Project` while the loaded design and downstream workflow still reflect a real starter-derived circuit. This breaks startup truth, project identity continuity, and trust in what project is actually open.
  - Evidence source: runtime replay, local storage inspection, code inspection in `projectRuntime.ts`, existing persistence tests
  - Likely root cause: detached starter sanitization converts example-owned state to `custom` correctly, but also wipes the starter-derived name and description instead of preserving an honest custom-project identity
  - Recommended action: preserve human-readable starter-derived project identity on detach/restore while still clearing active example ownership and inherited compare state
  - Needs: code, tests, runtime proof, ticket/docs update

### SEV-3 major UX / product roughness

- Title: Project bridge leaks internal starter slugs into student-facing chrome
  - Affected workflow: Project surface after starter-derived work
  - Why it matters: labels like `signal-tour` or `two-bit-counter` make the product feel tool-internal instead of student-facing, especially when paired with custom-project framing
  - Evidence source: runtime replay, code inspection in `ProjectBridgePanel.tsx`
  - Likely root cause: bridge subtitle appends `sourceExampleId` directly rather than using student-facing copy or omitting the slug for detached custom projects
  - Recommended action: remove raw example-id leakage from bridge subtitle for detached custom flows
  - Needs: code, tests, runtime proof

- Title: ZIP import contract gate is red despite successful builds
  - Affected workflow: repo health / CI confidence
  - Why it matters: the repo can appear broadly healthy while `repo:status` still fails, which weakens the signal that green tests map to actual product readiness
  - Evidence source: `pnpm repo:status`, `pnpm ide:gate:zip-import-contract`
  - Likely root cause: stale deterministic hash expectation in `ide-zip-import-contract.test.ts`
  - Recommended action: verify whether the hash drift is legitimate product change or stale golden, then repair the contract intentionally
  - Needs: code, tests, repo-health follow-up

- Title: Some IDE test slices remain invocation-sensitive
  - Affected workflow: test / CI reliability
  - Why it matters: if suites only pass under special invocation, the repo can under-report real fragility and encourage false confidence
  - Evidence source: `AI_STATE.md` change log notes for `ideApp.labday-wiring`
  - Likely root cause: order-sensitive state or shared setup across IDE tests
  - Recommended action: isolate shared state and remove special-case invocation requirements
  - Needs: code, tests

### SEV-4 polish / consistency debt

- Title: Hardware default stage hides some rename proof unless the student switches to pin mapping
  - Affected workflow: Design rename -> Hardware
  - Why it matters: renamed signals do propagate, but the default bring-up stage can make that continuity less obvious
  - Evidence source: runtime replay
  - Likely root cause: stage-default emphasis favors bring-up readiness over mapping evidence
  - Recommended action: revisit stage emphasis only if later audits show repeated student confusion
  - Needs: UX follow-up, runtime check

## Selected First Fix

- Chosen issue: Detached starter restore erases project identity and reopens as `Untitled Project`
- Why it wins:
  - It is the highest-severity issue confirmed in runtime, not just by code reading.
  - It affects first impression and every major surface after restore.
  - It damages trust more than a local visual defect because the app appears to misrepresent what project is open.
  - The fix is actionable without reopening already-accepted mapping or verify authority slices.

## Fix Shipped

- Root problem addressed:
  - detached starter/example projects were correctly becoming `custom`, but runtime authority then scrubbed their human-readable name/summary to `Untitled Project`
  - the Project Bridge also leaked raw starter ids like `two-bit-counter` into student-facing chrome
- Runtime/code fix:
  - `projectRuntime.ts` now preserves or recovers starter-derived project identity during detach and persisted restore while still clearing active example ownership and inherited starter compare state
  - `ProjectBridgePanel.tsx` no longer appends raw `sourceExampleId` slugs for detached custom projects; active example framing uses student-facing copy instead
- Runtime proof after fix:
  - rebuilt preview opened the detached counter session with shell heading `2-Bit Up Counter`
  - Project Bridge title also read `2-Bit Up Counter`
  - Project Bridge subtitle read `Custom Project`
  - persisted runtime still kept `projectKind: custom`, `sourceExampleId: two-bit-counter`, and `activeExampleId: null`

## Validation

- Runtime replay used:
  1. Rebuilt preview at `http://127.0.0.1:4173/os/`
  2. Restored detached starter session on Project surface
  3. Confirmed shell title, bridge title, bridge subtitle, and local storage project identity all agreed
- Commands run:
  - `pnpm exec vitest run --config vitest.config.ts packages/rb-apps/src/apps/ide/__tests__/projectRuntime.persistence.test.ts packages/rb-apps/src/apps/ide/__tests__/projectBridgePanel.test.tsx packages/rb-apps/src/apps/ide/__tests__/projectSurface.continuity.test.tsx`
  - `pnpm --filter @redbyte/playground build`
  - `pnpm build:unified`
  - `pnpm repo:status`
- Validation outcome:
  - targeted tests passed
  - preview build passed
  - unified build passed
  - repo-wide status remains red only because of the pre-existing ZIP import contract failure discovered during audit

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md` sections 1, 3, 4, 5, 6, 9
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md`
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md`
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md`
- QA / rehearsal clause(s): `docs/release/manual-assignment-qa-script.md`, `docs/release/v1-release-checklist.md`, `docs/rehearsal/failure-ticket-template.md`

## Acceptance Proof

- Minimum acceptance proof:
  - a real whole-repo product-readiness audit is completed
  - a ranked SEV-1 to SEV-4 risk register is captured with evidence and recommended action
  - the highest-severity actionable issue is reproduced, fixed, and validated
- Required test / gate command(s):
  - pending issue selection
- Required manual proof:
  - runtime replay across fresh load, starter flow, design, verify, project mapping, hardware, export, and at least one broken or partial flow
- Screenshot or recording expectation:
  - capture at least one artifact for the chosen issue plus any high-signal audit evidence

## Docs Review

- Docs that must be reviewed if behavior changes:
  - `docs/manuals/RedByte_Product_Manual.md`
  - `docs/IDE_SYSTEM_MAP.md`
  - `docs/release/manual-assignment-qa-script.md`
  - `AI_STATE.md`
- Docs that must be updated if behavior changes:
  - this ticket
  - any current-truth doc whose described behavior changes
  - `AI_STATE.md`

## Disposition

- Status: fixed in working tree; awaiting commit + push
- Fix PR / commit: none
- Notes:
  - This ticket is intentionally broader than a single surface complaint and is expected to end in one shipped high-severity fix, not just an audit document.

## Attribution

Connor Angiel
