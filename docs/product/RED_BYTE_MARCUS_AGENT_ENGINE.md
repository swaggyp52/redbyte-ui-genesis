---
doc_status: current
last_validated: 2026-05-06
owner: Connor Angiel
used_by_claude: true
role: Marcus Agent Engine v1 architecture and safety contract
---

# RedByte Marcus Agent Engine (v1)

## Purpose

Marcus v1 turns HQ from dashboard-only status into a local, tool-assisted RedByte engineering operator.

Marcus is for:

- evidence-bounded engineering reasoning
- product-state explanation with current snapshot context
- safe tool execution through server allowlist
- coding-plan and problem packet generation for human/Codex approval

Marcus is not for:

- arbitrary shell execution
- Obsidian vault writes
- direct product file edits
- autonomous commit/push actions

## Architecture

```text
HQ UI
  -> HQ server
  -> Marcus agent loop
  -> Ollama chat/tool calls (when available)
  -> RedByte tool registry (allowlisted)
  -> control/memory/problem/bench/git read-safe actions
```

Fallback mode is mandatory: if Ollama is unavailable or tool-calling fails, Marcus still returns snapshot-driven responses and safe next actions.

## Capability Levels

- L0: Display status
  - health, snapshot, bench evidence, memory status
- L1: Chat with context
  - Marcus answers using snapshot and trust boundaries
- L2: Tool-assisted reasoning
  - allowlisted tools (control-next, trace-claim, memory-search, problem-intake, bench-evidence, git-status)
- L3: Work packet generation
  - coding-plan packet + Codex prompt generation under `.redbyte/agent/runs/hq/`
  - packet detail review and local operator task promotion
- L4: Safe checks only
  - allowlisted checks (`rb:doc:validate`, `rb:encoding:check`)
- L5: Patch proposal only (future)
- L6: Controlled worktree editing (future)

v1 target is L1+L2+L3 with limited L4.

## Tool Registry Contract

Each tool entry defines:

- name and description
- JSON-schema parameters
- safety level and read/write classification
- timeout budget
- explicit allowed command IDs
- summarized structured output

Structured tool output must include:

- `summary`
- `data`
- `sources`
- `warnings`
- `evidenceLevel` when relevant
- `generatedFiles` when relevant
- `authority`
- `sourceConfidence`

Registry is deny-by-default. Unknown tool names are rejected.

## Safety Model

- Browser never executes shell commands directly.
- Server owns tool execution policy and command allowlist.
- Command execution is constrained to specific repo-local actions.
- No Obsidian writes in v1.
- No git commit/push in v1.
- No direct repo edits by Marcus in v1.

## Trust Boundary Rules

Marcus responses must preserve:

- E2 board programming != E3 observed board behavior
- Map Pins mapping != Verify proof
- Draft Export != Trusted Export
- generated agent outputs != canonical product truth
- memory outputs do not override current repo truth

## Endpoint Contract (v1)

- `POST /chat`
  - request: `message`, `mode`, `allowTools`, `maxToolCalls`, optional `history`
  - response includes: `reply`, `toolsUsed`, `sources`, `evidenceLevel`, `sourceConfidence`, `warnings`, `generatedFiles`, `recommendedNextAction`, `requiresApproval`, `degraded`

- `POST /coding-plan`
  - request: `raw_user_request`, optional `target_surface`, `urgency`, `constraints`
  - output packet:
    - `.redbyte/agent/runs/hq/marcus-coding-plan-latest.md`
    - `.redbyte/agent/runs/hq/marcus-coding-plan-latest.json`

- `GET /packets` and `GET /packets/:id`
  - read saved Marcus packets from local generated history
  - packet detail includes prompt, reply, sources, evidence level, warnings, generated files, and approval state

- `GET /tasks`, `GET /tasks/:id`, `POST /tasks/from-packet`, `POST /tasks/:id/status`
  - maintain local operator tasks under `.redbyte/agent/runs/hq/tasks/`
  - tasks are planning artifacts, not canonical product truth

- `GET /bench-timeline`
  - summarizes local bench classification runs when present
  - returns a safe empty/manual-gated state when local bench runs are absent

## Coding Workflow Contract

Marcus coding flow is staged and approval-gated:

1. analyze
2. plan
3. gather evidence
4. generate packet
5. inspect packet detail and source evidence
6. optionally promote packet into Operator Queue
7. human approval
8. Codex executes implementation

Marcus v1 does not apply patches directly.

## Source grounding

Marcus replies are source-grounded in v1:

- repo docs are marked canonical and include paths
- Obsidian memory is labeled supporting / memory, never canonical
- generated control/problem/packet outputs are labeled generated
- fallback mode emits explicit fallback sources and degraded confidence

See `docs/product/RED_BYTE_MARCUS_SOURCE_GROUNDING.md` for the detailed contract.
