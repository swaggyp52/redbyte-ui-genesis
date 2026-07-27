---
doc_status: current
last_validated: 2026-07-27
owner: Connor Angiel
used_by_claude: true
role: ordered deferred queue after Stable Preview - Browser-E0 closeout
---

# RedByte Work Queue

The current stage ends with **Stable Preview - Browser-E0** on `main`.
Historical RC/product branches are recovery evidence, not implementation
queues. Do not start these items during closeout.

| Order | Deferred item | Start condition | Required boundary |
|---|---|---|---|
| 1 | Vivado E1 proof | Stable-preview export and a supported Vivado machine are named. | Record synthesis, implementation, and bitstream results for the exact package; do not imply E2/E3. |
| 2 | Basys3 E2/E3 proof | E1 package proof exists and a board/procedure are available. | Keep programming evidence separate from observed behavior. |
| 3 | Supervised classroom pilot | Deployment identity is current and instructor/TA procedures are agreed. | Measure setup, recovery, and support; do not call a pilot university reliability. |
| 4 | RegisterBus / StateBank parity | A new bounded program is explicitly authorized. | Runtime, Verify, Replay, VHDL, testbench, mapping, and Export must agree before unblocking. |
| 5 | Larger-design and mapping depth | Stable-preview use produces concrete evidence. | Prioritize bus-aware mapping, dense-project ergonomics, and recovery without weakening proof tiers. |

## Queue Rules

- Main is the only normal source.
- One logical change per commit.
- No force push or history rewriting.
- Do not update goldens or screenshots to hide a behavior defect.
- Browser screenshots prove layout; focused tests prove behavior; Vivado and
  hardware runs prove downstream tiers.
- Expected outputs remain optional for simulation and required only for trusted
  validation.
- Accounts, LMS, grading, cloud services, and broader v2C work remain deferred.
