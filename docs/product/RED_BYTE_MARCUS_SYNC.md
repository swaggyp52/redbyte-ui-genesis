---
doc_status: current
last_validated: 2026-05-10
owner: Connor Angiel
used_by_claude: true
role: repo-to-Marcus product-state sync contract
---

# RedByte Marcus Sync

Marcus Sync is the repo-side bridge from the main RedByte working tree to the Marcus Pi Node.

It sends a small product-state packet to Marcus without cloning this repo onto the Pi and without making Marcus autonomous.

## Commands

```bash
pnpm rb:marcus:packet
pnpm rb:marcus:sync
pnpm rb:marcus:test
```

- `rb:marcus:packet` prints the generated JSON packet.
- `rb:marcus:sync` posts the packet to `POST /repo-summary`.
- `rb:marcus:test` runs local script tests and does not require Marcus.

## Environment

- `MARCUS_BASE_URL` defaults to `http://192.168.1.103:4260`.
- `MARCUS_TOKEN` is required only for `rb:marcus:sync`.
- The token must not be committed, logged, or written into docs.

## Source Inputs

The packet generator reads these files when present:

- `AI_STATE.md`
- `docs/ACTIVE_WORK.md`
- `docs/product/RED_BYTE_CURRENT_TRUTH.md`
- `docs/product/RED_BYTE_WORK_QUEUE.md`
- `docs/product/RED_BYTE_AGENT_CONTROL_LOOP.md`
- `docs/release/vivado-basys3-certification-matrix.md`
- `docs/STUDENT_RELEASE_READINESS.md`

The output is bounded below 50 KB and contains:

- current product truth
- recent changes
- active blockers
- next recommended work
- evidence notes
- agent warnings

## Boundaries

Marcus Sync does not:

- call an LLM
- execute arbitrary shell commands on Marcus
- clone the repo onto the Pi
- pull Ollama models
- write to Obsidian
- print or store the Marcus token

Evidence language must stay strict: E2 board programming is not E3 observed behavior, and no logic bug is recorded unless evidence explicitly says so.

