# RedByte P2 — Real HDL / Vivado Interoperability — RESUME

> Multi-session working ledger. This file is the single continuation point. Newest
> entry at the top of the **Commit ledger**. Canonical repo docs still win over this file.

## Program

Turn RedByte from a browser-native logic workbench into a **source-interoperable**
engineering system: a versioned, migration-safe project format; a first-class HDL
source/fileset model; bounded multi-language parsing with honest capability tiers;
source-backed modules with source↔visual cross-probe; an Import/Review/Recovery
program; a deterministic Vivado *digital-twin snapshot envelope* (generated
externally, never synthesized in-browser); a simulation *provider* architecture
(Browser Logic + Imported VCD) with honest evidence tiers; and a P3 cloud
control-plane **data-contract readiness report** (no auth implemented).

## Hard boundaries (never violate)

- **Browser-E0 honesty.** Never claim a Vivado run, synthesis, implementation,
  bitstream, timing, or programmed board happened in-browser. The virtual board is a
  browser logic mirror. Imported Vivado artifacts are *snapshots generated outside
  RedByte*, presented as evidence tiers — not as work RedByte performed.
- **One authority per concern.** `useProjectRuntime` (persisted), `state.sim`
  (ephemeral experiment), `hardwareMappingV2` (mapping), `hierarchy` (design), and
  the new **source model** each have exactly one writable owner. Everything else is a
  read-model/adapter.
- **Import is review-before-apply.** No silent replacement of user data; no Tcl
  execution; no source mutation during inspection.
- **Determinism.** No wall-clock timestamps or random IDs in serialized/exported/
  hashed paths. Format serialization is canonical and stable.
- **Pinned runtime** Node 20.19.0 / pnpm 10.24.0 for all validation.
- **Branch scope.** Push only to `claude/redbyte-product-core-convergence-n3pi6t`.
  Do not push to `main` or `product/redbyte-workbench-v3`. Do not deploy production.
- **No university authentication** in P2. P3 readiness is a *report* only.

## Branch / PR posture

- Working branch: `claude/redbyte-product-core-convergence-n3pi6t`, based on the
  consolidated P1 head `597337b` (= `product/redbyte-workbench-v3` + all 79 P1
  commits).
- P1 candidate remains **PR #82** (draft) — not merged here; left for Connor to
  merge/close via the GitHub UI (draft + protected base + this session's branch
  scope). P2 is stacked on top of the P1 head, so once #82 lands, the P2 PR's diff
  collapses to just P2.
- P2 draft PR targets `product/redbyte-workbench-v3`, titled
  "RedByte P2 — HDL and Vivado Interoperability".

## Slice plan (see task list #24–#31)

1. Versioned round-trip-safe project format + migration corpus. **(first)**
2. First-class source/fileset model (one source authority).
3. Language capability matrix + bounded parsing & diagnostics.
4. Source-backed modules + source↔visual cross-probe + params/generics.
5. Import / Review / Recovery program.
6. Simulation provider architecture + VCD import/Analyzer.
7. Vivado digital-twin snapshot envelope + constraint sets + package round-trip.
8. Reference project, scale/durability, a11y, legacy removal, P3 readiness report.

## Validation ritual (every slice)

- Focused vitest suites for the slice, under pinned Node 20.19.0.
- Per-file typecheck delta vs the branch point (raw `tsc` has a large pre-existing
  baseline the vite/esbuild build tolerates; compare counts, don't chase the baseline).
- Unified `@redbyte/rb-apps` build stays green before any push.
- Browser proof (Playwright, real UI, store read-only) for user-visible behavior;
  logged in `BROWSER_JOURNEYS.md`.
- Push every 3–5 coherent commits with `-u`.

## Commit ledger (newest first)

- _(pending)_ P2-1 starting: versioned project format contract.
- `597337b` P2 branch point (P1 candidate head; see PR #82).
