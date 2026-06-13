# RedByte GitHub Operations

This is the current GitHub operations playbook for the canonical RedByte clone at `C:\Users\conno\redbyte-ui-genesis-main`.

## Normal Push Process

1. Confirm the folder, branch, remote, runtime, and clean/dirty state:

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

2. Run affected local gates. For GitHub classroom truth work, the local equivalents are:

   ```powershell
   pnpm -s ci:no-solution:lab4
   pnpm -s classroom:gate
   pnpm -s ci:no-solution:lab1
   pnpm -s ci:no-solution:lab2
   pnpm -s ci:no-solution:lab3
   pnpm -s ci:no-solution:lab5
   pnpm -s ci:no-solution:lab6
   pnpm -s ci:no-solution:lab7
   pnpm -s ci:no-solution:lab8
   pnpm -s rc:e1:golden-basys3-export-gate
   pnpm -s rc:e1:golden-basys3-alu-export-gate
   pnpm -s ui:dev-guards-contract-gate
   ```

3. Fetch before push, check ahead/behind, stage only the slice files, commit, then push normally:

   ```powershell
   git fetch origin --prune
   git rev-list --left-right --count origin/main...main
   git status --short
   git push origin main
   ```

Never force push.

## Workflow Map

| Workflow | File | Required check | Trigger | Purpose |
| --- | --- | --- | --- | --- |
| Classroom Truth Gates | `.github/workflows/pr-truth-gates.yml` | `Classroom Truth Gates` | `push`/`pull_request` to `main`, manual dispatch | Automated classroom safety gate: no-solution labs, IDE classroom loop, golden export gates, and UI dev guards. |
| Deploy to Cloudflare Pages | `.github/workflows/deploy-cloudflare.yml` | Not the classroom required check | `main` deploy path | Builds and deploys the site when configured secrets and Cloudflare pipeline permit it. Treat success as deployment evidence only when the run verifies the shipped SHA. |
| Nightly Heavy Suites | `.github/workflows/nightly.yml` | Not a default push blocker | Scheduled/manual | Expensive or broader health checks that should not be confused with required push truth. Includes `FPGA Bridge Proof`, which must remain enabled and use isolated proof ports rather than broad runner process cleanup. |

## Required Checks

GitHub branch protection currently requires the check context `Classroom Truth Gates` on `main`. That context is emitted by the job name in `.github/workflows/pr-truth-gates.yml`. Preserve that name unless you intentionally update branch protection and document the replacement.

Classic branch protection may let admins push while required checks are still pending or failing when admin enforcement is disabled. A successful push is therefore only source delivery. It is not proof that `main` is green.

## What Classroom Truth Gates Means

`Classroom Truth Gates` is the automated E0/classroom guardrail. It proves that the current source still satisfies the repository's push-level classroom promises:

- Lab starters are not pre-solved.
- The browser-backed IDE classroom loop still works.
- Deterministic golden Basys3 exports still match expected artifacts.
- Development-only UI escape hatches remain guarded.

It is not Vivado hardware proof. Vivado/Basys3 E1/E2/E3 evidence remains release/manual evidence unless a dedicated workflow is explicitly wired and documented for that environment.

## Handling Failing Runs

1. Inspect the remote run before changing code:

   ```powershell
   gh run list --repo swaggyp52/redbyte-ui-genesis --branch main --limit 30
   gh run view <run-id> --repo swaggyp52/redbyte-ui-genesis --log-failed
   gh api repos/swaggyp52/redbyte-ui-genesis/commits/main/check-runs
   gh api repos/swaggyp52/redbyte-ui-genesis/branches/main/protection
   gh api repos/swaggyp52/redbyte-ui-genesis/rulesets
   ```

2. Classify the failure as real product/test failure, environment/tooling failure, stale workflow command, stale required status, branch-protection mismatch, flaky test, obsolete test, hardware/manual-only gate, or unknown.

3. Reproduce the closest command locally before editing.

4. Fix the root cause. Do not delete a check only to stop notifications. Remove or quarantine a check only when it is obsolete, duplicated, stale, or manual-only, and document replacement coverage.

## Nightly FPGA Bridge Proof

`FPGA Bridge Proof` is an automated E0 bridge/mock proof inside `Nightly Heavy Suites`. It is not Vivado, bitstream, Basys3 programming, or physical observation evidence.

Default scheduled and manual Nightly runs include the maintained bridge proof. Optional strict screenshot baselines and FPGA UI Smoke are opt-in workflow-dispatch inputs because the screenshot job requires committed Linux baselines and the UI smoke job requires a maintained Hardware Panel Playwright target.

The proof should not kill arbitrary processes on fixed ports. In CI, run it with:

```yaml
RB_FPGA_PROOF_PORT_MODE: dynamic
```

The local fixed-port convention is HTTP `4242` and WS `4243`. If either fixed port is occupied in local auto mode, the proof runner may fall back to dynamic isolated ports. Use `pnpm -s bridge:proof-port-contract` to prove an unrelated listener on `4242` survives while the bridge proof and proof verifier pass.

## Verifying Remote Green

After pushing, wait for the new run:

```powershell
gh run list --repo swaggyp52/redbyte-ui-genesis --branch main --limit 10
gh run watch <run-id> --repo swaggyp52/redbyte-ui-genesis --exit-status
gh run view <run-id> --repo swaggyp52/redbyte-ui-genesis
gh api repos/swaggyp52/redbyte-ui-genesis/commits/main/check-runs
```

Final closeout must report the branch, commit hash, push result, `Classroom Truth Gates` run URL and conclusion, deploy workflow conclusion if relevant, and the honest live-impact boundary.
