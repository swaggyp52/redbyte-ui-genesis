# push-deploy.ps1: RedByte Automated Deploy Script

## Usage

Run from anywhere in the repo:

```powershell
./scripts/push-deploy.ps1 -Message "Describe change" [-Branch <name>] [-NoTests] [-Force] [-DryRun]
```

✅ Correct:
```powershell
./scripts/push-deploy.ps1 -DryRun -Message "hello world"
```

✅ Also correct (wrapper):
```powershell
./scripts/push-deploy.cmd -DryRun -Message "hello world"
```

🚫 Incorrect:
```powershell
./scripts/push-deploy.ps1 -Message=hello
```

- `-Message` (required if committing): Commit message for staged/uncommitted changes.
- `-Branch` (optional): Branch to deploy (default: current branch).
- `-NoTests` (optional): Skip tests/build steps.
- `-Force` (optional): Bypass interactive prompts.
- `-DryRun` (optional): Print actions without executing.

## What It Does

1. Verifies git repo state and remote `origin`.
2. Stages and commits changes (if any), or redeploys last commit.
3. Pushes to GitHub.
4. Triggers Cloudflare deploy (auto-detects Pages/Workers/wrangler).
5. Verifies deployment and prints:
   - Deployment status
   - Production URL (redbyteapps.dev)
   - Commit hash and branch
   - Deployment/build ID

## Required Environment Variables

- `CLOUDFLARE_API_TOKEN` (for API verification)
- `CLOUDFLARE_ACCOUNT_ID` (for API verification)
- `CLOUDFLARE_PROJECT_NAME` (if not auto-detected)

## Troubleshooting

- If deploy verification fails, ensure API tokens are set and valid.
- If no changes are staged, script allows redeploy of last commit.
- For Cloudflare Pages via GitHub, deploy is triggered by push; script verifies via API if possible.
- For direct Wrangler deploy, ensure `wrangler.toml` exists and credentials are set.

## Example

```powershell
./scripts/push-deploy.ps1 -Message "Fix homepage bug"
```

## Production URL

- https://redbyteapps.dev

---
For more details, see `.github/workflows/deploy-cloudflare.yml` and `deploy.ps1`.
