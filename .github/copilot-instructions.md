# RedByte - GitHub Copilot Repository Instructions

RedByte is a deterministic, browser-based FPGA educational IDE for the Digilent Basys3 board (`xc7a35tcpg236-1`). Students design circuits, prove behavior in Verify, map signals to Basys3 resources, and export a Vivado-ready package.

---

## Canonical truth

Before implementing any slice, read in this order:

1. `AI_STATE.md` - change log and recent session context
2. `docs/ACTIVE_WORK.md` - live priorities and evidence table
3. `docs/product/RED_BYTE_CURRENT_TRUTH.md` - canonical product state snapshot
4. `docs/product/RED_BYTE_AGENT_OPERATING_RULES.md` - operating constraints for agents
5. `.redbyte/work/NEXT_WORK_PACKET.md` - work driver output (run `pnpm rb:work:next` to generate)

These files tell you what is already fixed, what is live, and what to work on next. Do not rely on conversation history or stale roadmap docs.

---

## Product spine

```
Project -> Design -> Verify -> Map Pins / Hardware -> Export
```

- Import is a utility entry point, not a workflow step.
- Board programming is an external handoff after Export.
- Do not reorder or collapse the spine without an explicit scope statement.

---

## Trust distinctions - never confuse these

| DO NOT conflate | They are distinct because |
|----------------|--------------------------|
| Draft Export | Trusted Export | Draft = artifact-ready; Trusted = current Verify Compare PASS + current mapping + current bundle |
| Mapped hardware | Verified/trusted hardware | Physical pin assignment != behavioural proof |
| NEEDS REVIEW chip shown | Blocking error | NEEDS REVIEW is advisory; must name specific fix path |
| Committed locally | Pushed to origin | Never claim pushed without explicit push confirmation |

---

## Operational rules

- Run `pnpm rb:work:status` and `pnpm rb:work:next` before starting any implementation.
- Before product work, run `pnpm rb:control:next` and use it to reconcile work-driver, memory, git history, and current product truth.
- If the user describes a product issue in natural language, run `pnpm rb:problem:intake -- "<raw feedback>"` before implementation. Preserve the raw wording, map it to the product spine, list overengineering risks, and produce a definition of done.
- Before claiming a product fact, run or reference `pnpm rb:control:trace-claims` or `pnpm rb:memory:trace -- "claim"`.
- If work-driver, memory, control-loop, and problem-packet outputs disagree, report the disagreement instead of forcing the task.
- Treat generated memory/control outputs as evidence candidates, not canonical docs.
- Terminal access is available in this environment when tools provide it; use terminal commands for verification instead of guessing.
- Verify repo state, validation results, and generated outputs from terminal (`git status`, `git diff`, work-driver/doc commands, targeted tests) before claiming done.
- For local agent/Ollama slices, run the actual `pnpm rb:agent:*` commands and report their outcomes.
- If a command fails, report the exact command and terminal error output; never claim completion without terminal-backed evidence.
- Never claim completion without actual repo diff, passing tests/gates, and a commit hash.
- One focused commit per slice. Stage only the active slice's files.
- Do not rewrite broad surfaces without explicit scope.
- Do not push unless explicitly instructed by the user.
- Use `pnpm`, never `npm install`.
- TypeScript strict mode throughout - no `any` except legacy fixtures with explicit comment.
- Connection shape: `{ id, from: { nodeId, portName }, to: { nodeId, portName } }` - flat shape is never valid.
- Port names must match Basys3 XDC exactly: `SW{N}`, `LD{N}`, `BTN{N}`, `CLK100MHZ`.

---

## Agent tooling

The local agent harness (`scripts/rb-local-agent.mjs`) provides:

```
pnpm rb:agent:ollama:doctor - deterministic Ollama/runtime health check
pnpm rb:agent:doctor    - compatibility alias for Ollama and repo readiness
pnpm rb:agent:context   - build context bundle from control docs
pnpm rb:agent:next      - generate next-task prompt via Ollama
pnpm rb:agent:review    - review current diff against RedByte rules
pnpm rb:agent:doc-sync  - identify doc/Obsidian update gaps
pnpm rb:agent:handoff   - generate session handoff draft
```

Spec: `docs/product/RED_BYTE_LOCAL_AGENT_LAB.md`
Capability model: `docs/product/RED_BYTE_AGENT_CAPABILITY_MODEL.md`

For Obsidian, memory, or traceability tasks, use `pnpm rb:memory:*` commands and never write to the vault unless explicitly authorized. The memory bridge is read-only for Obsidian in v0; it may generate indexes and reports only under gitignored `.redbyte/agent/` output paths.

For agent-control-loop tasks, use `pnpm rb:control:next`, `pnpm rb:control:trace-claims`, and `pnpm rb:control:test`. Never let Obsidian memory or generated run files override current repo truth.

For product-feedback or lost-in-translation tasks, use `pnpm rb:problem:doctor`, `pnpm rb:problem:intake`, `pnpm rb:problem:triage`, `pnpm rb:problem:trace`, and `pnpm rb:problem:prompt`. Never replace a simple complaint with a broad redesign.

Local-agent execution contract:
- Run `pnpm rb:agent:ollama:doctor` before any `rb:agent:next|review|doc-sync|handoff` command.
- If doctor fails, do not run `rb:agent:next`; fix health first or use `rb:agent:context` output manually.
- Do not switch models randomly; prefer installed small-model order and report exact selected model.
- Do not claim JSON mode works unless output is parseable and includes required command fields.

---

## Stale zone - do not use as current context

`docs/00-canon/00-08-*.md`, `docs/STUDENT_WORKFLOW.md`, `docs/IMPLEMENTATION_STATUS.md`, `docs/PRODUCT_SURFACES.md`, `docs/INTERACTION_CONTRACT.md` - all carry SUPERSEDED/HISTORICAL headers.
