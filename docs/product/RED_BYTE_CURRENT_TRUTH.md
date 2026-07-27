---
doc_status: current
last_validated: 2026-07-27
owner: Connor Angiel
used_by_claude: true
role: compact current-truth control layer for RedByte product and agent sessions
---

# RedByte Current Truth

Use this document to stop source and proof drift before work starts. Code and
focused current tests win when prose lags.

## Stable Preview - Browser-E0

- Canonical clone: `C:\Users\conno\redbyte-ui-genesis-main`
- Canonical operating branch: `main`
- Preserved v2B candidate: `a5b67274f3c43820e89d538cbf2171256fef3759`
- Integrated product baseline: `66f901ff13b6ddd0a0a73a4328a95c4df5274886`
- Runtime: Node 20.19.0 / pnpm 10.24.0
- Startup: `corepack pnpm run dev`
- Local URL: `http://localhost:5173`

Historical RC and product worktrees are not current authority.

## Student Flow

```text
Project
-> Design Edit / Live
-> Verify Scenario / Replay / Optional Checks
-> Map Pins
-> Export
```

Import / Recover is a separate Upload -> Review -> Apply utility with explicit
cancel. Vivado and board activity are outside the RedByte-owned stages.

## State Authority

| State | Owner | Current rule |
|---|---|---|
| Project identity and saved snapshot | Project runtime | One current project; replacement is explicit and cancel-safe. |
| Circuit structure | Design Edit | Structural/semantic edits stale behavioral proof. |
| Exploratory values | Design Live | Useful for learning; not saved Verify evidence. |
| Stimulus and checks | Named Verify scenario | Stimulus always runs; expected-output checks are optional. |
| Observed trace and Replay | Current Verify run | Read-only evidence; stale after relevant semantic change. |
| Signal-to-pin mapping | Map Pins | One semantic logical-signal/resource/package-pin/XDC projection. |
| Generated package | Export | Downloadable and trusted are distinct; download never creates trust. |
| Recovery candidate | Import | Active project changes only after explicit Apply. |

## Supported Sequential Boundary

Supported:

- Register1;
- one clock;
- rising-edge capture;
- active-high asynchronous reset;
- supported active-high enable behavior;
- manual clock/reset scenarios and current Replay;
- canonical `CLK100MHZ/W5` mapping when the project exposes a board clock.

Blocked:

- RegisterBus and StateBank execution/export;
- falling-edge capture;
- multiple clocks;
- active-low reset;
- unsupported register modes.

An authored high-to-low transition is valid stimulus and must hold
rising-edge state; it is not falling-edge-triggered capture.

## Proof Tiers

| Tier | Meaning |
|---|---|
| E0 | Browser behavior and generated package evidence for the current project. |
| E1 | Vivado synthesis, implementation, and bitstream generation completed. |
| E2 | A bitstream was programmed onto a Basys3. |
| E3 | Physical behavior matched an explicit observation procedure. |

This stable preview has Browser-E0/local evidence. It does not by itself prove
E1, E2, E3, production readiness, or unsupervised classroom reliability.

## Current Documents

1. `AI_STATE.md`
2. `docs/ACTIVE_WORK.md`
3. `docs/product/RED_BYTE_CURRENT_TRUTH.md`
4. `docs/product/RED_BYTE_WORK_QUEUE.md`
5. `docs/contracts/RED_BYTE_V1_PRODUCT_CONTRACT.md`
6. `docs/manuals/RedByte_Product_Manual.md`
7. `docs/product/RED_BYTE_STABLE_PREVIEW_CLOSEOUT.md`

Use `docs/DOC_INDEX.md` for stale-zone routing. The 00-canon FPGA documents are
background only when they conflict with current code or the documents above.

## Recovery

The pre-consolidation archive is
`C:\Users\conno\RedByteArchive\2026-07-27\`. It includes a verified all-refs
bundle, ignored product-immersion evidence, manual artifacts, and the original
branch/tag/worktree inventory.
