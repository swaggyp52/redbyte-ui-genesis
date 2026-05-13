# Course Quick Starts

**Date:** 2026-05-12
**Attribution:** Connor Angiel

## Goal

Create course-facing Student Quick Start and Professor Quick Start documentation after the product gates, typecheck, unified build, UI hierarchy, Vivado E0 artifact path, and Windows course scripts were merged to `main`.

## Preflight

| Item | Result |
|---|---|
| Branch | `docs/course-quick-starts-1` |
| Base branch | `main` |
| Base commit | `08a324cfa1f8c27ec7f5a9387e0bc9563fa9e391` |
| Scope | Add concise student/professor quick starts, evidence-level guidance, troubleshooting fast path, and links/checklist updates. |
| Out of scope | UI polish, product behavior changes, script behavior changes, MarcusRPI work, evidence semantic changes, full manual rewrite, fresh-clone rehearsal, and RC packaging. |

## Source Docs Read

- `AI_STATE.md`
- `docs/ai-usage-rules.md`
- `docs/legal-attribution.md`
- `docs/contracts/RedByte_Product_Contract.md`
- `docs/manuals/RedByte_Product_Manual.md`
- `docs/roadmap/RedByte_Gap_Audit.md`
- `docs/IDE_SYSTEM_MAP.md`
- `docs/ide/SURFACE_CONFORMANCE.md`
- `docs/release/manual-assignment-qa-script.md`
- `docs/release/v1-release-checklist.md`
- `docs/release/product-hardening-ticket-template.md`
- `docs/rehearsal/failure-ticket-template.md`
- `docs/product/V1_RELEASE_READINESS_CHECKLIST.md`
- `docs/product/RED_BYTE_CURRENT_TRUTH.md`
- `docs/product/RED_BYTE_PUBLIC_START_PATH.md`
- `docs/course/windows-quickstart.md`
- `docs/release/course-edition/29-windows-course-scripts.md`
- `docs/release/course-edition/30-windows-course-scripts-merge.md`
- `docs/release/course-edition/19-vivado-artifact-correctness.md`
- `docs/release/course-edition/23-redbyte-ui-hierarchy-2.md`

Note: `AI_STATE.md` is authoritative where older current-truth docs lag recent merge results.

## Deliverables

| File | Purpose |
|---|---|
| `docs/course/student-quick-start.md` | Beginner-facing setup, launch, workflow, evidence, and stuck-path guidance. |
| `docs/course/professor-quick-start.md` | Instructor-facing course rollout, support, grading, and evidence-boundary guidance. |
| `docs/course/evidence-levels.md` | Short E0/E1/E2/E3 definitions with examples and anti-examples. |
| `docs/course/troubleshooting-fast-path.md` | Symptom-based first checks, commands, evidence to collect, and escalation guidance. |
| `docs/course/windows-quickstart.md` | Link hub updated to point at the new course docs. |
| `docs/DOC_INDEX.md` | Course handoff docs added to the navigation hub. |
| `docs/product/V1_RELEASE_READINESS_CHECKLIST.md` | Course handoff docs and Windows scripts status updated. |

## Course Guidance Contract

- RedByte is an ECE141 digital logic / FPGA / Vivado lab assistant.
- The student workflow remains `Project -> Design -> Verify -> Hardware / Map Pins -> Export -> Vivado / board evidence`.
- RedByte is not Vivado and does not replace student logic understanding.
- E0, E1, E2, and E3 stay separate.
- RedByte export packages are E0 unless downstream Vivado or board evidence is collected.
- Vivado and Basys3 remain optional for normal launch, required only for hardware proof paths assigned by the professor.

## Validation Plan

- `pnpm rb:doc:validate`
- `pnpm rb:encoding:check`
- `git diff --check`
- `pnpm typecheck`
- `pnpm build:unified`
- `pnpm -s rb:course-scripts:test`
- `pnpm start:smoke`
- `pnpm -s ide:gate:ece141-starter-verify-export`
- `pnpm -s ide:gate:ece141-ui-hierarchy`
- `pnpm -s ide:gate:ece141-vivado-artifacts`

## Validation Results

| Command | Result | Notes |
|---|---|---|
| `pnpm rb:doc:validate` | Passed before final closeout docs | 36 passed, 0 failed. |
| `pnpm rb:encoding:check` | Passed before final closeout docs | No mojibake markers found. |
| `git diff --check` | Passed before final closeout docs | No whitespace errors. |
| `pnpm typecheck` | Passed | Full workspace typecheck stayed green. |
| `pnpm build:unified` | Passed | Unified build and dist verification stayed green with `/ -> /start.html` and `/os/` direct IDE route. |
| `pnpm -s rb:course-scripts:test` | Passed | Static Windows course-script contract stayed green. |
| `pnpm start:smoke` | Passed | Launcher served `http://127.0.0.1:5197/` with HTTP 200. |
| `pnpm -s ide:gate:ece141-starter-verify-export` | Passed | Logic Gates starter Verify -> Export smoke passed. |
| `pnpm -s ide:gate:ece141-ui-hierarchy` | Passed | 2 UI hierarchy browser tests passed. |
| `pnpm -s ide:gate:ece141-vivado-artifacts` | Passed | Certified starter E0 Vivado artifact ZIP gate passed. |
| `pnpm rb:doc:validate` | Passed after final closeout docs | 36 passed, 0 failed. |
| `pnpm rb:encoding:check` | Passed after final closeout docs | No mojibake markers found. |
| `git diff --check` | Passed after final closeout docs | No whitespace errors. |

## Remaining Handoff Gaps

- Fresh clone / fresh Windows profile rehearsal is still pending.
- Professor-facing RC1 package is still pending.
- The GitHub `main` push path has repeatedly reported a bypassed required `Classroom Truth Gates` status check expectation; keep this as release-process debt until the remote check runs normally.

## Next Sprint

Fresh clone / fresh Windows rehearsal.
