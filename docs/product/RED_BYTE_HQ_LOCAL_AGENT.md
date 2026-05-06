---
doc_status: current
last_validated: 2026-05-06
owner: Connor Angiel
used_by_claude: true
role: RedByte HQ local command center contract
---

# RedByte HQ Local Agent (v1)

## What HQ is

RedByte HQ is a local utility surface in the IDE that exposes command-center status for:

- Marcus chat (local Ollama-backed when available)
- control-loop snapshot status
- bench evidence summary (E0/E1/E2/E3)
- memory index status
- claim/problem helper actions

HQ is utility context for engineering and validation. It is not a required student workflow step.

## What HQ is not

- Not part of the mandatory student spine.
- Not a replacement for Project, Design, Verify, Map Pins, or Export.
- Not a generic shell runner.
- Not an Obsidian writer in v0.

Canonical spine remains:

`Project -> Design -> Verify -> Map Pins / Hardware -> Export`

## Marcus identity

The local assistant identity is `Marcus`. Tone and behavior are direct, technical, and evidence-bounded.

Marcus must preserve trust boundaries:

- E2 programming is not E3 observed behavior.
- Map Pins assignment is not Verify proof.
- Draft Export is not Trusted Export.

## Local-first and offline behavior

HQ server is local (`127.0.0.1`). If Ollama is unavailable:

- `/health` reports `ollama_online: false`.
- `/chat` returns a degraded/offline reply with guidance, without crashing.

This degraded mode is acceptable for v0.

## Server endpoints (v1)

- `GET /health`
- `GET /snapshot`
- `GET /control-next`
- `GET /bench-evidence`
- `POST /chat`
- `POST /coding-plan`
- `POST /problem-intake`
- `POST /memory-search`
- `POST /trace-claim`

`POST /chat` now supports mode-driven tool-assisted replies with structured metadata:

- `mode`: `ask | explain-state | problem-packet | trace-claim | coding-plan`
- `allowTools` (default `true`)
- `maxToolCalls` (default `4`)

Response envelope includes:

- `reply`
- `toolsUsed`
- `sources`
- `evidenceLevel`
- `sourceConfidence`
- `warnings`
- `generatedFiles`
- `recommendedNextAction`
- `requiresApproval`
- `degraded`

`POST /coding-plan` generates a safe work packet under `.redbyte/agent/runs/hq/` and does not edit product files.

## Safety model (v1)

- No unrestricted command execution endpoint.
- Backend command execution is allowlist-only.
- Request body size is capped.
- Obsidian writes are disabled by default (`REDBYTE_HQ_ALLOW_OBSIDIAN_WRITES=false`).
- Marcus cannot commit/push and cannot directly edit product files.

## Evidence display contract

HQ may display E0/E1/E2/E3 counts and target summaries from bench artifacts, but must not claim E3 unless board observation evidence exists.

HQ now also renders a compact source-grounding section for the latest Marcus reply:

- source confidence
- evidence level
- structured source list
- warnings
- generated file paths

Memory-derived sources must stay visually subordinate to canonical repo-doc sources.

## How to start

1. Start Marcus runtime (preferred):
   - `pnpm rb:marcus:start`
2. Optional runtime checks:
   - `pnpm rb:marcus:status`
   - `pnpm rb:marcus:doctor`
3. Start RedByte app and open HQ mode in IDE.

If you only need backend serve without runtime lifecycle tooling:

- `pnpm rb:hq:server`

## Known limitations

- Depends on local tooling (`pnpm`, repo scripts, optional Ollama runtime).
- `rb:hq:doctor` may report degraded status if control-loop inputs are incomplete.
- v0 contains no browser-triggered arbitrary command feature by design.
- Bench evidence can still be unavailable when `.redbyte/bench/runs/` is absent; in that case Marcus must ground replies in repo truth/control outputs or fallback sources instead of implying bench proof exists.
