# Proof: custom project Vivado hardening batch (2026-04-29)

## 1. Goal

Move beyond canned example certification by proving that blank-shaped custom projects can produce deterministic RedByte exports and real Vivado bitstreams on the lab machine.

## 2. Commit and environment

- Commit tested: `259ae16ae0f840ecfbeb1bdb2741c9f4d2d4e5ac`
- Machine: Windows lab machine with terminal access
- Toolchain: Vivado 2024.2
- Board family: Basys3 (`xc7a35tcpg236-1`)

## 3. Harness added

- Script: `scripts/vivado-cert-custom-project.ts`
- Package command: `pnpm lab:vivado:cert:custom`
- Purpose: take a custom project source, export the repo-owned Open Project bundle, run canonical Vivado batch flow, optionally program the board, and preserve deterministic artifacts under `out/vivado-cert/custom-projects/<case-id>/`

## 4. Cases run

| Case ID | Source | Result | Key artifacts |
|---------|--------|--------|---------------|
| `fs-comb-switch-and` | in-repo blank fixture | E1 pass | `out/vivado-cert/custom-projects/fs-comb-switch-and/result.md` |
| `fs-seq-two-bit-counter` | in-repo blank fixture | E1 pass | `out/vivado-cert/custom-projects/fs-seq-two-bit-counter/result.md` |
| `fs-custom-four-switch-led` | tracked `.rbproj` fixture | E1 pass | `out/vivado-cert/custom-projects/fs-custom-four-switch-led/result.md` |
| `fs-custom-mixed-gate-chain` | tracked `.rbproj` fixture | E1 pass | `out/vivado-cert/custom-projects/fs-custom-mixed-gate-chain/result.md` |

## 5. Focused validation

```powershell
pnpm -w exec vitest run packages/rb-apps/src/__tests__/from-scratch-basys3-cert-fixtures.test.ts packages/rb-apps/src/__tests__/custom-vivado-cert-fixtures.test.ts --pool forks --poolOptions.forks.singleFork
```

Result: pass (`6` tests).

## 6. Meaningful findings

1. The first harness implementation accidentally imported IDE bring-up helpers that require Vite `import.meta.env`; this broke `tsx` execution on the lab machine. The harness was simplified to keep terminal-safe artifact generation local to the script.
2. The custom four-switch/four-LED passthrough project still builds to a valid bitstream, but Vivado emits an "empty top module" warning after optimization because the design reduces to direct I/O buffering. This is a tooling caveat, not a failing RedByte export.
3. The new harness gives deterministic, inspectable evidence for custom projects without needing to reinvent the Vivado flow outside the repo-owned Tcl scripts.

## 7. Remaining proof gap

- These custom rows have real E1 proof, but custom E2/E3 board proof is still pending.
- The browser-authored from-scratch student loop and updated Verify workbench rehearsal are still open follow-up work for this campaign.
