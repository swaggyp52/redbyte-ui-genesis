# scripts/push-deploy.ps1 — legacy local wrapper (NOT the deployment path)

> **Non-canonical.** The one canonical deployment path is documented in
> [`DEPLOYMENT.md`](../DEPLOYMENT.md): GitHub Actions builds `dist/` with
> `pnpm build:unified` and deploys via `cloudflare/wrangler-action@v3`
> (`wrangler pages deploy dist`). Pushing to `main` deploys production;
> pushing to `product/**` or `claude/**` deploys a preview.

`push-deploy.ps1` / `push-deploy.cmd` are a legacy local convenience wrapper
from an earlier era. Known limitations:

- They build only the manual-site, which is not the shipped unified `dist/`.
- `-VerifyLive` polls a `/build.txt` endpoint that no current build produces;
  the real deploy-verification endpoint is `/os/version.json` (full commit SHA).
- They do not deploy anything themselves; deployment happens in CI on push.

To ship a change: commit, push the branch, and let the
`Deploy to Cloudflare Pages` workflow build, deploy, and verify the SHA.
For a manual smoke against a deployed environment:

```bash
TARGET_URL=https://redbyteapps.dev COMMIT_SHA=<sha> node scripts/verify-deploy.mjs
```
