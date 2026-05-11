# First Cleanup PR Plan

Date: 2026-05-11

## Goal

Land the course-edition triage evidence without removing historical material. This first PR should be boring, reversible, and reviewable.

## Exact Files to Change

| File | Change |
| --- | --- |
| `.gitignore` | Add `.redbyte/course-edition/` so local browser audit artifacts are not accidentally committed. |
| `docs/release/course-edition/00-preflight-report.md` | Add preflight report. |
| `docs/release/course-edition/01-repo-inventory.md` | Add repository inventory and classification. |
| `docs/release/course-edition/02-final-package-boundary.md` | Define final source/package boundary. |
| `docs/release/course-edition/03-archive-removal-plan.md` | Define traceable archive/removal plan. |
| `docs/release/course-edition/04-runtime-and-browser-audit.md` | Record app run/browser evidence. |
| `docs/release/course-edition/05-product-walkthrough-findings.md` | Record beginner walkthrough findings. |
| `docs/release/course-edition/06-feature-capability-matrix.md` | Add feature capability matrix. |
| `docs/release/course-edition/07-first-cleanup-pr-plan.md` | Add this plan. |
| `docs/release/course-edition/08-validation-log.md` | Add validation log after commands run. |
| `AI_STATE.md` | Add factual change-log entry for this triage slice. |

## Exact Files to Leave Untouched

Do not edit, move, or delete these in the first cleanup PR:

| Path | Reason |
| --- | --- |
| `.env` | Requires security/privacy approval and possible rotation. |
| `package-lock.json` | Stale, but removal needs approval and communication. |
| `coverage/**` | Generated/tracked output, but remove only in a dedicated cleanup. |
| `artifacts/**` | Mixed generated output and possible proof artifacts. Needs split decision. |
| `docs/00-canon/**` and root legacy docs | Archive only after preservation point and rewrite plan. |
| `.claude/**`, `08 Agents + Prompts/**`, Marcus docs/scripts | Development-only boundary requires human decision. |
| `.redbyte/pi-session-room/**` | Untracked local/session material. Do not stage. |
| Product source under `packages/**` | This task is audit/governance only. |

## Files Needing Human Approval Before Later Cleanup

| Path/group | Decision |
| --- | --- |
| `.env` | Secret review and removal/rotation plan. |
| `package-lock.json` | Remove or archive. |
| `coverage/**` | Remove tracked generated output. |
| `artifacts/**` | Move generated release outputs outside main source repo; preserve intentional proof docs. |
| Legacy docs | Archive, rewrite, or keep behind explicit historical index. |
| Marcus/agent/vault material | Keep public, move private, or package-exclude only. |
| Labs/samples/submissions | Official starter, fixture, archive, or privacy-sensitive. |

## Suggested Commit Sequence

1. `docs(course): add course edition triage reports`
   - Adds `docs/release/course-edition/*.md`.
   - Updates `AI_STATE.md`.
2. `chore(gitignore): ignore course edition audit artifacts`
   - Adds `.redbyte/course-edition/` to `.gitignore`.

If keeping the PR smaller is preferred, these can be one commit because the `.gitignore` change is directly tied to the audit artifacts.

## Validation Commands

After docs are added:

| Command | Purpose |
| --- | --- |
| `pnpm rb:doc:validate` | Validate docs index/links if the repo script supports these new docs. |
| `pnpm rb:encoding:check` | Check encoding rules after adding Markdown. |
| `pnpm start:smoke` | Confirm launcher still works after docs-only change. |
| `git diff --check` | Catch whitespace errors. |
| `git status --short --branch` | Confirm only intended files are staged/changed. |

Do not run destructive cleanup commands in this first PR.
