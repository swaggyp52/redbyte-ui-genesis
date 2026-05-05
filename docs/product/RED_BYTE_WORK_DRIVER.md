---
doc_status: current
last_validated: 2026-05-05
owner: Connor Angiel
used_by_claude: true
role: deterministic local work-driver guide for RedByte agent sessions
---

# RedByte Work Driver

`rb-work-driver` is the repo-local harness that turns RedByte's control docs plus current git state into a bounded work packet.

It exists so Claude and Copilot sessions stop reconstructing RedByte's operating rules from scratch every time.

---

## 1. What it is

`rb-work-driver` is a deterministic local CLI under `scripts/`.

It reads:

- `AI_STATE.md`
- `docs/ACTIVE_WORK.md`
- `docs/STUDENT_RELEASE_READINESS.md`
- `docs/manuals/RedByte_Product_Manual.md`
- `docs/contracts/RedByte_Product_Contract.md`
- `docs/product/RED_BYTE_CURRENT_TRUTH.md`
- `docs/product/RED_BYTE_AGENT_OPERATING_RULES.md`
- `docs/product/RED_BYTE_WORK_QUEUE.md`
- `docs/product/RED_BYTE_OBSIDIAN_SYNC_RULES.md`

It combines those docs with `git` state and outputs bounded Markdown guidance for the next RedByte slice.

---

## 2. What it is not

This is not an autonomous coding agent.

It does not:

- call external APIs
- wrap an LLM
- choose arbitrary new strategy outside the control docs
- edit product surfaces by itself
- update `AI_STATE.md` automatically in v0
- commit, push, or stage files

It is a deterministic repo driver, not an AI runtime.

---

## 3. Commands

### `pnpm rb:work:status`

Prints a Markdown repo-status snapshot to stdout.

It reports:

- current branch
- latest commit
- clean vs dirty worktree summary
- whether concurrent or uncommitted files exist
- source-of-truth docs found vs missing
- the top queue items from `RED_BYTE_WORK_QUEUE.md`
- the next safe task for the current repo state
- manual/hardware blocker notes when proof closure is recommended but current docs say final evidence requires a connected bench

If the working tree is dirty, this command warns and treats worktree reconciliation as the next safe coordination slice.

### `pnpm rb:work:next`

Generates:

- `.redbyte/work/NEXT_WORK_PACKET.md`

The packet includes:

- generated timestamp
- branch and commit
- dirty-tree warning when applicable
- recommended work item
- required docs to read first
- allowed files or patterns to touch
- forbidden files or patterns to touch
- validation commands
- expected commit message
- done criteria
- handoff requirements
- a Claude/Copilot-ready prompt block

### `pnpm rb:work:close`

Generates or refreshes:

- `.redbyte/work/HANDOFF_DRAFT.md`

The handoff draft includes:

- branch and latest commit
- git status summary
- files changed
- validation checklist
- `AI_STATE.md` reminder
- Session Log / Obsidian reminder
- next suggested action

The draft preserves a manual notes section across regenerations.

---

## 4. When to run it

Run `pnpm rb:work:status` before starting a RedByte slice.

Run `pnpm rb:work:next` once the current repo state is understood and you need a bounded packet for the next agent or session.

Run `pnpm rb:work:close` before closeout so the next session inherits a structured handoff instead of a blank slate.

---

## 5. How Claude and Copilot should use it

1. Run `pnpm rb:work:status` before editing.
2. If the tree is dirty, treat that as the active coordination problem before starting new product work.
3. Run `pnpm rb:work:next` to generate a bounded packet.
4. Read the packet's required docs first.
5. Stay inside the packet's allowed file patterns and validation commands.
6. Run `pnpm rb:work:close` near the end of the slice.
7. Update `AI_STATE.md` and any other required canonical docs explicitly; the driver does not do that for you.

---

## 6. Relationship to the control docs

The driver does not replace the control pack.

It is downstream of:

- `RED_BYTE_CURRENT_TRUTH.md`
- `RED_BYTE_AGENT_OPERATING_RULES.md`
- `RED_BYTE_WORK_QUEUE.md`
- `RED_BYTE_OBSIDIAN_SYNC_RULES.md`

Those docs define truth and work ordering. The driver packages that truth into an executable local work packet.

---

## 7. How it prevents stale-roadmap work

The driver is intentionally narrow.

It prevents stale-roadmap drift by:

- checking the current dirty tree first
- preferring the control docs over stale product briefs
- using `RED_BYTE_CURRENT_TRUTH.md` for the post-control-pass default next move
- using `RED_BYTE_WORK_QUEUE.md` for queue preview and bounded fallbacks
- using explicit slice profiles for allowed files, validations, and commit messages instead of free-form interpretation

This keeps future sessions from jumping straight into website, pilot, or broad redesign work when the repo truth says the next safe slice is smaller.

---

## 8. v0 limitations

Version 0 is intentionally simple.

- Queue parsing is markdown-heuristic based, not schema-backed.
- Slice guidance comes from a deterministic profile map, not deep semantic inference.
- The driver writes local Markdown only; it does not mutate canonical docs automatically.
- `.redbyte/work/` is created on demand and is ignored by git.
- Dirty-tree reconciliation is advisory in v0; the driver reports it but does not resolve it for you.
- Board-gated proof closure is advisory in v0; the driver reports the blocker but does not invent hardware evidence or skip the queue by itself.
- The handoff draft is a scaffold, not a release signoff.

That is enough for v0. The point is bounded repeatability, not autonomy theater.
