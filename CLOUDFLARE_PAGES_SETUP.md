# Cloudflare Pages Deployment Setup

Canonical Cloudflare Pages build settings for this repo:

- Build command: `pnpm build:unified`
- Build output directory: `dist`
- Root directory: `/`

Cloudflare Pages already installs dependencies before running the build command. Do not prepend an install step in the dashboard command.

Use this:

```bash
pnpm build:unified
```

Do not use this:

```bash
pnpm install --frozen-lockfile && pnpm build:unified
```

## Preferred Deploy Path

Primary production deploy remains GitHub Actions direct upload:

- Workflow: `.github/workflows/deploy-cloudflare.yml`
- Build: `pnpm -s build:unified`
- Upload path: `dist/`

If Cloudflare dashboard auto-builds are enabled, they must use the same canonical build command and output directory above.
