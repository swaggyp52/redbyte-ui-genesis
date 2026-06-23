---
doc_status: current
last_validated: 2026-06-23
owner: Connor Angiel
used_by_claude: true
role: PR78 Product Trust Reset v2 merge-readiness review
---

# RedByte PR78 Merge Readiness

Date: 2026-06-23
Branch: `product/redbyte-trust-reset-v2`
PR: #78, draft
Base reviewed: `origin/main` at `0abe87af980ee673e1ab90720ea64d32469e4c87`
Starting Phase 3I head: `24db2554c25b218f10267df22a669ca53167ca04`
Phase 4A starting head: `b6aae2ecdd1a6ecd0b8ffa42bd5996c9805713ec`
Phase 5 starting head: `27c0473863d35c07998c1529d17135342337f480`
Phase 6 reviewed head: `6c9575b8072134e062e746fad1be9bac43bd5c1c`
Phase 6B starting head: `502a163ae907d76a0fea473853adb8d80e864022`

## Executive Decision

**C. READY FOR REVIEW, KEEP DRAFT**

PR #78 is coherent enough to continue through focused product reconstruction, Phase 6 pilot-readiness review, and Phase 6B standing jury review after each slice is validated and GitHub checks are green. It must remain draft and unmerged. This decision does not mark the PR non-draft, does not merge it, and does not claim Vivado/Basys3 E1-E3 proof.

Phase 5 continued that reconstruction with contained Project, Export, and Import V2 workspace work. Phase 6 reviewed the current branch in browser and prepared the human pilot/assistive-technology review packet. Phase 6B establishes the permanent 12-agent browser jury and proves the primary from-scratch Half Adder path after fixing the mapping/proof defect the jury exposed. This does not change the executive decision: PR #78 remains draft and unmerged.

## Full Scope

PR #78 now includes:

- V2 student chrome and diagnostics separation
- V2 workspace and visual contracts
- Verify truth state, runtime adapter, rendered authority, Course/My check authority, stale/repair authority, and sequential timing authority
- manifest-backed classroom gate ownership and retired V1 diagnostic mapping
- browser-local project storage facade with journal, last-known-good, recovery points, quota recovery, dirty-update guard, multi-tab warnings, and Diagnostics storage fields
- 30-context browser rehearsal evidence and Phase 3I rehearsal fault-injection proof
- Phase 4A Design workspace and Map Pins workspace reconstruction proof
- Phase 5 Project command center, Export artifact workspace, Import step workflow, and outer-workflow continuity proof
- Phase 6 pilot-readiness browser audit, human walkthrough packet, and assistive-technology script
- Phase 6B RedByte Jury institution, first agentic browser jury verdict, from-scratch Half Adder primary trial, and retrial/fix-package docs

## Architecture Review

The branch has one coherent architecture direction:

- normal student surfaces hide raw build/proof chrome
- Help / Diagnostics owns build/runtime/storage support detail
- Verify trust is owned by `verifyTruthState.ts` and `verifyTruthAdapter.ts`
- Project and Export consume V2 Verify selectors where available
- active project storage writes are routed through `projectStorageFacade.ts`
- required classroom gates come from `scripts/gates/gate-manifest.mjs`

The main architectural risk is size and compatibility debt, not a found P0/P1 split-brain authority defect.

## Verify Authority Review

Current Verify authority is acceptable for continued review:

- Course checks render locked and can be duplicated to My checks.
- Expected-output editability follows check provenance.
- PASS/FAIL/STALE, stale reason, selected failure, repair actions, timing authority, Project status, and Export readiness are adapter/model-owned.
- Runtime failures are blocked from rendering trusted PASS.

Remaining P2 work: continue simplifying the rendered Verify surface and remove legacy assumptions when Phase 4/next product reconstruction reaches that area again.

## Storage / Durability Review

Current storage durability is acceptable for continued review:

- active runtime persistence uses `createProjectRuntimeStorage()`
- saved snapshots/index, session metadata, and legacy autosave helpers route through facade helpers in current `IdeApp`
- quota/failure paths surface a Project recovery banner instead of false Saved
- last-known-good and recovery sidecars are visible through Diagnostics
- stale writers and multi-tab conditions have gates
- `gate:project-storage-authority` now blocks new direct project persistence outside the facade or documented compatibility allowlist

Known compatibility writers retained as P2 cleanup:

- `packages/rb-apps/src/services/projectPersistence.ts`
- `packages/rb-apps/src/utils/ceAutosave.ts`
- `packages/rb-apps/src/utils/rbprojAutosave.ts`
- `packages/rb-apps/src/utils/snapshotSystem.ts`
- explicit user Reset Workspace in `packages/rb-apps/src/components/ErrorBoundary.tsx`

These are documented and guarded. Do not classify them as removed until consumer audit/deletion is complete.

## Rehearsal Validity Review

The 30-context browser rehearsal is credible browser E0 evidence:

- one isolated browser context per profile
- storage cleared per profile
- Logic Gates starter load, project rename, Verify PASS, reload restore, and corrupt-storage recovery
- storage waves G-K for journal, last-known-good, recovery point, snapshot/index, and runtime reload
- current rendered build SHA assertion against Git HEAD

Phase 3I adds `rehearsal:classroom-fault-injection`, which rebuilds and confirms the harness fails for wrong build, visible error boundary, mutated Course-check editability, stale trusted PASS, cross-context state leak, and post-reload page error.

## Accessibility Evidence

Automated/browser evidence exists for Verify accessible names, keyboard My-check expected-output editing, 125 percent zoom/contrast, diagnostics modal semantics, and recovery alert/action naming.

No NVDA, Narrator, VoiceOver, JAWS, or other screen-reader session has been run. `docs/release/RED_BYTE_ASSISTIVE_TECH_REVIEW.md` contains the required 15-20 minute human AT script. PR #78 is not accessibility-certified.

## UI / UX Review

Current branch UI is substantially stronger than pre-reset, but not finished:

| Area | Finding | Severity |
|---|---|---|
| Project | Phase 5 replaces the loaded Project status-card dashboard with compact workflow progress and direct route commands while retaining identity editing. | P2 |
| Design | Phase 4A replaces the default generic inspector path with a fixed palette, canvas-first layout, and compact context property bar; deeper keyboard/property editing and CSS retirement remain P2. | P2 |
| Verify | Authority is much stronger; visual complexity and testbench/evidence clarity can still improve. | P2 |
| Map Pins / Hardware | Phase 4A gives Map Pins a table/board split and selected-row resource/XDC context while preserving pin truth; richer conflict/repair flows remain P2. | P2 |
| Export | Phase 5 makes Export an artifact workspace with file list, selected preview, copy/download selected-file actions, and plain Vivado handoff; generated preview escaping still deserves focused review before non-draft. | P2 |
| Import | Phase 5 makes Import a guarded five-step recovery workflow; broader parser/apply breadth and failed-apply rehearsal remain future proof work. | P2 |
| Help / Diagnostics | Properly owns build/storage details; human support process still needs rehearsal. | P2 |

No current P0/P1 UI blocker was found that changes the draft decision or justifies merging PR #78 without human review.

Phase 4A follow-up: Design now has a fixed palette, compact context property bar, usable canvas geometry, active-canvas select-all, and no default generic inspector. Map Pins now has table/board split geometry and selected-row inline resource/XDC detail. This closes the first Phase 4 surface-reconstruction slice only; it does not make the PR non-draft.

Phase 5 follow-up: Project now exposes compact workflow progress and direct tool commands, Export now opens as a generated-artifact workspace, and Import now exposes a five-step guarded recovery workflow. This closes the outer-workflow reconstruction slice only; it does not make the PR non-draft.

Phase 6 follow-up: the fresh branch audit at head `6c9575b8072134e062e746fad1be9bac43bd5c1c` captured 27 browser screenshots and observations under `.redbyte/product-immersion/product-trust-reset-v2/phase-6/current-baseline/`. Project, Design, Verify, Map Pins, Export, Import, Diagnostics, reload, Back/Forward, and dirty-resume paths produced no browser/page errors and no root overflow. The audit found no P0/P1 browser blocker. Remaining product concerns are P2: Design legacy support-collapse copy in normal authoring, Verify 1366px locked-check internal scroll, Export density, support-only raw build fingerprint in Diagnostics, CSS/legacy selector debt, no actual screen-reader session, and no human professor/student walkthrough.

`docs/release/RED_BYTE_PILOT_WALKTHROUGH_PACKET.md` now records the professor/student walkthrough and P0/P1/P2 triage. `docs/release/RED_BYTE_ASSISTIVE_TECH_HUMAN_SCRIPT.md` now records the required human AT script. These are review inputs, not completed human certifications.

Phase 6B follow-up: `docs/release/RED_BYTE_JURY_REVIEW_001.md` and `docs/release/RED_BYTE_JURY_RETRIAL_001.md` record the standing agentic browser jury. The first primary Half Adder trial initially exposed P1 proof/product problems: stale Verify could be accepted, from-scratch scalar mapping rows could be incomplete, and Export could remain blocked while proof looked green. The implemented package hardens `ide:gate:jury-half-adder-visible-trial`, fixes from-scratch mapping authority, tracks `.agents/jury/**`, and persists Export ZIP evidence. The hardened retrial completed the visible from-scratch Half Adder flow in `21448ms` with `75` clicks, `0` scrolls, `2` backtracks, browser problems `0`, and package SHA-256 `fc7f908bc0439f26dc2ebd0c495e11a42849c26b3dafa7c14114d968ee58c996`. Secondary jury trials and human review remain open before non-draft.

## Dead-Code Review

No production code was deleted in Phase 3I because no candidate was proven dead without risk. Retained debt:

- retired V1 gate scripts remain diagnostic-only
- V1 selectors/comments remain in CSS/source
- package-root storage compatibility paths remain
- Export syntax-highlight preview uses HTML injection through a highlighter path that should receive focused escaping review before non-draft

## Performance Review

See `docs/release/RED_BYTE_PR78_PERFORMANCE_REVIEW.md`.

Phase 3I found no P0/P1 performance blocker. Current risks are P2: large accumulated CSS, exact clean origin/main performance delta not generated in this worktree, and need for a non-draft bundle-size review after Phase 4 reduces/removes legacy selectors.

## Security / Privacy Review

See `docs/release/RED_BYTE_PR78_SECURITY_PRIVACY_REVIEW.md`.

Phase 3I found no P0/P1 security/privacy blocker. The app remains local-first and does not add accounts, tokens, backend sync, or automatic uploads. P2 follow-up is generated-preview escaping/highlighter review and a clean non-draft dependency/header pass.

## Test / Gate Matrix

Phase 3I added:

- `gate:project-storage-authority`
- `rehearsal:classroom-fault-injection`

Phase 4A adds:

- `ide:gate:design-workspace-v2`
- `ide:gate:map-pins-workspace-v2`

Phase 5 adds:

- `ide:gate:project-command-center-v2`
- `ide:gate:export-artifact-workspace-v2`
- `ide:gate:import-step-workflow-v2`
- `ide:gate:outer-workflow-continuity-v2`

Phase 3I local closeout matrix passed under portable Node `v20.19.0` / pnpm `10.24.0`:

- `node --check` for changed gate/rehearsal/harness scripts
- `gate:project-storage-authority`
- `gate:manifest:validate`
- current Verify truth and storage gates
- `classroom:gate` (`86/86`)
- `verify:gates:classroom` (`105/105`)
- `rehearsal:classroom-fault-injection` (`6/6` deliberate faults detected)
- `build:unified`
- `rb:doc:validate`
- `rb:encoding:check`
- `git diff --check` with only normal CRLF working-copy warnings

Phase 4A local closeout matrix passed under portable Node `v20.19.0` / pnpm `10.24.0`:

- focused Design/Map Pins browser gates: `ide:gate:design-workspace-v2`, `ide:gate:map-pins-workspace-v2`
- corrected Design semantic gate: `ide:gate:design-correctness-contract`
- affected workbench geometry gates, including `ide:gate:workbench-reconstruction-v1`
- focused Design/Hardware unit tests (`78` tests)
- `build:unified`
- `classroom:gate` (`88/88`)
- `verify:gates:classroom` (`107/107`)
- `rb:doc:validate`
- `rb:encoding:check`
- `git diff --check` with only normal CRLF working-copy warnings

Phase 5 local focused proof passed under portable Node `v20.19.0` / pnpm `10.24.0`:

- new outer-workflow gates: `ide:gate:project-command-center-v2`, `ide:gate:export-artifact-workspace-v2`, `ide:gate:import-step-workflow-v2`, `ide:gate:outer-workflow-continuity-v2`
- affected legacy guards: `ide:gate:project-loaded-command-surface`, `ide:gate:export-package-inspector`, `ide:gate:export-handoff-station`, `ide:gate:export-trust-integrity`, `ide:gate:import-guided-recovery-wizard`, `ide:gate:import-guided-recovery-workflow`
- `build:unified`
- `gate:manifest:validate`
- `classroom:gate` (`92/92`)
- `verify:gates:classroom` (`111/111`)
- `rb:doc:validate`
- `rb:encoding:check`
- `git diff --check` with only normal CRLF working-copy warnings

Phase 6 current-baseline browser audit at head `6c9575b8072134e062e746fad1be9bac43bd5c1c`:

- `phase6-audit-runner.mjs` captured 27 screenshots across Project, Design, Verify, Map Pins, Export, Import, Diagnostics, navigation/reload, and dirty resume.
- Served build JSON matched reviewed head prefix `6c9575b80`.
- Browser problems: `0`.
- Root overflow findings: `0`.
- P0/P1 blockers: `0`.

Phase 6 local docs/branch validation under portable Node `v20.19.0` / pnpm `10.24.0`:

- `rb:doc:validate` (`29` passed, `0` failed)
- `rb:encoding:check`
- `git diff --check` with only normal CRLF working-copy warnings

Phase 6B primary jury proof:

- `ide:gate:jury-half-adder-visible-trial` completed the visible from-scratch Half Adder flow, intentional Verify FAIL, repair PASS, stale/re-run PASS, Map Pins row-to-board linking, post-map Verify PASS, Export package inspection/download, and Project reload/back-forward resume.
- Focused mapping authority tests cover empty canonical V2 mapping documents and pin preservation.
- Final closeout validation and GitHub checks must still be recorded before claiming the Phase 6B commit is remote-green.
- `gate:manifest:validate` (`127` gates, `92` current required)
- `build:unified`
- `classroom:gate` (`92/92`)
- `verify:gates:classroom` (`111/111`)

Still required after the Phase 6 docs commit is created:

- final current-build smoke after the commit is clean
- GitHub Classroom Truth Gates and Cloudflare Pages checks green after push

## Known Issues

### P0

None currently known.

### P1

None currently known after the Phase 6 browser audit. Final clean-tree current-build smoke and GitHub checks remain required closeout proof.

### P2

- Retire package-root storage compatibility writers after consumer audit.
- Reduce large accumulated IDE CSS and delete stale V1 selectors only when replacement proof is clear.
- Run real Narrator/NVDA/VoiceOver/JAWS review before accessibility certification.
- Run the professor/student pilot walkthrough packet before marking PR #78 non-draft.
- Run focused generated-preview escaping review before non-draft.
- Generate exact clean origin/main performance deltas before non-draft.
- Continue visible product review from live browser inspection; do not assume the V2 surfaces are fully finished from one branch pass.

## Merge Blockers

Blocking before merge/non-draft:

- PR #78 is draft by design.
- Human review has not approved marking non-draft.
- Actual screen-reader certification is not complete.
- Vivado/Basys3 E1-E3 proof has not been run.
- Final Phase 6 docs commit, clean-tree current-build smoke, push, and GitHub green proof must be recorded.

Not blockers for continuing Phase 6 review:

- P2 CSS/source cleanup debt
- compatibility storage writers documented by the source gate
- lack of hardware proof, as long as no E1-E3 claims are made

## Rollback Strategy

If Phase 4A workspace changes cause CI issues, revert the Phase 4A commit only. If Phase 3I gate additions cause CI issues, revert the Phase 3I commit only. If Phase 3H storage facade causes a runtime problem, revert the Phase 3H storage-facade commit range rather than reverting Verify truth/model work. Do not re-bless goldens or change generated artifacts as part of a rollback.

## Post-Merge Proof Plan

Before any eventual merge or non-draft transition:

1. Re-run the full local validation matrix on a clean final head.
2. Run final current-build smoke and deployed preview smoke.
3. Confirm PR body and readiness docs name the final head.
4. Run the human AT script or keep accessibility certification open.
5. Run clean performance/security follow-up checks.
6. Keep E1/E2/E3 hardware proof out of release claims unless Vivado/Basys3 proof is actually run.

## Historical Phase 4 Readiness

Phase 4A began with Design and Map Pins V2 reconstruction, with the current truth model, storage facade, gate manifest, and no-overclaim boundaries treated as fixed constraints. It is now historical context for the current Phase 6 review posture.

## Phase 6 Readiness

Phase 6 found the branch ready for human review while remaining draft. Phase 6B adds the standing jury and proves the primary from-scratch browser path after a focused fix package. The branch is not ready to mark non-draft until secondary jury trials, the pilot walkthrough, actual AT script, final current-build smoke, and GitHub green closeout are recorded.

## Attribution

Connor Angiel
