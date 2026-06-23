---
doc_status: current
last_validated: 2026-06-23
owner: Connor Angiel
used_by_claude: true
role: PR78 Product Trust Reset v2 performance and resource review
---

# RedByte PR78 Performance Review

This review covers draft PR #78 on `product/redbyte-trust-reset-v2` through Phase 6. It is a branch-review artifact, not a release benchmark certificate.

## Scope

Reviewed:

- unified production build
- Vite bundle output
- classroom rehearsal runtime behavior
- storage growth and recovery sidecar bounds
- obvious process leaks from preview/rehearsal gates
- Phase 5 focused outer-workflow browser gates and build output
- Phase 6 pilot-readiness browser audit and current production build output

Not reviewed:

- exact origin/main bundle rebuild in a clean separate worktree
- long-running browser memory profiling
- hardware/Vivado runtime
- production CDN Web Vitals

## Current Build Observation

`corepack pnpm -s build:unified` completed successfully under the repo-pinned Node path in the Phase 6 audit setup.

Observed largest Vite assets from the production build:

| Asset | Size | Gzip | Note |
|---|---:|---:|---|
| `index-*.js` | 738.49 kB | 207.01 kB | main app bundle |
| `index-*.css` | 855.38 kB | 126.80 kB | accumulated IDE CSS |
| `DesignSurface-*.js` | 285.77 kB | 76.03 kB | lazy surface |
| `VerifySurface-*.js` | 246.17 kB | 67.27 kB | lazy surface |
| `client-*.js` | 180.99 kB | 56.95 kB | shared client/runtime |
| `ImportSurface-*.js` | 118.26 kB | 32.17 kB | lazy surface |
| `ExportSurface-*.js` | 114.12 kB | 31.05 kB | lazy surface |
| `HardwareSurface-*.js` | 101.34 kB | 26.16 kB | lazy surface |

The Phase 6 browser audit then served build JSON matching reviewed head prefix `6c9575b80` and captured 27 screenshots with no page/browser errors and no root overflow findings.

## Resource Findings

| Area | Finding | Severity |
|---|---|---|
| Bundle size | CSS is large and remains the most obvious maintainability/performance risk. Phase 3I did not add product CSS. | P2 |
| Runtime JS | Lazy surface split remains intact; no Phase 3I feature bundle growth beyond small gate/rehearsal scripts. | P2 |
| Storage growth | Facade recovery points are bounded and surfaced in Diagnostics; 30-context rehearsal records recovery count instead of allowing silent unbounded growth. | P1 covered by Phase 3H gates |
| Journal growth | Current journal is one committed/pending sidecar, not an append-only unbounded log. | P1 covered by Phase 3H gates |
| Process leaks | Rehearsal harness stops preview processes in `finally`; Phase 3I fault-injection runs completed without leaving the wrapper active. | P2, recheck before final closeout |
| Main comparison | Exact clean `origin/main` performance delta was not generated in Phase 3I because the branch review stayed on the draft PR worktree. Run a throwaway clean worktree comparison before non-draft release readiness. | P2 |
| Phase 5 surfaces | Project/Export/Import V2 added surface CSS and one shared browser-gate script; no runtime generator, parser, storage-format, or hardware path was added. | P2 |
| Phase 6 review | The review added docs and ignored local evidence only; no runtime code, parser, generator, storage format, or dependency path was changed. | None |

## Thresholds Before Non-Draft

- `build:unified` must pass on the final head.
- Final current-build smoke must verify the visible build hash and `/os/build.json`.
- No obvious unbounded storage growth may be introduced without a cap and diagnostics path.
- CSS size should not materially increase during Phase 6 without retiring old selectors or documenting why.
- If the main app bundle grows materially, record the reason in the PR body before marking non-draft.

## Decision

No Phase 6 P0/P1 performance blocker was found. The branch carries P2 size/CSS debt that should be addressed before any public release-candidate claim.

## Attribution

Connor Angiel
