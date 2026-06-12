---
name: redbyte-github-ops
description: Use when RedByte work involves GitHub Actions, failing checks, required status contexts, branch protection, rulesets, pushes, or remote-green verification.
---

# RedByte GitHub Ops

## Principle

GitHub truth is remote truth. Do not infer green from local tests, a successful push, or a stale prompt. Prove the current workflow, required checks, branch protection, and run conclusions directly.

## Required Preflight

Run from `C:\Users\conno\redbyte-ui-genesis-main`:

```powershell
pwd
git status -sb
git remote -v
git branch --show-current
git rev-parse HEAD
node -v
pnpm -v
Get-Content .nvmrc
```

Stop if this is not `main`, the remote is not `https://github.com/swaggyp52/redbyte-ui-genesis.git`, or unrelated tracked files are dirty.

## Inspect GitHub

Use `gh` before editing:

```powershell
gh auth status
gh workflow list --repo swaggyp52/redbyte-ui-genesis
gh run list --repo swaggyp52/redbyte-ui-genesis --branch main --limit 30
gh api repos/swaggyp52/redbyte-ui-genesis/commits/main/check-runs
gh api repos/swaggyp52/redbyte-ui-genesis/branches/main/protection
gh api repos/swaggyp52/redbyte-ui-genesis/rulesets
```

For failures, read logs:

```powershell
gh run view <run-id> --repo swaggyp52/redbyte-ui-genesis --log-failed
```

## Classify Before Fixing

Choose one classification per failure: real product/test failure, environment/tooling failure, stale workflow command, stale required status, branch-protection mismatch, flaky test, obsolete test, hardware/manual-only gate, or unknown.

## Fix Rules

- Never force push.
- Never delete tests or workflows just to quiet notifications.
- Prefer restoring a real workflow/job over removing a meaningful required check.
- Keep `Classroom Truth Gates` stable: it is the required GitHub check emitted by `.github/workflows/pr-truth-gates.yml`.
- If a required context is obsolete, document old context, replacement coverage, and why removal is correct before changing protection.
- Keep automated push gates separate from Vivado/Basys3 manual release evidence.

## Safe Push Closeout

Before push: fetch, compare ahead/behind, run affected local gates, run `git diff --check`, and stage only the slice files.

After `git push origin main`, wait for the new run:

```powershell
gh run list --repo swaggyp52/redbyte-ui-genesis --branch main --limit 10
gh run watch <run-id> --repo swaggyp52/redbyte-ui-genesis --exit-status
gh api repos/swaggyp52/redbyte-ui-genesis/commits/main/check-runs
```

Report branch, commit, push result, run URL, final conclusion, and whether source delivery also became a verified deployment. Do not equate GitHub `main` with live/student deployment unless the deploy workflow proves it.
