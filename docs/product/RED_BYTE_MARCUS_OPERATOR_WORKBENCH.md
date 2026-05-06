---
doc_status: current
last_validated: 2026-05-06
owner: Connor Angiel
used_by_claude: true
role: Marcus operator workbench contract
---

# RedByte Marcus Operator Workbench

## Purpose

Marcus Operator Workbench turns HQ from chat plus history into a local engineering control surface.

It helps Connor and coding agents:

- inspect saved Marcus packets deeply
- promote useful packets into local operator tasks
- see what sources, warnings, generated files, and evidence levels support a task
- track task/session activity without treating generated files as canonical truth
- see bench evidence status trends without overstating E3

This is not a student workflow surface. The product spine remains:

`Project -> Design -> Verify -> Map Pins / Hardware -> Export -> Vivado / board evidence`

## Packet Detail And Source Preview

HQ Workbench History still lists saved packets from `.redbyte/agent/runs/hq/packets/`, but selecting a packet now opens a detail panel with:

- prompt
- reply
- summary
- evidence level
- source confidence
- source preview list with authority/freshness labels
- tools used
- warnings
- generated file paths
- approval-required badge
- related session events when available

The source preview is for review and execution planning. Repo current truth still wins over Obsidian memory and generated packet content.

## Operator Task Queue

Marcus can promote a saved packet into a local operator task. Tasks are stored under:

`.redbyte/agent/runs/hq/tasks/`

Task fields include:

- `id`
- `createdAt`
- `updatedAt`
- `title`
- `status`
- `sourcePacketId`
- `summary`
- `recommendedAction`
- `productArea`
- `evidenceLevel`
- `sourceConfidence`
- `blockers`
- `doNotTouch`
- `tests`
- `codexPrompt`
- `generatedFiles`
- `sources`

Valid task statuses are:

- `candidate`
- `ready`
- `blocked`
- `in_progress`
- `done`
- `archived`

The task queue is local operator planning. It is not canonical repo truth, does not update docs, and does not write to Obsidian.

## Bench Evidence Timeline

HQ now reads bench evidence classification outputs, when present, and exposes a compact timeline/status view:

- latest run folder
- target count
- E0/E1/E2/E3 counts
- warning classes
- manual E3 observation needed count
- latest target rows
- run list

If `.redbyte/bench/runs/` is missing, the endpoint returns a safe empty state and keeps proof closure marked manual-observation gated.

Marcus must preserve this boundary:

- E2 board programming is not E3 observed behavior.
- Manual observed behavior is required before proof closure can be claimed.
- Bench timeline display must not say "E3 proven" unless current evidence supports it.

## Server Endpoints

- `GET /tasks`
- `GET /tasks/:id`
- `POST /tasks/from-packet`
- `POST /tasks/:id/status`
- `GET /bench-timeline`

Existing packet endpoints remain:

- `GET /packets`
- `GET /packets/:id`

## Safety Model

Marcus Operator Workbench does not:

- edit repo files
- apply patches
- commit or push
- write to Obsidian
- run arbitrary shell commands
- make generated task files canonical truth

All output paths stay under ignored generated directories. Path traversal is blocked for packet and task IDs.

## Patch Proposal Status

Controlled patch proposal generation is not implemented in Sprint 1.

That is intentional. Marcus may generate Codex-ready prompts and task packets, but Codex or a human operator still performs implementation through the normal repo/test/commit workflow.

## Operating Flow

1. Start Marcus with `pnpm rb:marcus:start`.
2. Open HQ mode.
3. Ask Marcus or generate a coding plan.
4. Select the saved packet in Workbench History.
5. Review sources, warnings, evidence level, and generated files.
6. Promote the packet to Operator Queue only if it is useful.
7. Update task status locally as Connor/Codex works.
8. Run the relevant tests and gates outside Marcus.
9. Update canonical docs/AI_STATE through normal repo changes when the actual product slice lands.

## Validation

Primary checks:

- `pnpm rb:hq:test`
- `pnpm rb:marcus:test`
- `pnpm rb:doc:validate`
- `pnpm rb:encoding:check`
- `pnpm --filter @redbyte/playground build`

