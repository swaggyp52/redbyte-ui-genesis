# Decision Ledger — Product-Core Convergence

Format: one dated entry per load-bearing decision. Newest first.

## 2026-08-29 — Session posture
- Continue on PR #82 head branch `claude/redbyte-desktop-build-m5ryqw` per directive §1/§24; no new product-depth PR.
- Local safety tag `safety/pre-product-core-convergence` at 9b730be (unpublished).
- All evidence claims stay Browser-E0. No Vivado/hardware claims. Golden export SHAs untouched (container Node 22 vs pinned 20.19.0).
- Vector model is built by extending existing authorities (circuit store + projectFormat + HDL exporters + ioBus convention), not a second graph model. The existing `Base[N]` label convention is promoted from display heuristic to declared model, keeping one logical identity through Design → Board → XDC.
