---
doc_status: current
last_validated: 2026-10-01
owner: Connor Angiel
used_by_claude: true
role: compact current-truth control layer for RedByte product and agent sessions
---

# RedByte Current Truth

Use this document to stop source and proof drift before work starts. Code and
focused current tests win when prose lags.

## Current local candidate - Browser E0 (2026-10-01)

- Canonical clone: `C:\Users\conno\redbyte-ui-genesis-main`
- Inspected branch: `claude/redbyte-studio-completion-p2-6-q7m3v8`
- Starting HEAD: `f382211956b5e2748b0f02f238a4d637a627334b`; reviewed completion work is organized into local commits. Unrelated owner edits remain separate. The newest finish ticket records final identity and acceptance.
- Exact built candidate identity includes its source content digest in `build.json`, `os/version.json`
  and the distribution's `candidate.json`. HEAD alone does not identify a dirty checkout.
- Runtime: Node 20.19.0 / pnpm 10.24.0
- Startup: `corepack pnpm run dev`
- Development URL comes from the actual Vite startup output. The standalone Windows candidate
  uses `http://127.0.0.1:5188/os/`; these are different browser storage origins.

Historical RC and product worktrees are not current authority.

## Current product and delivery scope

- Existing delivery context: PR #86 stacked on PR #85's feature branch. This local assignment
  does not authorize remote changes or merging either PR. See the current finish ticket.
- Current candidate scope: one integrated Studio shell and persistent project
  authority across Project, Design, Simulate, Board & Constraints, and Build &
  Export.
- Presentation uses the shared workbench tokens, shell, and existing instrument styles.
- Proof boundary: local Browser E0, actual downloaded artifacts, and Windows launch evidence.
  The candidate is not merged, deployed, Vivado-built, or hardware-proven.

## Student Flow

```text
Project
-> Design Schematic / HDL / Split; Explore is unrecorded
-> Simulate Scenario / Waveform / Replay / Optional Checks
-> Board & Constraints
-> Build & Export
```

Import / Recover is a separate Upload -> Review -> Apply utility with explicit
cancel. Vivado and board activity are outside the RedByte-owned stages.

## State Authority

| State | Owner | Current rule |
|---|---|---|
| Project identity and saved snapshot | Project runtime | One current project; replacement is explicit and cancel-safe. |
| Circuit structure | Design Edit | Structural/semantic edits stale behavioral proof. |
| Exploratory values | Design Live | Useful for learning; not saved Verify evidence. |
| Stimulus and checks | Named Simulate scenario | Stimulus always runs; expected-output checks are optional. |
| Observed trace and Replay | Current Simulate run | Read-only evidence; stale after relevant semantic change. |
| Signal-to-pin mapping | Board & Constraints | Table, selector, and interactive board write one semantic logical-signal/resource/package-pin/XDC projection. |
| Generated package | Build & Export | Browser structural validation, downloadability, and trust are distinct; download never creates Vivado proof. |
| Recovery candidate | Import | Active project changes only after explicit Apply. |

## Supported Sequential Boundary

Supported:

- Register1;
- several scalar registers sharing the same clock, including supported registers in native module definitions;
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
Set data and enable before the active edge. The current structural browser executor
settles combinational module outputs between stimulus events; simultaneous data
and clock changes are not an input setup guarantee.

Raw application typecheck remains a public-release blocker: 545 diagnostics in
167 files, exit 2 (25 removed, zero added from the preserved rc.1 baseline).
rc.1 stays archived unchanged. rc.2 final Browser E0 acceptance passes: 21 maintained
packaged journeys plus the complete original counter, canonical classroom 72/72,
repository 39/39, sequential 24/24 and mapping/package agreement. Windows CMD/default
Edge upgrade/restart passes on this installation; fresh-machine and literal Explorer
double-click remain open.

Candidate `1.0.0-rc.2`: application commit `5fbec3a8df1200765b7a14d7e2fc2602e2cb2657`,
2,278-input digest `bf5b636af3707f2b2e4b89d4666c5656b50aacd2a7a74bdc1b248ea35c7f5cde`.
ZIP SHA-256 `13d316e2670159ae7d4ef750985207c38f807f475e7e544363f5640b0c973c85`,
32,822,383 bytes. The final documentation commit records these results separately
from the application commit; build inputs remain unchanged.

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
