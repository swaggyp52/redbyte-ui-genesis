---
doc_status: current
last_validated: 2026-08-09
owner: Connor Angiel
used_by_claude: true
role: ordered deferred queue after Stable Preview - Browser-E0 closeout
---

# RedByte Work Queue

The release lane remains **Stable Preview - Browser-E0** on `main`. Product
System v3 is an explicit candidate on `product/redbyte-workbench-v3` and draft
PR #80. Its integrated Studio reconstruction must receive user visual review
before a feature milestone or merge begins.

| Order | Deferred item | Start condition | Required boundary |
|---|---|---|---|
| 1 | Product System v3 user visual review | The 14 final Studio captures and both normal-use flows are available. | Record concrete visual/interaction defects; do not substitute test counts or remote status for review. |
| 2 | Vivado E1 proof | The reviewed candidate package and a supported Vivado machine are named. | Record synthesis, implementation, and bitstream results for the exact package; do not imply E2/E3. |
| 3 | Basys3 E2/E3 proof | E1 package proof exists and a board/procedure are available. | Keep programming evidence separate from observed behavior. |
| 4 | Supervised classroom pilot | Deployment identity is current and instructor/TA procedures are agreed. | Measure setup, recovery, and support; do not call a pilot university reliability. |
| 5 | RegisterBus / StateBank parity | A new bounded program is explicitly authorized. | Runtime, Simulate, Replay, VHDL, testbench, mapping, and Build & Export must agree before unblocking. |

## Queue Rules

- `main` is the release source; the named Product System v3 branch is the only
  current candidate source until review resolves PR #80.
- One logical change per commit.
- No force push or history rewriting.
- Do not update goldens or screenshots to hide a behavior defect.
- Browser screenshots prove layout; focused tests prove behavior; Vivado and
  hardware runs prove downstream tiers.
- Expected outputs remain optional for simulation and required only for trusted
  validation.
- Accounts, LMS, grading, cloud services, and broader v2C work remain deferred.
