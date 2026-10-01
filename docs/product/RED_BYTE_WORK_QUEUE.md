---
doc_status: current
last_validated: 2026-10-01
owner: Connor Angiel
used_by_claude: true
role: ordered deferred queue after local Browser E0 candidate completion
---

# RedByte Work Queue

The current local candidate is the existing P2.6C feature checkout,
`claude/redbyte-studio-completion-p2-6-q7m3v8`, with reviewed local completion
commits and separate preserved owner edits. PR #86 is stacked on PR #85. The PR #80 posture and its 14-capture review
queue are historical. `main` remains the production release branch; local
candidate completion does not authorize a merge or public deployment.

| Order | Deferred item | Start condition | Required boundary |
|---|---|---|---|
| 1 | Local candidate owner acceptance and integration decision | Use the current Windows ZIP, QUICKSTART circuit walkthrough and final P2.6C evidence. | Record extended-session and visual acceptance separately; inspect both stacked PRs before proposing integration into main. |
| 2 | Vivado E1 proof | The reviewed candidate package and a supported Vivado machine are named. | Record synthesis, implementation, and bitstream results for the exact package; do not imply E2/E3. |
| 3 | Basys3 E2/E3 proof | E1 package proof exists and a board/procedure are available. | Keep programming evidence separate from observed behavior. |
| 4 | Supervised classroom pilot | Deployment identity is current and instructor/TA procedures are agreed. | Measure setup, recovery, and support; do not call a pilot university reliability. |
| 5 | RegisterBus / StateBank parity | A new bounded program is explicitly authorized. | Runtime, Simulate, Replay, VHDL, testbench, mapping, and Build & Export must agree before unblocking. |

## Queue Rules

- `main` is the production release branch. The inspected local candidate is
  `claude/redbyte-studio-completion-p2-6-q7m3v8`; the exact candidate commit and
  content fingerprint live in its receipt. Current finish evidence belongs to the existing P2.6C ticket.
  The earlier PR #80 branch posture is historical. PR #86 is stacked on PR #85;
  merging it into its feature base alone does not release to main.
- One logical change per commit.
- No force push or history rewriting.
- Do not update goldens or screenshots to hide a behavior defect.
- Browser screenshots prove layout; focused tests prove behavior; Vivado and
  hardware runs prove downstream tiers.
- Expected outputs remain optional for simulation and required only for trusted
  validation.
- Accounts, LMS, grading, cloud services, and broader v2C work remain deferred.
