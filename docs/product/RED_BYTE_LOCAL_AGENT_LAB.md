---
doc_status: current
last_validated: 2026-05-05
owner: Connor Angiel
used_by_claude: true
role: specification and operating guide for the RedByte Local Agent Lab infrastructure
---

# RedByte Local Agent Lab

This document describes the **RedByte Local Agent Lab** — a deterministic, Ollama-backed local assistant harness that reads control docs, work-driver packets, git state, and session context, then produces grounded prompts, reviews, and handoff reports.

The agent lab is **not** an autonomous code editor. It is a read-only analysis and prompt-generation harness that earns trust across phases.

---

## Architecture

```
.redbyte/
  agent/
    config.example.json     — Configuration template (copy to config.json, gitignored)
    prompts/
      system.md             — Core system prompt for the local agent
      reviewer.md           — Diff review prompt and checklist
      planner.md            — Implementation plan generation prompt
      doc-sync.md           — Doc/Obsidian sync gap checker prompt
      implementation.md     — Next-task prompt generation template
    continue/
      config.example.yaml   — Continue.dev config template for VS Code
    runs/                   — All run outputs (gitignored, contents excluded)
      context-latest.md
      next-prompt.md
      review-latest.md
      doc-sync-latest.md
      handoff-latest.md
  work/                     — Work driver outputs (separate from agent runs)
    NEXT_WORK_PACKET.md
    HANDOFF_DRAFT.md

scripts/
  rb-local-agent.mjs        — Main CLI entry point
```

---

## Commands

All commands are available via pnpm scripts:

| Script | Command | What it does |
|--------|---------|--------------|
| `pnpm rb:agent:doctor` | `doctor` | Check Ollama availability, model, repo readiness |
| `pnpm rb:agent:context` | `context` | Build context bundle from control docs and git state |
| `pnpm rb:agent:next` | `next` | Generate next-task prompt via Ollama |
| `pnpm rb:agent:review` | `review` | Review current diff against RedByte rules |
| `pnpm rb:agent:doc-sync` | `doc-sync` | Identify doc/Obsidian update gaps |
| `pnpm rb:agent:handoff` | `handoff` | Generate session handoff draft |

---

## Configuration

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `REDBYTE_AGENT_MODEL` | `qwen2.5-coder:7b` | Ollama model for chat/review/planning |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API base URL |

### Model tiers

| Purpose | Model |
|---------|-------|
| Chat, review, planning | `qwen2.5-coder:7b` |
| Autocomplete | `qwen2.5-coder:1.5b-base` |
| Embeddings / RAG | `nomic-embed-text` |

### Continue.dev integration

Copy `.redbyte/agent/continue/config.example.yaml` to your Continue user config directory and adjust as needed. The example config declares:
- A chat model (qwen2.5-coder:7b)
- An autocomplete model (qwen2.5-coder:1.5b-base)
- An embeddings model (nomic-embed-text)
- Context providers: file, code, diff, terminal, repo-map, folder, search
- RedByte-specific rules injected into every session

---

## Safety contract

The local agent **never**:
- Edits product files (`packages/`, `apps/`, `services/`, `docs/`, `src/`)
- Stages or commits anything
- Pushes to any remote
- Writes outside `.redbyte/agent/runs/`
- Makes claims about completion without evidence (git diff, tests, commit hash)

The local agent **always**:
- Fails clearly if Ollama is not reachable (exit code 1, actionable error message)
- Reads control docs before generating output
- Labels its outputs with the model name and generation timestamp

---

## Phase model

The agent lab earns trust across phases. Each phase must be stable before the next.

| Phase | Capability | Status |
|-------|-----------|--------|
| 0 | Connectivity check (`doctor`) | ✅ Implemented |
| 1 | Read-only context and prompt generation | ✅ Implemented |
| 2 | Diff review and doc-sync gap detection | ✅ Implemented |
| 3 | Patch proposal (outputs `.patch` file, never applies) | Future |
| 4 | Controlled file edit (one file, user-confirmed) | Future |
| 5 | Controlled commit (user-confirmed, never pushes) | Future |
| 6 | Full slice automation with human review checkpoint | Future |

Phases 3–6 must be explicitly scoped and approved before implementation.

---

## Control doc integration

The agent reads these docs on every run (where applicable):

| Doc | Purpose |
|-----|---------|
| `AI_STATE.md` | Change log, current git state, session context |
| `docs/ACTIVE_WORK.md` | Live priorities, in-flight items, evidence table |
| `docs/product/RED_BYTE_CURRENT_TRUTH.md` | Canonical state snapshot |
| `docs/product/RED_BYTE_AGENT_OPERATING_RULES.md` | Operating constraints |
| `docs/product/RED_BYTE_WORK_QUEUE.md` | Prioritized work items |
| `.redbyte/work/NEXT_WORK_PACKET.md` | Work driver output (context input) |

---

## Obsidian vault integration

The agent's `doc-sync` command generates a checklist of required Obsidian vault updates after each implementation slice. It does not write to the vault directly (Phase 1 is read-only). Vault write capability is a Phase 4+ concern.

Relevant vault nodes:
- `01 Dashboard/RedByte Engineering Brain.md` — master entry point
- `05 Bugs/BUG-00N.md` — per-bug notes (close after fix is committed)
- Session logs — add handoff summary after each slice

---

## Maintenance

- After adding a new command, update this doc and `DOC_INDEX.md`
- After changing the prompt templates, update `last_validated` in this doc's frontmatter
- Run `pnpm rb:agent:doctor` after any Ollama model change to confirm smoke test passes
