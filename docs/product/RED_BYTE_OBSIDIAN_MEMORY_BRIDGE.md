---
doc_status: current
last_validated: 2026-05-05
owner: Connor Angiel
used_by_claude: true
role: operating guide for the repo-local Obsidian and Ollama product memory bridge
---

# RedByte Obsidian Memory Bridge

The RedByte Obsidian Memory Bridge is a repo-local, read-only bridge between:

- RedByte repo control docs
- configured Obsidian vault notes
- work-driver packets
- local git state
- local Ollama chat and optional embedding models
- generated, gitignored memory indexes and reports

It exists to make product work traceable. RedByte product definitions, workflow claims, feature status, tests, docs, and stale memory risks should be discoverable from source-backed reports instead of chat history.

---

## What It Is Not

The bridge is not:

- an autonomous coding agent
- a replacement source of truth
- a product UI feature
- a vault writer
- a commit/push tool
- permission to invent product claims

In v0, the bridge never writes to Obsidian. It only produces sync plans.

---

## Why RedByte Needs It

RedByte is a proof-backed FPGA/digital-logic engineering workbench. The product spine is:

```text
Project -> Design -> Verify -> Map Pins / Hardware -> Export
```

The repo and the Obsidian engineering brain both contain useful truth, but they have different authority. Repo current-state docs own product truth. Obsidian is memory, investigation context, decision history, and session handoff material.

The bridge keeps that distinction explicit.

---

## Source Hierarchy

When sources conflict, use this order:

1. Current repo truth: `AI_STATE.md`, `docs/ACTIVE_WORK.md`, `docs/product/RED_BYTE_CURRENT_TRUTH.md`, current git state, and current product control docs.
2. Product target/contract: `docs/product/V1_RELEASE_SPEC.md`, `docs/product/RED_BYTE_STUDIO_PRODUCT_BRIEF.md`, `docs/contracts/RedByte_Product_Contract.md`.
3. Surface specs and architecture: `docs/ide/**`, `docs/RED_BYTE_IDE_PRODUCT_FLOW_MODEL.md`, `docs/IDE_PRODUCT_DEBT_REGISTER.md`, `docs/IDE_SYSTEM_MAP.md`, and the product manual.
4. Obsidian memory: Engineering Brain, Session Log, architecture notes, decision notes, bug notes, company/product/founder notes.
5. Historical or stale docs: superseded, deprecated, archived, or contradicted sources.

Obsidian does not override repo truth.

---

## Architecture

```text
Repo control docs
+ Obsidian Markdown notes
+ work-driver packet
+ local git state
+ AI_STATE / ACTIVE_WORK
+ Ollama markdown/JSON synthesis
+ optional embeddings
= RedByte product memory bridge
```

The bridge supports:

- local indexing
- local search
- source-aware synthesis
- repo-vs-Obsidian conflict detection
- traceability reports
- sync plans
- next-task grounding
- handoff generation
- control-loop input for `pnpm rb:control:next`
- problem-intake evidence for `pnpm rb:problem:intake`

The bridge does not:

- write to Obsidian automatically
- edit product code
- stage, commit, or push
- become the new source of truth
- invent claims beyond repo evidence

---

## Configuration

Template:

```text
.redbyte/agent/memory/config.example.json
```

Optional private override:

```text
.redbyte/agent/memory/config.json
```

`config.json` is gitignored. Do not commit private absolute vault paths.

Safe defaults:

- `allowVaultWrites: false`
- `traceabilityRequired: true`
- `indexOutputDir: ".redbyte/agent/memory/index"`
- `chatModel: "auto"`
- `embeddingModel: "all-minilm"`

If the Obsidian vault is in the repo root, the example config can be used as-is. If the vault lives elsewhere, copy the example config and set `obsidianVaultPath` locally.

---

## Generated Files

Generated outputs are local-only and gitignored:

```text
.redbyte/agent/memory/index/manifest.json
.redbyte/agent/memory/index/source-map.json
.redbyte/agent/memory/index/chunks.jsonl
.redbyte/agent/memory/index/embeddings.jsonl
.redbyte/agent/runs/memory-synth-latest.md
.redbyte/agent/runs/obsidian-sync-plan.md
.redbyte/agent/runs/trace-latest.md
.redbyte/agent/runs/next-product-context.md
.redbyte/agent/runs/memory-handoff-latest.md
```

Do not stage generated index or run files.

---

## Commands

| Script | Purpose |
|---|---|
| `pnpm rb:memory:doctor` | Verify config, vault path, repo docs, Ollama, models, output ignores, and no-write mode. |
| `pnpm rb:memory:index` | Build local chunks from repo docs and configured Obsidian notes. Uses embeddings when available. |
| `pnpm rb:memory:search -- "query"` | Search the index. Uses embeddings if present, otherwise keyword fallback. |
| `pnpm rb:memory:synth -- "question"` | Ask a product question with repo truth and memory chunks as context. |
| `pnpm rb:memory:sync-plan` | Compare repo truth and Obsidian memory; write a no-write sync plan. |
| `pnpm rb:memory:trace -- "claim"` | Produce a claim-to-docs/code/tests/gates traceability report. |
| `pnpm rb:memory:next-product-context` | Generate a source-backed context pack for the next product slice. |
| `pnpm rb:memory:handoff` | Generate a handoff from git state, control docs, and memory search. |

For the complete pre-product-work packet, run `pnpm rb:control:next` after memory context generation. The control loop treats memory outputs as evidence candidates and reconciles them against work-driver state, git history, and current repo truth.

For natural-language product feedback, run `pnpm rb:problem:intake -- "raw feedback"` first. Problem intake uses memory hits as supporting context only; Obsidian memory still cannot override current repo truth.

---

## Embeddings

The bridge uses Ollama `/api/embed` when a configured embedding model is installed.

Default:

```bash
ollama pull all-minilm
```

Alternative:

```bash
ollama pull embeddinggemma
```

If no embedding model is installed, indexing still succeeds and search uses keyword fallback.

---

## Traceability

Traceability is defined in:

```text
docs/product/RED_BYTE_PRODUCT_TRACEABILITY_MODEL.md
```

Use:

```bash
pnpm rb:memory:trace -- "Export is trusted only after Verify PASS"
pnpm rb:memory:trace -- "Map Pins does not replace Verify proof"
```

Reports should identify:

- current truth status
- supporting repo docs
- likely code owners
- tests/gates
- missing tests
- stale/conflicting Obsidian notes
- recommended next action
- evidence level

---

## Safety Rules

- Keep `allowVaultWrites` false.
- Do not commit `config.json`.
- Do not commit `index/**` or generated run outputs.
- Do not let Obsidian override repo current-state docs.
- Do not use stale or OS-era docs as product truth.
- Do not treat target-state docs as shipped behavior.
- Do not use memory reports as proof unless they cite docs, code, tests, or gates.

---

## Future Phases

Possible future phases:

- stronger deterministic conflict heuristics
- schema-backed trace reports consumed by CI
- explicit decision-record gap detection
- optional human-approved vault patch generation
- richer embedding model support

Vault writes remain out of scope until explicitly approved.

## Attribution

Connor Angiel
