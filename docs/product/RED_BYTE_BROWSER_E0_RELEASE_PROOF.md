---
doc_status: current
last_validated: 2026-06-19
owner: Connor Angiel
used_by_claude: true
role: browser E0 release proof package and runtime proof status
---

# RedByte Browser E0 Release Proof

This document records the current browser E0 release proof package. It is software/browser proof only. It does not prove Vivado synthesis, implementation, bitstream programming, Basys3 behavior, or physical board observation.

## Current Proof Commit

- Source commit under proof: `52d0b9172dab244ca7f9070e49ed28cef986f8bf`.
- Branch: `main`.
- Remote: `https://github.com/swaggyp52/redbyte-ui-genesis.git`.
- Release proof package: pinned runtime and docs proof sprint, 2026-06-19.

Because a tracked proof document cannot contain the hash of the commit that first adds itself without changing that hash, final pushed-commit and deployed-SHA proof must be verified in the session closeout after this document is committed.

## Runtime Proof Status

Pinned runtime:

- `.nvmrc`: `20.19.0`.
- Node `20.19.0` status: passed with a repo-local portable runtime.
- Runtime path: `.redbyte/tools/node-v20.19.0/node.exe`.
- Setup source: `https://nodejs.org/dist/v20.19.0/node-v20.19.0-win-x64.zip`.
- Checksum source: `https://nodejs.org/dist/v20.19.0/SHASUMS256.txt`.
- Verified SHA-256: `be72284c7bc62de07d5a9fd0ae196879842c085f11f7f2b60bf8864c0c9d6a4f`.
- Proof artifact: `.redbyte/product-immersion/pinned-runtime-release-proof/2026-06-19/node20-portable-setup.txt`.

Current shell default:

- Node `v24.15.0`.
- pnpm `10.24.0`.
- Node 24 remains useful supporting evidence, but the pinned-runtime release subset now has direct Node 20 proof.

Install/provisioning notes:

- No existing `nvm`, `fnm`, `volta`, `nvs`, `nodist`, `mise`, or `asdf` command was available.
- `winget` was available, but it was not used because a repo-local portable Node runtime avoided global PATH changes and admin requirements.
- The portable runtime and downloaded binaries live under ignored `.redbyte/tools/` and must not be committed.
- The proof commands used process-scoped `PATH`, `COREPACK_HOME`, and `PNPM_HOME`.
- The first `pnpm install --frozen-lockfile` attempt hit the non-TTY remove-module safeguard; rerunning with `CI=true` then exposed a stale-server lock on a Rollup native binary.
- Stale repo-local Vite servers from old ports were stopped, then `CI=true corepack pnpm install --frozen-lockfile` passed under Node `v20.19.0`.

## Node 20 Proof Commands

The meaningful release subset passed under Node `v20.19.0` and pnpm `10.24.0`:

- `corepack pnpm install --frozen-lockfile`
- `corepack pnpm -s build:unified`
- `corepack pnpm -s ide:gate:release-candidate-decision`
- `corepack pnpm -s ide:gate:final-current-build-smoke`
- `corepack pnpm -s ide:gate:authoring-depth-release-safety`
- `corepack pnpm -s ide:gate:student-task-completion-flow`
- `corepack pnpm -s classroom:gate`
- `corepack pnpm -s rb:doc:validate`
- `corepack pnpm -s rb:encoding:check`
- `git diff --check`

The full `classroom:gate` run passed under Node 20, including unified build, Project, Design, Verify, Hardware, Export, Import, shell/workbench gates, ZIP import contract, and determinism/parity tests.

## Browser E0 Flows Proven

The current browser proof package covers:

- Project first launch, loaded Project, identity editing, command paths, and loaded workflow-help behavior.
- Design starter and blank authoring, selected node direct edits, library/tool windows, wire/delete/undo, and reload smoke.
- Verify no-circuit recovery, pre-run stimulus/checks, Compare PASS, intentional expected-output FAIL, repair PASS, Signals open/closed, evidence clarity, and post-run continuation.
- Hardware / Map Pins browser E0 mapping visibility from project signal to Basys3 resource, package pin, and XDC consequence.
- Export browser E0 handoff, generated artifact inspection, package checklist, download/trust boundary, and no E1/E2/E3 overclaim.
- Import utility recovery first look, active Paste HDL / unsupported-example layout, review/apply safety boundary, and no imported-proof overtrust.
- Navigation, reload, active mode URL sync, and browser Back/Forward mode restoration through Project, Design, and Verify.

## Stop-Ship Rules

Release proof must stop for:

- visible build hash mismatch with current local HEAD
- workspace error boundary
- dynamic import or lazy-surface failure
- console/page error from the exercised flow
- root horizontal overflow at supported viewports
- stale dev server or stale build evidence
- GitHub `Classroom Truth Gates`, deploy, or Cloudflare Pages red state
- deployed `/os/build.json` or `/os/version.json` not reporting the expected final SHA

## Final SHA Proof Rules

- Before final closeout, rebuild `@redbyte/playground` or run `build:unified`.
- With a clean tracked worktree, run `ide:gate:release-final-sha-discipline`.
- After push and deploy, verify `https://redbyteapps.dev/os/version.json` reports the final full SHA.
- Also verify `https://redbyte-ui-genesis.pages.dev/os/build.json` or `/os/version.json` reports the final short or full SHA.
- The final response must record the actual final commit and deployed SHA; this document records the stable proof protocol and current source proof.

## Current Blockers Before Package Or Commercial Release

- Final pushed proof-package commit must be rebuilt, deployed, and SHA-verified after this docs update.
- Project and Verify still have visual-density/card-composition maturity debt before a polished package/commercial claim.
- Commercial/licensed delivery needs legal/licensing, distribution packaging, support docs, operational ownership, and classroom support posture closed explicitly.
- Vivado/Basys3 E1-E3 claims remain blocked until actual Vivado 2024.2 and physical-board evidence is collected.

## No Hardware Claim

No Vivado build, bitstream programming, Basys3 programming, or physical board observation was run or claimed in this proof package.

## Next Required Evidence

1. Commit this proof package, rebuild, run final-current build smoke, push, and verify deployed SHA for the final commit.
2. Run one browser-first product-owner pass on remaining Project/Verify density if package polish is the next goal.
3. Run Vivado/Basys3 proof only on a machine with Vivado 2024.2 and board access before making E1/E2/E3 claims.
