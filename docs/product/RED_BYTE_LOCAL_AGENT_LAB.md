---
doc_status: current
last_validated: 2026-05-05
owner: Connor Angiel
used_by_claude: true
role: specification and operating guide for the RedByte Local Agent Lab infrastructure
---

# RedByte Local Agent Lab

This document describes the **RedByte Local Agent Lab** - a deterministic, Ollama-backed local assistant harness that reads control docs, work-driver packets, git state, and session context, then produces grounded prompts, reviews, and handoff reports.

The agent lab is **not** an autonomous code editor. It is a read-only analysis and prompt-generation harness that earns trust across phases.

---

## Architecture

```
.redbyte/
  agent/
    config.example.json     - Configuration template (copy to config.json, gitignored)
    prompts/
      system.md             - Core system prompt for the local agent
      reviewer.md           - Diff review prompt and checklist
      planner.md            - Implementation plan generation prompt
      doc-sync.md           - Doc/Obsidian sync gap checker prompt
      implementation.md     - Next-task prompt generation template
    continue/
      config.example.yaml   - Continue.dev config template for VS Code
    memory/
      config.example.json    - Obsidian + Ollama memory bridge config template
      README.md              - Local memory directory rules
    runs/                   - All run outputs (gitignored, contents excluded)
      context-latest.md
      next-prompt.md
      review-latest.md
      doc-sync-latest.md
      handoff-latest.md
  work/                     - Work driver outputs (separate from agent runs)
    NEXT_WORK_PACKET.md
    HANDOFF_DRAFT.md

scripts/
  rb-local-agent.mjs        - Main CLI entry point
```

---

## Commands

All commands are available via pnpm scripts:

| Script | Command | What it does |
|--------|---------|--------------|
| `pnpm rb:agent:ollama:doctor` | `ollama-doctor` | Deterministic Ollama/runtime/model health check |
| `pnpm rb:agent:doctor` | `doctor` | Compatibility alias for legacy command runners |
| `pnpm rb:agent:context` | `context` | Build context bundle from control docs and git state |
| `pnpm rb:agent:next` | `next` | Generate next-task prompt via Ollama |
| `pnpm rb:agent:review` | `review` | Review current diff against RedByte rules |
| `pnpm rb:agent:doc-sync` | `doc-sync` | Identify doc/Obsidian update gaps |
| `pnpm rb:agent:handoff` | `handoff` | Generate session handoff draft |

Memory bridge commands live beside the local-agent harness:

| Script | What it does |
|--------|--------------|
| `pnpm rb:memory:doctor` | Checks memory config, vault path, repo docs, Ollama, models, gitignored outputs, and no-write mode |
| `pnpm rb:memory:index` | Builds a local repo + Obsidian memory index under `.redbyte/agent/memory/index/` |
| `pnpm rb:memory:search -- "query"` | Searches memory by embedding when available, otherwise keyword fallback |
| `pnpm rb:memory:synth -- "question"` | Produces source-aware product synthesis |
| `pnpm rb:memory:sync-plan` | Produces a no-write Obsidian/repo sync plan |
| `pnpm rb:memory:trace -- "claim"` | Produces claim-to-docs/code/tests/gates traceability |
| `pnpm rb:memory:next-product-context` | Produces a context pack for the next product slice |
| `pnpm rb:memory:handoff` | Produces a memory-backed handoff |

Control-loop commands live beside the memory bridge:

| Script | What it does |
|--------|--------------|
| `pnpm rb:control:next` | Reconciles work-driver output, memory context, git history, and product truth into one next-slice packet |
| `pnpm rb:control:trace-claims` | Checks the canonical product claims against configured docs, likely code files, and expected tests/gates |
| `pnpm rb:control:test` | Runs focused control-loop script tests |

---

## Configuration

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `REDBYTE_AGENT_MODEL` | `(auto)` | Optional model override. When unset, RedByte selects an installed small model (`qwen2.5-coder:1.5b` first). |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API base URL |
| `REDBYTE_AGENT_FORMAT` | `markdown` | Output format (`markdown` or `json`) for `next`, `review`, and `doc-sync` |
| `REDBYTE_AGENT_TEMPERATURE` | `0.2` | Sampling temperature sent to Ollama |
| `REDBYTE_AGENT_TIMEOUT_MS` | `90000` | Ollama request timeout in milliseconds |
| `REDBYTE_AGENT_CTX_LIMIT` | `10000` | Max context characters sent to Ollama prompts |

### Model tiers

| Purpose | Model |
|---------|-------|
| Chat, review, planning | `qwen2.5-coder:1.5b` (preferred) |
| Smoke-test fallback | `qwen2.5-coder:1.5b-base` |
| Fallback smoke model | `qwen2.5-coder:0.5b` |
| Embeddings / RAG | `nomic-embed-text` |

### Continue.dev integration

Copy `.redbyte/agent/continue/config.example.yaml` to your Continue user config directory and adjust as needed. The example config declares:
- A chat model (qwen2.5-coder:1.5b-base)
- A chat model (qwen2.5-coder:1.5b)
- An autocomplete model (qwen2.5-coder:1.5b)
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
- Checks Ollama CLI and API separately (API can still be reachable when CLI version command fails)

---

## Terminal-first execution contract

The local agent lab is validated through terminal evidence, not assumptions.

- Use terminal checks before claiming completion: `git status --short`, `git diff --name-only`, command output, and commit hash.
- For Ollama work, run real commands: `pnpm rb:agent:ollama:doctor` (first), `pnpm rb:agent:context`, `pnpm rb:agent:next`, `pnpm rb:agent:review`, `pnpm rb:agent:doc-sync`, `pnpm rb:agent:handoff`.
- If doctor fails, do not run `pnpm rb:agent:next`; fix model/runtime first or use `context-latest.md` manually.
- If command execution fails, report the exact command and the exact terminal failure text.

---

## Windows Ollama quickstart

1. Verify CLI exists:

```powershell
Get-Command ollama -ErrorAction SilentlyContinue
ollama --version
```

2. Verify API status:

```powershell
Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method Get
```

3. If API is down, start Ollama:

```powershell
Start-Process ollama
```

4. Choose model and run lab smoke checks:

```powershell
$env:REDBYTE_AGENT_MODEL="qwen2.5-coder:1.5b"
pnpm rb:agent:ollama:doctor
pnpm rb:agent:context
pnpm rb:agent:next
```

Observed on this workstation (2026-05-05):
- Ollama CLI is installed and API is reachable.
- Installed models include `qwen2.5-coder:1.5b` and `qwen2.5-coder:1.5b-base`.
- `rb:agent:ollama:doctor` markdown and JSON smokes pass with `qwen2.5-coder:1.5b`.
- `qwen2.5-coder:1.5b-base` remains available as fallback, but may be weaker for instruction-following.

If the model is not installed, pull it first:

```powershell
ollama pull qwen2.5-coder:1.5b
# Fallback:
ollama pull qwen2.5-coder:0.5b
```

See `docs/product/RED_BYTE_OLLAMA_LOCAL_SETUP.md` for full setup, failure modes, and model guidance.

JSON mode note:
- `REDBYTE_AGENT_FORMAT=json` now uses Ollama API `format: "json"` and enforces valid JSON output in `next`, `review`, and `doc-sync`.
- If the model returns non-JSON or misses required command keys, the command fails and writes raw output to a debug file in `.redbyte/agent/runs/`.
- If the model process fails before responding, JSON mode reports the underlying Ollama API error.

---

## Phase model

The agent lab earns trust across phases. Each phase must be stable before the next.

| Phase | Capability | Status |
|-------|-----------|--------|
| 0 | Connectivity check (`doctor`) | [ok] Implemented |
| 1 | Read-only context and prompt generation | [ok] Implemented |
| 2 | Diff review and doc-sync gap detection | [ok] Implemented |
| 3 | Patch proposal (outputs `.patch` file, never applies) | Future |
| 4 | Controlled file edit (one file, user-confirmed) | Future |
| 5 | Controlled commit (user-confirmed, never pushes) | Future |
| 6 | Full slice automation with human review checkpoint | Future |

Phases 3-6 must be explicitly scoped and approved before implementation.

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

The memory bridge extends this with read-only indexing and traceability. It can read configured vault Markdown notes and write generated reports to `.redbyte/agent/runs/`, but it still never writes to the vault in v0. See `docs/product/RED_BYTE_OBSIDIAN_MEMORY_BRIDGE.md` and `docs/product/RED_BYTE_PRODUCT_TRACEABILITY_MODEL.md`.

The control loop is the pre-product-work command layer that reconciles the work driver, memory bridge, git history, and canonical claim traces. See `docs/product/RED_BYTE_AGENT_CONTROL_LOOP.md`.

Relevant vault nodes:
- `01 Dashboard/RedByte Engineering Brain.md` - master entry point
- `05 Bugs/BUG-00N.md` - per-bug notes (close after fix is committed)
- Session logs - add handoff summary after each slice

---

## Maintenance

- After adding a new command, update this doc and `DOC_INDEX.md`
- After changing the prompt templates, update `last_validated` in this doc's frontmatter
- Run `pnpm rb:agent:ollama:doctor` after any Ollama model change to confirm deterministic health check output
