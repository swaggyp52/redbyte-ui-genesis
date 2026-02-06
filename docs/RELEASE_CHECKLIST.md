# Release Checklist v1.0.0

This document is the **single source of truth** for releasing RedByte v1.0.0 to production.

## Pre-Release Gate (Local + CI)

**All of these must be green before tagging v1.0.0:**

```bash
# Local validation
pnpm ci:parity                    # All tests, lint, build, gates
pnpm build                        # Full monorepo build
echo "Exit code should be 0"      # Confirm no errors
```

**CI/CD Checks (GitHub Actions on main SHA before tag):**
- [ ] Quality Gate (Build + Test + Lint) — **PASS**
- [ ] FPGA Bridge Proof — **PASS**
- [ ] Smoke Test (Zip Install) — **PASS**
- [ ] cloudflare-smoke — **PASS**
- [ ] Deploy to Cloudflare Pages — **PASS**

If any check is red, **do not tag**. Fix forward or revert.

---

## Release Artifacts

Before tagging, verify these files exist and are current:

```bash
# Version metadata
cat packages/rb-shell/src/version.ts      # VERSION, GIT_SHA, BUILD_DATE

# License audit
cat docs/licenses.snapshot.json | wc -l   # Should be ~30+ lines (27 deps)

# Dev guards audit
cat docs/DEV_DEBUG_FLAGS.md | head -20    # Should document registry

# UI tokens
cat docs/UI_STYLE_GUIDE.md | head -15     # Should show 20 tokens

# Settings/About
# Verify Settings → About shows version string at runtime
```

---

## Tag Command

Once all gates are green and artifacts verified:

```bash
# Tag the release
git tag -a v1.0.0 -m "chore(release): RedByte v1.0.0

- Phase 5 complete: canonical tokens, dev guards, license audit
- All deterministic gates passing (83+ tests)
- All CI checks passing (Quality, Bridge, Smoke, Deploy)
- Ready for classroom deployment
- Post-release: v1-maintenance branch for hotfixes only"

git push origin v1.0.0

# Verify tag on GitHub
# https://github.com/[OWNER]/redbyte-ui/releases/tag/v1.0.0
```

---

## Manual Smoke Run (15 min, High-Signal)

**Do this once before declaring v1.0 "done":**

1. **Boot Clean**
   - [ ] Clear localStorage or use fresh incognito session
   - [ ] Navigate to production URL (Cloudflare Pages)
   - [ ] Verify no console errors on load
   - [ ] Verify Help sidebar and Dock visible

2. **Virtual Lab Workflow**
   - [ ] Click Dock → Virtual Lab
   - [ ] Create simple AND circuit (2 inputs + 1 output)
   - [ ] Add some probes
   - [ ] Run simulation 100 ticks
   - [ ] Verify waveform shows expected behavior

3. **Export Evidence**
   - [ ] Files → Select `.rbx` file → Shift+Enter → Logic Playground (if applicable)
   - [ ] Export as `.rb-lab.zip`
   - [ ] Verify `.zip` contains expected bundle structure

4. **Performance Mode Toggle**
   - [ ] Settings → Oscilloscope tab (if visible)
   - [ ] Toggle Performance Mode ON/OFF
   - [ ] Verify oscilloscope rendering updates appropriately (no lag)

5. **Hardware Dry-Run**
   - [ ] Settings → (Hardware or Lab settings)
   - [ ] Toggle to Dry-Run mode
   - [ ] Run program flow (if available in UI)
   - [ ] Verify no crashes, deterministic output

6. **Error Boundary Test**
   - [ ] Settings → (any) Error Trigger (if available, or manually trigger via console)
   - [ ] Verify ErrorBoundary shows: "Something went wrong"
   - [ ] Click Reload button
   - [ ] Click "Help" (Factory Reset hint)
   - [ ] Verify Settings → Filesystem Data works post-recovery

---

## Deployment Rollback Procedure

**If production has issues, rollback to previous SHA:**

```bash
# Get previous release tag (if exists)
git tag | sort -V | tail -2

# OR: manually identify the known-good SHA
GOOD_SHA="abc123def456"

# Re-deploy previous version from CI
# (Provider-specific: Cloudflare Pages rebuild, Vercel deploy, etc.)

# OR: manually build and deploy locally
git checkout ${GOOD_SHA}
pnpm -r build
pnpm ship:gate  # If applicable

# Once rolled back, create a patch release or hotfix branch
git checkout main
git checkout -b v1-maintenance
# cherry-pick critical fixes
# tag v1.0.1
```

---

## Post-v1.0 Branch Policy

Once v1.0.0 is tagged:

- **v1-maintenance**: Hotfix-only branch (backport critical fixes from main)
- **main**: Open for v1.1+ features and improvements
- **develop** (optional): Long-running feature branches if preferred

**Merge rule**: main is always deployable. Hotfixes go to v1-maintenance, cherry-picked to main.

---

## CI/CD Status Dashboard

Check live status:

```bash
# GitHub Actions view
# https://github.com/[OWNER]/redbyte-ui/actions

# Latest deployment
# https://github.com/[OWNER]/redbyte-ui/deployments

# Cloudflare Pages
# https://dash.cloudflare.com → Pages → redbyte-ui
```

---

## Sign-off Checklist

Before declaring v1.0.0 "complete":

- [ ] Local `pnpm ci:parity` is green
- [ ] GitHub Actions all 5 checks passing on latest main SHA
- [ ] Version string visible in Settings/About (current git SHA)
- [ ] License audit passing (27 deps, no UNKNOWN/forbidden)
- [ ] Dev guards gate passing (15 globals documented)
- [ ] UI tokens gate passing (20 tokens verified)
- [ ] Manual smoke run completed (all 6 steps)
- [ ] Rollback procedure documented and tested (at least mental walkthrough)
- [ ] Tag `v1.0.0` created and pushed
- [ ] GitHub release page shows tag with description
- [ ] Cloudflare Pages serving latest SHA from tag
- [ ] Slack / team notified of v1.0.0 release (if applicable)

---

## Post-Release Tasks (Not Blocking v1.0.0)

- [ ] Classroom pilot run (real students, real hardware)
- [ ] Gather feedback → open v1.1 issues
- [ ] Update documentation with deployed URL
- [ ] Archive old preview builds (cleanup)
- [ ] Monitor error reporting (if telemetry configured)

---

**Status**: Ready for release pending CI green confirmation.

**Target Date**: February 6, 2026 (if all checks pass)

**Release Manager**: (Engineer running this checklist)

**Approved By**: (Code owner / maintainer sign-off)

---

*Last updated: February 6, 2026*

*Next review: Post-v1.0.0 deployment (commit this checklist as part of release)*
