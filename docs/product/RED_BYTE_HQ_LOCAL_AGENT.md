---
doc_status: current
last_validated: 2026-05-08
owner: Connor Angiel
used_by_claude: true
role: standalone Marcus HQ local command center contract
---

# RedByte HQ Local Agent (v1)

## What HQ is

RedByte HQ is Marcus's standalone local companion command center. It is served by the Marcus runtime at `http://127.0.0.1:4255/` and exposes status for:

- Marcus chat (local Ollama-backed when available)
- control-loop snapshot status
- bench evidence summary (E0/E1/E2/E3)
- bench evidence timeline/status trends
- memory index status
- claim/problem helper actions
- workbench packet detail
- local operator task queue
- read-only code intelligence and patch proposals

HQ is utility context for engineering and validation. It is not a RedByte IDE mode and is not a required student workflow step.

## What HQ is not

- Not part of the mandatory student spine.
- Not a Project/Design/Verify/Map Pins/Export peer in the RedByte IDE.
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

- `GET /` and `GET /marcus`
- `GET /health`
- `GET /snapshot`
- `GET /control-next`
- `GET /bench-evidence`
- `GET /bench-timeline`
- `GET /packets`
- `GET /packets/:id`
- `GET /tasks`
- `GET /tasks/:id`
- `POST /tasks/from-packet`
- `POST /tasks/:id/status`
- `GET /code/search`
- `GET /code/file`
- `GET /patch-proposals`
- `GET /patch-proposals/:id`
- `POST /patch-proposals`
- `POST /chat`
- `POST /coding-plan`
- `POST /problem-intake`
- `POST /memory-search`
- `POST /trace-claim`

`POST /chat` now supports mode-driven tool-assisted replies with structured metadata:

- `mode`: `ask | explain-state | problem-packet | trace-claim | coding-plan | patch-proposal`
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

`POST /tasks/from-packet` promotes a saved packet into a local operator task under `.redbyte/agent/runs/hq/tasks/`. These tasks are generated planning artifacts, not canonical repo truth.

`GET /code/search` and `GET /code/file` expose bounded read-only code previews for allowlisted repo paths. They deny private configs, generated runtime files, traversal, binary files, and oversized files.

`POST /patch-proposals` drafts a proposal-only artifact under `.redbyte/agent/runs/hq/patch-proposals/` and may save a local packet. It does not apply patches, edit files, stage, commit, or push.

## Safety model (v1)

- No unrestricted command execution endpoint.
- Backend command execution is allowlist-only.
- Request body size is capped.
- Obsidian writes are disabled by default (`REDBYTE_HQ_ALLOW_OBSIDIAN_WRITES=false`).
- Marcus cannot commit/push and cannot directly edit product files.
- Operator tasks cannot apply patches and cannot write to Obsidian.
- Code intelligence is read-only and patch proposals are `proposal_only` with `requiresApproval: true`.

## Evidence display contract

HQ may display E0/E1/E2/E3 counts and target summaries from bench artifacts, but must not claim E3 unless board observation evidence exists.

HQ now also renders a compact source-grounding section for the latest Marcus reply:

- source confidence
- evidence level
- structured source list
- warnings
- generated file paths

Memory-derived sources must stay visually subordinate to canonical repo-doc sources.

## Operator workbench contract

HQ now includes an operator workbench layer:

- Packet detail panel for prompt, reply, sources, evidence, warnings, generated files, and approval-required state.
- Operator Queue for promoting packets into local task records with status, blockers, tests, Codex prompt, and source metadata.
- Bench timeline panel for latest run, E0/E1/E2/E3 counts, warning classes, manual E3 needs, and run history.
- Patch Proposals panel for proposal-only target files, risks, tests, do-not-touch boundaries, and Codex prompts.

See `docs/product/RED_BYTE_MARCUS_OPERATOR_WORKBENCH.md` for the detailed contract.
See `docs/product/RED_BYTE_MARCUS_CODE_INTELLIGENCE.md` for the read-only code and patch-proposal safety contract.

## How to start

1. Start Marcus runtime (preferred):
   - `pnpm rb:marcus:start`
2. Optional runtime checks:
   - `pnpm rb:marcus:status`
   - `pnpm rb:marcus:doctor`
3. Open the standalone Marcus URL printed by the command, normally `http://127.0.0.1:4255/`.

If you only need backend serve without runtime lifecycle tooling:

- `pnpm rb:hq:server`

## Known limitations

- Depends on local tooling (`pnpm`, repo scripts, optional Ollama runtime).
- `rb:hq:doctor` may report degraded status if control-loop inputs are incomplete.
- v0 contains no browser-triggered arbitrary command feature by design.
- Bench evidence can still be unavailable when `.redbyte/bench/runs/` is absent; in that case Marcus must ground replies in repo truth/control outputs or fallback sources instead of implying bench proof exists.
- Operator task files and packet files are generated local history; they do not replace repo docs, AI_STATE, or release evidence.
