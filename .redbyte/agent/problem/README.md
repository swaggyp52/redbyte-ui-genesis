# RedByte Product Problem Intake Config

This directory holds source-controlled defaults for the `rb:problem:*` feedback loop.

- `config.example.json` is tracked and safe.
- `config.json` is private and ignored.
- Generated problem packets are written under `.redbyte/agent/runs/problems/`, not here.
- `allowObsidianWrites` must stay `false` for v0 unless Connor explicitly authorizes a future write mode.
