---
doc_status: current
last_validated: 2026-05-05
owner: Connor Angiel
used_by_claude: true
role: operating guide for product problem intake
---

# RedByte Product Problem Intake

The RedByte Product Problem Intake loop turns raw product feedback into a source-backed problem packet before implementation starts.

It exists because product complaints such as "this feels wrong" or "the agent overbuilt something simple" are easy for agents to mistranslate. The intake loop keeps the original wording visible, maps the issue to the product spine, checks memory and repo truth, and generates a bounded Codex prompt.

---

## What It Is

- A deterministic repo-local feedback translation loop.
- A guardrail against overbuilt or classroom-centered fixes.
- A bridge from Connor's raw wording to docs, code, tests, gates, and evidence.
- A read-only Obsidian/Ollama integration point for v0.
- A generated packet under `.redbyte/agent/runs/problems/`.

## What It Is Not

- It is not product UI work.
- It is not a generic AI assistant.
- It is not model fine-tuning.
- It is not an autonomous implementation agent.
- It does not write to Obsidian.
- It does not stage, commit, or push.

---

## Commands

### `pnpm rb:problem:doctor`

Checks repo root, config, output ignore rules, control/memory command availability, dirty product files, Ollama availability, and the v0 no-write rule.

### `pnpm rb:problem:intake -- "raw feedback"`

Writes:

- `.redbyte/agent/runs/problems/problem-latest.json`
- `.redbyte/agent/runs/problems/problem-latest.md`

The packet preserves raw feedback, classifies the issue, maps it to the product spine, cites memory/repo hits, lists related claims, suggests minimal fixes, names overengineering risks, and writes a Codex execution prompt.

### `pnpm rb:problem:triage`

Reads the latest packet and decides whether the issue is ready to implement, needs browser audit, needs doc reconciliation, is blocked by hardware/manual evidence, or may be duplicate known debt.

### `pnpm rb:problem:trace`

Traces the latest packet to related product claims, likely code files, tests/gates, evidence status, and missing evidence.

### `pnpm rb:problem:prompt`

Writes the exact Codex implementation prompt after intake, triage, and trace exist.

### `pnpm rb:problem:close`

Writes a closeout checklist after implementation: AI_STATE update reminder, docs/memory sync suggestions, tests/gates checklist, and claim evidence notes.

### `pnpm rb:problem:test`

Runs focused script tests for schema validation, raw feedback preservation, product spine mapping, overengineering warnings, output path guards, and fallback behavior.

---

## Example

Input:

```text
pnpm rb:problem:intake -- "Map Pins feels like two different sections and I do not know what action I am supposed to take."
```

Expected packet behavior:

- Preserves that exact sentence.
- Maps the issue to Map Pins / Hardware.
- Classifies workflow confusion and UX friction.
- Keeps Verify proof distinct from pin mapping.
- Suggests clarifying the primary Map Pins action before any broad redesign.
- Lists `pnpm ide:gate:hardware-checklist-contract` and related gates as evidence candidates.
- Produces a Codex prompt that forbids broad workflow rewrites.

---

## Safety Rules

- Repo truth wins over Obsidian memory.
- Generated problem outputs are evidence candidates, not canonical docs.
- Obsidian writes are disabled in v0.
- Do not start implementation from ambiguous product feedback without a problem packet.
- Do not replace a simple complaint with a broad redesign.
- Always list do-not-build items and definition of done.
- Always run focused tests/gates before claiming a product fix.

---

## Future Phases

- Store approved problem packets as Obsidian decision records after explicit user authorization.
- Link problem packets to issue templates and pull request checklists.
- Add richer semantic search when an embedding model is installed.
- Add browser-audit hooks that can attach screenshots or surface-specific findings.
- Add a dashboard of open product problems, but only after the packet loop proves useful.
