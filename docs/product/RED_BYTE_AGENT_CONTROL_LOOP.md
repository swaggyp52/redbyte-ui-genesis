---
doc_status: current
last_validated: 2026-05-05
owner: Connor Angiel
used_by_claude: true
role: operating guide for the RedByte agent control loop
---

# RedByte Agent Control Loop

The RedByte Agent Control Loop is the repo-local preflight that turns product truth, work-driver state, memory search, git history, and traceability claims into one bounded next-slice packet.

It exists so future Codex, Claude, and Copilot sessions do not start product work from stale queue text, chat memory, or Obsidian notes alone.

---

## What it uses

The command reads:

- `AI_STATE.md`
- `docs/ACTIVE_WORK.md`
- `docs/product/RED_BYTE_CURRENT_TRUTH.md`
- `docs/product/RED_BYTE_WORK_QUEUE.md`
- `docs/product/RED_BYTE_WORK_DRIVER.md`
- memory bridge outputs under `.redbyte/agent/runs/`
- memory index availability under `.redbyte/agent/memory/index/`
- current git branch, status, and recent commits
- canonical product claims from `.redbyte/agent/memory/product-claims.example.json`

Repo current truth wins over Obsidian memory and generated run files. Generated files are evidence candidates only.

---

## What it does not do

It does not:

- edit product UI
- write to Obsidian
- stage, commit, or push
- choose arbitrary product strategy
- invent hardware or browser evidence
- make generated reports canonical product docs

The control loop prepares work. It does not perform product work.

---

## Relationship To Problem Intake

Use `pnpm rb:control:next` when choosing the next product slice from repo truth, work-driver state, memory, and git history.

Use `pnpm rb:problem:intake -- "raw feedback"` when Connor describes a product problem in natural language. Problem intake preserves the raw wording, maps it to the product spine, lists overengineering risks, and writes a bounded Codex prompt before implementation starts.

If problem intake and the control loop disagree, report the disagreement and prefer current repo truth plus recent commits. Do not force either generated output into product truth.

---

## Commands

### `pnpm rb:control:next`

Writes:

- `.redbyte/agent/runs/control-next-latest.md`
- `.redbyte/agent/runs/control-next-latest.json`

The report includes product truth, work-driver and memory recommendations, stale queue warnings, likely files/tests/gates, evidence level, risks, a do-not-touch list, definition of done, and a Claude/Codex-ready prompt.

Use this before major product work. If `rb:work:next` and memory disagree, report the disagreement instead of forcing a task.

### `pnpm rb:control:trace-claims`

Writes:

- `.redbyte/agent/runs/product-claims-trace-latest.md`
- `.redbyte/agent/runs/product-claims-trace-latest.json`

It checks RedByte's canonical product claims against configured docs, likely code files, and expected tests/gates. Each claim is marked `proven`, `partially proven`, `documented only`, `stale/conflicted`, or `unknown`.

### `pnpm rb:control:test`

Runs focused script-level tests for queue parsing, stale recommendation detection, claim classification, output path safety, and required report sections.

---

## How it prevents stale-roadmap work

The control loop compares current work-driver output, memory next-product-context output, recent commits, `ACTIVE_WORK.md`, `AI_STATE.md`, and completed queue items.

If a recommendation points to completed work, the control loop marks it stale. This catches cases like a queue still recommending the curated learning path after commits `13d77a3b` and `006a208c`.

If the top queue item is proof closure but current docs say final proof requires manual board observation, the control loop reports it as board-gated instead of pretending the agent can complete hardware evidence locally.

---

## Claim Traceability

Canonical claims live in:

`.redbyte/agent/memory/product-claims.example.json`

Each claim records claim id, statement, product area, expected status, source docs, likely code files, expected tests/gates, minimum evidence level, and stale-memory risk.

Evidence levels follow `docs/product/RED_BYTE_PRODUCT_TRACEABILITY_MODEL.md`.

Rule: no public/product claim should exceed the evidence level that supports it.

---

## Standard Start Sequence

Run this before a product slice:

```bash
pnpm rb:work:status
pnpm rb:work:next
pnpm rb:memory:next-product-context
pnpm rb:control:next
pnpm rb:control:trace-claims
git status --short
```

For ambiguous product feedback, run this before editing:

```bash
pnpm rb:problem:intake -- "raw feedback"
pnpm rb:problem:triage
pnpm rb:problem:trace
pnpm rb:problem:prompt
```

If the tree is dirty, classify the dirty files before continuing. Stop on unrelated product UI files.

---

## Future Phases

- Compare canonical claims against actual test execution results, not only configured test/gate paths.
- Read `trace-latest.json` per claim when Ollama output is reliable enough.
- Add stale Obsidian note IDs once note metadata is normalized.
- Add CI advisory mode that generates control reports on pull requests.
- Add manual approval flow for applying generated Obsidian sync plans.
