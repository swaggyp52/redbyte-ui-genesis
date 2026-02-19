# Apply Lane A Stack (Bundle + Verification)

## Included Range

- Base ref: `origin/main`
- Base commit: `e5368e5441dfabb3d18d5637301f9261db6489f3`
- Tip ref: `HEAD` (the local stack tip at bundle creation time)
- Range: `origin/main..HEAD`
- Bundle file: `codex_laneA_2026-02-18.bundle`

To print the exact commits included in your local stack:

```bash
git log --oneline --reverse origin/main..HEAD
```

## Apply via Bundle

```bash
git pull
git bundle verify codex_laneA_2026-02-18.bundle
git bundle unbundle codex_laneA_2026-02-18.bundle
git merge <bundle-tip-sha-from-verify-or-unbundle-output>
git push
```

## Alternative Apply via Patch Series

```bash
git format-patch origin/main..HEAD -o codex_patches
```

On target machine:

```bash
git pull
git am codex_patches/*.patch
git push
```

## Fallback Base (if `origin/main` is unavailable locally)

Use the base hash directly when creating artifacts:

```bash
git bundle create codex_laneA_2026-02-18.bundle e5368e5441dfabb3d18d5637301f9261db6489f3..HEAD
git format-patch e5368e5441dfabb3d18d5637301f9261db6489f3..HEAD -o codex_patches
```

## Post-Apply Verification

Run these before push/PR:

```bash
pnpm repo:status
pnpm gates:import-roundtrip
pnpm -s rc:d2:basys3-bundle-gate
```
