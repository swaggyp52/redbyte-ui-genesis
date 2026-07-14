# Product Hardening Ticket: Verify Command Readability

## Ticket

- Title: Keep Verify command labels readable across classroom browser fonts
- Date: 2026-07-13
- Owner: Connor Angiel
- Surface: Verify
- Journey segment: Verify -> select next run mode -> run Compare checks
- Mode: Student / Compare checks / post-run PASS, FAIL, and repair
- Environment:
  - Fresh machine / clean browser profile: yes for the GitHub runner; clean storage and fresh browser context in the focused gate
  - OS: Ubuntu 24.04.4 LTS remotely; Windows locally
  - Browser: Playwright Chromium 145.0.7632.6 remotely; Playwright Chromium 145 locally
  - Node: 20.19.0
  - pnpm: 10.24.0
- Obsidian note: none; canonical repo docs own this release recovery
- Linked GitHub issue: none; required-check recovery from Actions run 29301817008

## Problem

- Observed behavior: At 1440x900 in the required Ubuntu classroom gate, the visible `Compare checks` control rendered at 144px while its resolved-font readability requirement was 147px.
- Expected behavior: The full `Observe only` and `Compare checks` labels remain readable, unwrapped, unclipped, and operable across supported classroom viewports and fallback-font environments.
- Why this matters: The mode selector explains whether a run only observes behavior or evaluates saved checks. A control with no cross-platform reading margin weakens the single Verify command authority and blocks release proof.
- Severity: release blocker

## Reproduction

- Exact repro steps:
  1. Build commit `63b7f157e963ca2b14b4f6553a6c2d6baaebf2e8` with Node 20.19.0 and pnpm 10.24.0.
  2. Run `pnpm -s ide:gate:verify-postrun-workbench-usability` on the Ubuntu GitHub runner.
  3. Load the Logic Gates starter, open Verify, select Compare checks, and run to the initial post-run PASS state at 1440x900.
  4. Measure `[data-testid="ide-vcb-use-saved-checks"]` using its computed font, inline padding, and the gate's 8px readability allowance.
- Reproducibility: always in Actions run 29301817008; three clean Windows runs pass because Segoe resolves locally and therefore are not Linux font-parity proof
- First known version or date: 2026-07-13 rebrand release recovery at `63b7f157e`

## Evidence

- Screenshot / recording: GitHub uploaded no screenshot artifact; local equivalents live under `.redbyte/product-immersion/rebrand-verify-command-recovery/`.
- Console excerpt: `1440x900/PASS: Verify command deck label "Compare checks" is too narrow to read (144px < 147px)`
- Test / gate output: Classroom Truth Gates run 29301817008, job 86986962780, nested gate `ide:gate:verify-postrun-workbench-usability`
- Additional artifacts: The remote selector reported width/clientWidth/scrollWidth 144px, height 28px, requiredReadableWidth 147px, and visible `true`. The run exposed no downloadable artifacts.

## Truth Sources

- Target truth clause(s): `docs/contracts/RedByte_Product_Contract.md` Verify surface promise and interaction clarity requirements
- Current truth doc(s): `docs/manuals/RedByte_Product_Manual.md` Verify Surface and Verification Workflow
- Gap truth reference(s): `docs/roadmap/RedByte_Gap_Audit.md` Verify trust and product-polish obligations
- System map / ownership reference(s): `docs/IDE_SYSTEM_MAP.md` Verify command-bar authority; `docs/ide/03-verify.md`
- QA / rehearsal clause(s): `docs/release/manual-assignment-qa-script.md` Phase 3; `docs/release/v1-release-checklist.md` deterministic Verify/package/export flow

## Acceptance Proof

- Minimum acceptance proof: Keep the existing dynamic readability gate unchanged; render `Compare checks` at or above its remote 147px requirement with deliberate safety margin in PASS, FAIL, and repaired PASS states.
- Required test / gate command(s): Three clean focused-gate passes, adjacent Verify/rebrand/layout gates, focused Verify Vitest, `classroom:gate`, docs validation, encoding check, and unified build.
- Required manual proof: Observe -> Compare PASS -> intentional FAIL -> expected-output repair -> Compare PASS at 1440x900, 1366x768, 1920x1080, and a 125%-equivalent stress viewport with no overlap or root overflow.
- Screenshot or recording expectation: Before/after command-deck geometry and post-run state screenshots under `.redbyte/product-immersion/rebrand-verify-command-recovery/`.

## Docs Review

- Docs that must be reviewed if behavior changes: `docs/ide/03-verify.md`, `docs/IDE_SYSTEM_MAP.md`, `docs/ACTIVE_WORK.md`, `AI_STATE.md`
- Docs that must be updated if behavior changes: `docs/ACTIVE_WORK.md`, `AI_STATE.md`, and this ticket; the student workflow and labels remain unchanged.

## Disposition

- Status: fixed and verified locally; GitHub and production proof pending
- Fix PR / commit: `fix: keep Verify command labels readable` (single direct-to-main recovery commit; hash assigned at commit time)
- Notes: The repair consolidates active mode widths at `112px` Observe / `152px` Compare / derived `272px` toggle, and reflows the primary command band at `<=1200px` so 125%-equivalent stress geometry does not overlap status. The remote before-state was `144px < 147px`; after-state Compare width is `152px`. Labels, type size, padding, Compare semantics, and the dynamic readability gate are unchanged.
- Local proof: Three clean focused post-run gates passed after the final CSS; nine adjacent Verify/rebrand/layout gates passed; focused Verify Vitest passed `57/57`; full `classroom:gate` passed all steps in `874485ms`; the explicit unified artifact build, docs (`29/29`), encoding, and diff checks passed; manual pre-run/Observe/PASS/intentional-FAIL/repair-PASS replay passed at `1440x900`, `1366x768`, `1920x1080`, and `1093x614` with no group overlap, root/document overflow, or browser errors.
- Delivery boundary: Do not call this deployed until all three required checks pass, production endpoints report the recovery SHA, and the production Verify plus prior Design inspector replays pass.

## Attribution

Connor Angiel
