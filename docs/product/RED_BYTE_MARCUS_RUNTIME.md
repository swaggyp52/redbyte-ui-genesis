---
doc_status: current
last_validated: 2026-05-08
owner: Connor Angiel
used_by_claude: true
role: Marcus runtime launcher and recovery contract
---

# RedByte Marcus Runtime Launcher (v0)

## Purpose

Provide one reliable command to make Marcus usable and diagnosable:

- `pnpm rb:marcus:start`

The runtime launcher handles local startup, health reporting, safe shutdown, and the standalone Marcus companion URL while preserving strict safety boundaries.

## Commands

- `pnpm rb:marcus:start`
  - Starts or reuses Marcus HQ runtime at `http://127.0.0.1:4255/`.
  - Serves the standalone Marcus companion shell at that URL.
  - Avoids duplicate HQ processes when backend is already healthy.
  - Fails clearly if port `4255` is occupied by a non-HQ process.
  - Attempts one Ollama auto-start if API is down and CLI is available.
  - Writes startup state and report files under `.redbyte/agent/runs/hq/runtime/`.
- `pnpm rb:marcus:status`
  - Reads runtime state and live checks for HQ/Ollama/model availability.
  - Prints warnings for degraded modes and next actions.
- `pnpm rb:marcus:doctor`
  - Runs runtime health checks and writes `marcus-health-latest.md`.
  - Exits `0` only when HQ is reachable/usable.
- `pnpm rb:marcus:stop`
  - Stops only launcher-tracked HQ process.
  - Refuses to kill unknown/non-HQ process identities.
  - Does not stop Ollama.

## Runtime Files

All runtime outputs are confined to:

- `.redbyte/agent/runs/hq/runtime/marcus-runtime.json`
- `.redbyte/agent/runs/hq/runtime/hq-server.pid`
- `.redbyte/agent/runs/hq/runtime/marcus-startup-latest.md`
- `.redbyte/agent/runs/hq/runtime/marcus-health-latest.md`
- `.redbyte/agent/runs/hq/runtime/hq-server.log`

These paths are local run artifacts and remain gitignored.

## Health Recovery Model

`rb:marcus:start` and `rb:marcus:doctor` evaluate:

- repo + latest commit context
- Ollama CLI presence and API reachability
- configured model availability
- HQ `/health` and `/snapshot`
- memory index availability
- bench evidence classifier status
- control-next status
- runtime output directory writability
- local Marcus/HQ URL for follow-up

Degraded states are explicit and actionable instead of silent.

## Safety Boundaries

- No arbitrary shell endpoint is introduced.
- No Obsidian writes are enabled.
- No Marcus direct file edits are enabled through runtime commands.
- `stop` requires process identity match (`rb-hq-server.mjs serve`) before kill.

## Operator Workflow

1. Run `pnpm rb:marcus:start`.
2. Check `pnpm rb:marcus:status`.
3. If needed, run `pnpm rb:marcus:doctor` and inspect `marcus-health-latest.md`.
4. Use `pnpm rb:marcus:stop` when done.

## UX Surface Hook

Marcus is no longer opened through the RedByte IDE. `pnpm rb:marcus:start` prints the standalone companion URL. `pnpm rb:hq:server` remains a backend-only fallback for direct server use.
