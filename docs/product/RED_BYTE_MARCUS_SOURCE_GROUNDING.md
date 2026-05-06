---
doc_status: current
last_validated: 2026-05-06
owner: Connor Angiel
used_by_claude: true
role: Marcus source grounding contract
---

# RedByte Marcus Source Grounding (v1)

## Purpose

Marcus replies must be visibly grounded in RedByte sources.

This is not a dashboard feature.
This is not direct file editing.
This is a trust and provenance contract for HQ responses.

## Core boundaries

Marcus grounding must preserve these RedByte distinctions:

- Repo current truth beats Obsidian memory.
- Obsidian memory is supporting context, not canonical truth.
- Generated run outputs are evidence candidates, not product truth.
- E2 board programming is not E3 observed behavior.
- Map Pins is not Verify proof.
- Draft Export is not Trusted Export.

## Response envelope

Marcus reply envelopes should include:

- `reply`
- `mode`
- `toolsUsed`
- `sources`
- `evidenceLevel`
- `sourceConfidence`
- `degraded`
- `warnings`
- `generatedFiles`
- `recommendedNextAction`
- `requiresApproval`

## Source object shape

Each source record uses:

- `id`
- `kind`
- `title`
- `path`
- `excerpt`
- `freshness`
- `authority`

Allowed `kind` values:

- `repo_doc`
- `obsidian_memory`
- `generated_run`
- `bench_evidence`
- `git_state`
- `tool_output`
- `fallback`

Allowed `freshness` values:

- `current`
- `stale_possible`
- `generated`
- `unknown`

Allowed `authority` values:

- `canonical`
- `supporting`
- `memory`
- `generated`
- `fallback`

## Grounding rules

- If Marcus uses repo docs, include the repo doc path.
- If Marcus uses bench evidence, include the run/report path and E-level.
- If Marcus uses Obsidian memory, label it as `memory` / supporting, never canonical.
- If Marcus is degraded or offline, include a `fallback` source.
- If no usable sources are available, Marcus must say that explicitly and lower confidence.
- `sourceConfidence` must be explicit: `high | medium | low | degraded`.

## Tool contract

Each Marcus tool result should expose:

- `summary`
- `data`
- `sources`
- `warnings`
- `evidenceLevel` when relevant
- `generatedFiles` when relevant
- `authority`
- `sourceConfidence`

The command safety model does not change.
No arbitrary command execution is added.

## Aggregation contract

The Marcus agent loop must:

- aggregate structured sources from all tool calls
- preserve generated file paths separately from sources
- preserve warnings even when Ollama synthesis succeeds
- supply baseline snapshot/control sources when no tool calls occur
- mark the reply degraded when fallback execution is used

## UI contract

HQ should render grounding minimally under the latest Marcus reply:

- tools used
- source confidence
- evidence level
- compact source list
- warnings
- generated files

HQ must not imply that generated runs or memory outputs override canonical repo truth.
