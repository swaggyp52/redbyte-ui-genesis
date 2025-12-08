# Release Checklist

This document outlines the steps required to publish a new version of RedByte packages and deploy the documentation.

## Pre-Release Verification

### 1. Run Quality Gates

Ensure all tests and checks pass:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

All commands must complete without errors.

### 2. Verify Package Structure

Test that all packages are ready for publication:

```bash
pnpm -r --workspace-concurrency=1 exec npm publish --dry-run
```

Verify each package includes:
- `dist/` files
- `package.json` with correct exports
- `README.md`
- Correct peer dependencies
- No bundled React

## Release Process

### 3. Create Changesets

Document changes for the release:

```bash
pnpm changeset
```

Follow the prompts to:
- Select changed packages
- Specify semver bump type (major, minor, patch)
- Write user-facing change description

### 4. Version Bump & Changelog

Generate version numbers and update CHANGELOGs:

```bash
pnpm changeset version
pnpm install
```

This will:
- Update `package.json` versions
- Generate/update `CHANGELOG.md` files
- Update lockfile

### 5. Commit Version Changes

```bash
git add .
git commit -m "chore: version packages"
```

### 6. Publish Packages

Publish all packages to npm:

```bash
pnpm -r publish --access public
```

You must be logged in to npm: `npm login`

Each package will be published with the new version number.

### 7. Tag Release

Create and push git tag:

```bash
git tag v1.0.0
git push origin main --tags
```

Replace `v1.0.0` with the actual version.

### 8. Deploy Documentation

Documentation deploys automatically via Cloudflare Pages when changes are pushed to `main`.

Monitor deployment:
- Check GitHub Actions: https://github.com/swaggyp52/redbyte-ui-genesis/actions
- Verify Cloudflare Pages dashboard

## Post-Release Verification

### 9. Verify Deployment

Check the following:

**Package Availability**
- [ ] Packages visible on npmjs.com
- [ ] Installation works: `npm install @redbyte/rb-shell`
- [ ] TypeScript types resolve correctly

**Documentation Site**
- [ ] Docs site loads correctly
- [ ] All pages render properly
- [ ] Navigation works
- [ ] Assets load (images, icons, etc.)

**Application Functionality**
- [ ] Example circuits load correctly
- [ ] Logic Playground import/export works
- [ ] Shareable links (`?circuit=...`) function
- [ ] Desktop shell launches properly
- [ ] All apps open and close correctly

**Visual Verification**
- [ ] Wallpapers display correctly
- [ ] Favicons show in browser tabs
- [ ] Social cards render on Twitter/LinkedIn
- [ ] Studio app screenshots are up to date

### 10. Announce Release

After verification:
- Update GitHub Release notes
- Share announcement on social media
- Notify community in discussions

## Rollback Procedure

If issues are discovered post-release:

1. **Deprecate problematic version:**
   ```bash
   npm deprecate @redbyte/package-name@1.0.0 "Critical bug, use v1.0.1"
   ```

2. **Publish hotfix:**
   - Fix the issue
   - Follow steps 3-8 with patch version
   - Verify fix before announcing

3. **Revert git tag (if needed):**
   ```bash
   git tag -d v1.0.0
   git push origin :refs/tags/v1.0.0
   ```

## Notes

- Always test in a staging environment before production release
- Keep changelog entries user-focused and clear
- Document breaking changes prominently
- Maintain backward compatibility when possible
- Follow semantic versioning strictly

---

**Last Updated:** 2025-12-08
