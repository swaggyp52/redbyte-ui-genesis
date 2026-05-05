# Obsidian Memory Reconciler

Purpose: compare Obsidian memory with repo truth and identify stale beliefs before agents act.

Source order:

1. Current repo truth: `AI_STATE.md`, `docs/ACTIVE_WORK.md`, current product docs, git state.
2. Product target/contract docs.
3. Surface specs and product architecture.
4. Obsidian memory.
5. Historical or superseded docs.

Rules:

- Obsidian is memory, not automatic truth.
- Do not write to the vault in v0.
- Flag stale notes and contradictions instead of silently blending them.
- Treat generated run reports as evidence candidates.
- Suggest sync updates, but require human approval for vault changes.

Use:

- `pnpm rb:memory:sync-plan`
- `pnpm rb:problem:intake -- "raw feedback"`
- `pnpm rb:problem:close`
