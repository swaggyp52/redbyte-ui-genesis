# Apply Lane A Stack (Bundle + Verification)

## Included Range

- Base ref: `origin/main`
- Base commit: `e5368e5441dfabb3d18d5637301f9261db6489f3`
- Tip commit: `6612b3bc71795d3b93e4b69d6506fb4235f160cd`
- Range: `origin/main..HEAD`
- Bundle file: `codex_laneA_2026-02-18.bundle`

Commits in this range (oldest -> newest):

1. `c656ecce` `docs(ide): add pixel grid and spacing contract`
2. `ee703270` `feat(ui): enforce max-width and panel rhythm across modes`
3. `f2c93a59` `feat(project): compute readiness blockers from project data`
4. `f8ba411d` `feat(verify): finalize failure table and hash placement`
5. `8df3c303` `test(gates): add ide:gate:layout-contract`
6. `cbb93fc8` `docs(labs): add ECE141 Basys3 compatibility matrix`
7. `1f97ca10` `docs(roadmap): add executable ECE141 gap queue`
8. `813d3d5a` `feat(verify): unify sequential schedule for runner and testbench`
9. `00291198` `fix(export): emit real testbench and accept CLK100MHZ alias`
10. `81231cc7` `test(gates): add fixture03 import-verify-export parity check`
11. `8baeda07` `docs: record lane-a1 sequential parity implementation`
12. `723985f9` `test(import): enforce fixture03 clock schedule pattern and hash baseline`
13. `e9030112` `fix(export): block unmapped required ports with compiler-style diagnostics`
14. `6612b3bc` `docs: record lane-a parity hardening and export blocking`

## Apply via Bundle

```bash
git pull
git bundle verify codex_laneA_2026-02-18.bundle
git bundle unbundle codex_laneA_2026-02-18.bundle
git merge 6612b3bc71795d3b93e4b69d6506fb4235f160cd
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
