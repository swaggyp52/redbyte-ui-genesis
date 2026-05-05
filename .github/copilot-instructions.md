# RedByte â€” GitHub Copilot Repository Instructions

RedByte is a deterministic, browser-based FPGA educational IDE for the Digilent Basys3 board (`xc7a35tcpg236-1`). Students design circuits, prove behavior in Verify, map signals to Basys3 resources, and export a Vivado-ready package.

---

## Canonical truth

Before implementing any slice, read in this order:

1. `AI_STATE.md` â€” change log and recent session context
2. `docs/ACTIVE_WORK.md` â€” live priorities and evidence table
3. `docs/product/RED_BYTE_CURRENT_TRUTH.md` â€” canonical product state snapshot
4. `docs/product/RED_BYTE_AGENT_OPERATING_RULES.md` â€” operating constraints for agents
5. `.redbyte/work/NEXT_WORK_PACKET.md` â€” work driver output (run `pnpm rb:work:next` to generate)

These files tell you what is already fixed, what is live, and what to work on next. Do not rely on conversation history or stale roadmap docs.

---

## Product spine

```
Project â†’ Design â†’ Verify â†’ Map Pins / Hardware â†’ Export
```

- Import is a utility entry point, not a workflow step.
- Board programming is an external handoff after Export.
- Do not reorder or collapse the spine without an explicit scope statement.

---

## Trust distinctions â€” never confuse these

| DO NOT conflate | They are distinct because |
|----------------|--------------------------|
| Draft Export | Trusted Export | Draft = artifact-ready; Trusted = current Verify Compare PASS + current mapping + current bundle |
| Mapped hardware | Verified/trusted hardware | Physical pin assignment â‰  behavioural proof |
| NEEDS REVIEW chip shown | Blocking error | NEEDS REVIEW is advisory; must name specific fix path |
| Committed locally | Pushed to origin | Never claim pushed without explicit push confirmation |

---

## Operational rules

- Run `pnpm rb:work:status` and `pnpm rb:work:next` before starting any implementation.
- Terminal access is available in this environment when tools provide it; use terminal commands for verification instead of guessing.
- Verify repo state, validation results, and generated outputs from terminal (`git status`, `git diff`, work-driver/doc commands, targeted tests) before claiming done.
- For local agent/Ollama slices, run the actual `pnpm rb:agent:*` commands and report their outcomes.
- If a command fails, report the exact command and terminal error output; never claim completion without terminal-backed evidence.
- Never claim completion without actual repo diff, passing tests/gates, and a commit hash.
- One focused commit per slice. Stage only the active slice's files.
- Do not rewrite broad surfaces without explicit scope.
- Do not push unless explicitly instructed by the user.
- Use `pnpm`, never `npm install`.
- TypeScript strict mode throughout â€” no `any` except legacy fixtures with explicit comment.
- Connection shape: `{ id, from: { nodeId, portName }, to: { nodeId, portName } }` â€” flat shape is never valid.
- Port names must match Basys3 XDC exactly: `SW{N}`, `LD{N}`, `BTN{N}`, `CLK100MHZ`.

---

## Agent tooling

The local agent harness (`scripts/rb-local-agent.mjs`) provides:

```
pnpm rb:agent:doctor    â€” check Ollama and repo readiness
pnpm rb:agent:context   â€” build context bundle from control docs
pnpm rb:agent:next      â€” generate next-task prompt via Ollama
pnpm rb:agent:review    â€” review current diff against RedByte rules
pnpm rb:agent:doc-sync  â€” identify doc/Obsidian update gaps
pnpm rb:agent:handoff   â€” generate session handoff draft
```

Spec: `docs/product/RED_BYTE_LOCAL_AGENT_LAB.md`
Capability model: `docs/product/RED_BYTE_AGENT_CAPABILITY_MODEL.md`

---

## Stale zone â€” do not use as current context

`docs/00-canon/00â€“08-*.md`, `docs/STUDENT_WORKFLOW.md`, `docs/IMPLEMENTATION_STATUS.md`, `docs/PRODUCT_SURFACES.md`, `docs/INTERACTION_CONTRACT.md` â€” all carry SUPERSEDED/HISTORICAL headers.
