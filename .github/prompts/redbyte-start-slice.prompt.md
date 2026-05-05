# RedByte - Start Slice Prompt

Use this prompt to begin a bounded RedByte implementation slice. Run it at the start of a session.

---

## Pre-flight

```
pnpm rb:work:status
pnpm rb:work:next
pnpm rb:control:next
git status --short
git log --oneline -3
```

Stop if:
- the working tree is dirty with unrelated files
- the work driver recommends a different slice than expected
- any required docs are missing (see "Required docs" below)

Terminal-first rule:
- Use terminal commands for proof (`git status`, `git diff`, work-driver output, validators, targeted tests).
- If a command fails, include the exact command and failure output in the report.
- Do not claim completion without terminal-backed evidence and a commit hash.
- For local-agent/Ollama work, run `pnpm rb:agent:ollama:doctor` first; if it fails, do not run `pnpm rb:agent:next`.
- If `rb:work:next`, `rb:memory:next-product-context`, and `rb:control:next` disagree, report the disagreement and prefer current repo truth plus recent commits.

## Required docs - read before any implementation

```
AI_STATE.md
docs/ACTIVE_WORK.md
docs/product/RED_BYTE_CURRENT_TRUTH.md
docs/product/RED_BYTE_AGENT_OPERATING_RULES.md
.redbyte/work/NEXT_WORK_PACKET.md
.redbyte/agent/runs/control-next-latest.md
```

## Slice implementation rules

1. Implement only what `.redbyte/work/NEXT_WORK_PACKET.md` recommends.
1. Reconcile that packet against `.redbyte/agent/runs/control-next-latest.md` before editing.
2. Write tests before behaviour changes (TDD - RED then GREEN).
3. Touch only files in the `Allowed files/patterns` list from the work packet.
4. Do not touch `Forbidden files/patterns` from the work packet.
5. Run validation commands from the work packet before declaring done.
6. Run the build: `pnpm --filter @redbyte/playground build`.

## Done criteria - all must be true

- [ ] Tests pass (`pnpm -w exec vitest run [pattern]`)
- [ ] Relevant gates pass
- [ ] Build passes (`pnpm --filter @redbyte/playground build`)
- [ ] `AI_STATE.md` updated with change log entry
- [ ] `docs/ACTIVE_WORK.md` updated if priorities changed
- [ ] Control docs closed if the slice completes a queue item
- [ ] Committed - one logical commit, only this slice's files staged
- [ ] Not pushed (do not push without explicit user instruction)

## Commit format

```
type(scope): short description

Body: what changed, why, what was validated.
Attribution: Connor Angiel
```

Types: `fix`, `feat`, `docs`, `chore`, `test`, `refactor`
