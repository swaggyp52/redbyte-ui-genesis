# Release Process

RedByte OS Genesis uses [Changesets](https://github.com/changesets/changesets) for version management and automated releases.

## Overview

- **Changesets** track which packages need version bumps
- **GitHub Actions** automate versioning and publishing
- **npm** hosts all `@redbyte/*` packages (public access)
- **Cloudflare Pages** hosts documentation site

---

## Creating a Changeset

When you make changes that should trigger a release, create a changeset:

```bash
pnpm changeset
```

This will:
1. Ask which packages changed
2. Ask for major/minor/patch bump
3. Prompt for a summary of changes
4. Create a `.changeset/*.md` file

### Changeset Guidelines

**Major** (Breaking changes):
- Changed or removed public APIs
- Changed behavior that breaks existing usage
- Removed exports

**Minor** (New features):
- Added new exports or features
- Enhanced existing features (backwards compatible)
- New components or utilities

**Patch** (Bug fixes):
- Bug fixes
- Documentation updates
- Internal refactoring (no API changes)

---

## Release Flow

### 1. Development

1. Make your changes in a feature branch
2. Create changeset(s): `pnpm changeset`
3. Commit changeset files with your changes
4. Open a pull request to `main`

### 2. Automated Release PR

When changesets are merged to `main`:

1. GitHub Actions detects changesets
2. Creates/updates a "Version Packages" PR
3. PR includes:
   - Updated package versions
   - Updated `CHANGELOG.md` files
   - Consumed changesets (deleted)

### 3. Publishing

When "Version Packages" PR is merged:

1. GitHub Actions runs release workflow
2. Publishes changed packages to npm with provenance
3. Creates git tags for each version
4. Builds and deploys documentation to Cloudflare Pages

---

## Manual Release

If needed, you can release manually:

```bash
# 1. Version packages (consumes changesets, updates package.json)
pnpm changeset:version

# 2. Build all packages
pnpm build

# 3. Publish to npm (requires NPM_TOKEN)
pnpm changeset:publish
```

---

## GitHub Actions Workflows

### CI Workflow (`.github/workflows/ci.yml`)

Runs on every PR and push to `main`:

- ✅ **Lint**: ESLint + Prettier
- ✅ **Type Check**: TypeScript compilation
- ✅ **Test**: Vitest unit tests
- ✅ **Build**: Production builds

**Required for merge**: All jobs must pass.

### Release Workflow (`.github/workflows/release.yml`)

Runs on push to `main`:

1. **Version & Publish**
   - Checks for changesets
   - Creates "Version Packages" PR (if changesets exist)
   - Publishes packages (if Version PR is merged)
   - Uses npm provenance for security

2. **Deploy Docs**
   - Builds VitePress documentation
   - Deploys to Cloudflare Pages
   - Live at: `redbyte-docs.pages.dev`

---

## Environment Setup

### GitHub Secrets Required

```
NPM_TOKEN                 # npm publish token (automation)
CLOUDFLARE_API_TOKEN      # Cloudflare Pages deploy token
CLOUDFLARE_ACCOUNT_ID     # Cloudflare account ID
```

### npm Setup

1. Create npm access token (Automation type)
2. Add as `NPM_TOKEN` secret in GitHub
3. Ensure packages are scoped `@redbyte/*`
4. Changesets config has `"access": "public"`

### Cloudflare Setup

1. Create Cloudflare Pages project: `redbyte-docs`
2. Generate API token with Pages write permissions
3. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets

---

## Package Configuration

All `@redbyte/*` packages must have in `package.json`:

```json
{
  "name": "@redbyte/package-name",
  "version": "x.y.z",
  "private": false,
  "publishConfig": {
    "access": "public"
  }
}
```

Apps (`playground`, `docs`, `studio`) should have:

```json
{
  "private": true
}
```

---

## Changesets Configuration

See `.changeset/config.json`:

```json
{
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "access": "public",
  "baseBranch": "main",
  "ignore": ["playground", "docs", "studio"]
}
```

- **access**: "public" for npm publishing
- **ignore**: Apps are never published
- **baseBranch**: main (for release PRs)

---

## Troubleshooting

### Changeset not detected

- Ensure `.changeset/*.md` files are committed
- Check GitHub Actions logs
- Verify changeset is not for ignored packages

### Publish failed

- Check NPM_TOKEN is valid
- Ensure package versions don't already exist on npm
- Verify package.json `publishConfig.access` is "public"

### Docs deploy failed

- Check Cloudflare API token permissions
- Verify project name matches `redbyte-docs`
- Ensure build succeeds locally: `pnpm --filter docs build`

---

## Best Practices

1. **One changeset per logical change**
   - Don't bundle unrelated changes
   - Makes changelogs clearer

2. **Write clear summaries**
   - Users read these in changelogs
   - Explain what changed and why

3. **Version appropriately**
   - Follow semver strictly
   - When in doubt, use patch

4. **Test before merging**
   - CI must be green
   - Test packages locally if possible

5. **Review Version PRs carefully**
   - Check version bumps are correct
   - Review generated changelogs
   - Ensure all changesets consumed

---

## Example Workflow

```bash
# 1. Create feature branch
git checkout -b feature/add-button-component

# 2. Make changes
# ... edit files ...

# 3. Create changeset
pnpm changeset
# Select: @redbyte/rb-primitives
# Type: minor
# Summary: "Add Button component with primary/secondary variants"

# 4. Commit everything
git add .
git commit -m "feat(primitives): add Button component"

# 5. Push and create PR
git push origin feature/add-button-component
# Open PR on GitHub

# 6. After PR approved and merged
# - GitHub Actions creates "Version Packages" PR
# - Review and merge Version PR
# - Packages auto-publish to npm
# - Docs auto-deploy to Cloudflare
```

---

## Support

For issues with releases:
- Check [Changesets docs](https://github.com/changesets/changesets)
- Review GitHub Actions logs
- Contact team in #releases channel

---

**Last updated:** 2025-12-07
