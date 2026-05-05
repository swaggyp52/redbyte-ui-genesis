---
applyTo: "scripts/rb-*.mjs,.redbyte/agent/**/*.md,.redbyte/agent/**/*.json,.redbyte/agent/**/*.yaml"
---

# RedByte - Agent Tools Rules

## Safety contract (all phases)

Agent scripts must:

- **Never** edit product files (`packages/`, `apps/`, `docs/`, `src/`, `services/`) unless explicitly in scope.
- **Never** run `git add`, `git commit`, or `git push` without user confirmation.
- **Never** write outside `.redbyte/agent/runs/` during phase 0-2 operation.
- **Always** fail clearly - exit code 1 with an actionable error message if a required dependency (e.g. Ollama) is not available.
- **Always** include generation timestamp, model name, and triggering command in run output files.

## Phase model

| Phase | Capability | Status |
|-------|-----------|--------|
| 0 | Connectivity check (`doctor`) | Live |
| 1 | Read-only context and prompt generation (`context`, `next`) | Live |
| 2 | Diff review and doc-sync gap detection (`review`, `doc-sync`, `handoff`) | Live |
| 3+ | Patch proposal, controlled edit, controlled commit | Future - requires explicit scope approval |

Default: phases 0-2 only. Do not promote to phase 3+ without explicit instruction.

## Output rules

- Local run outputs (`.redbyte/agent/runs/`) must remain gitignored - never stage them.
- Config files (`config.json`) must remain gitignored - only `config.example.json` is tracked.
- Prompt templates (`.redbyte/agent/prompts/`) are source files and are tracked.

## Terminal verification contract

- This environment provides terminal access when tools are enabled; use it for real checks instead of assumptions.
- For local agent work, run the real commands: `pnpm rb:agent:ollama:doctor` (first), `pnpm rb:agent:context`, `pnpm rb:agent:next`, `pnpm rb:agent:review`, `pnpm rb:agent:doc-sync`, `pnpm rb:agent:handoff`.
- If `pnpm rb:agent:ollama:doctor` fails, do not run `rb:agent:next`; fix Ollama/model health first or continue with manual prompts from `context-latest.md`.
- Do not default to models that are not installed. Prefer installed small models and report the exact selected model tag.
- Do not claim JSON support unless output is parseable JSON and includes required keys for the command.
- Use terminal evidence to close claims: `git status --short`, `git diff --name-only`, validator/test output, and commit hash.
- If command execution fails, report the exact command and the concrete failure output.

## Script quality rules

- Follow the `rb-work-driver.mjs` Node ESM pattern: `resolveRepoRoot()` via `git rev-parse`, `fail()` to stderr + exit 1.
- Prefer structured output and explicit source listing in run outputs.
- Do not add heavy npm dependencies - stick to Node built-ins (`fs`, `path`, `child_process`, `fetch`).
- Support `REDBYTE_AGENT_MODEL` and `OLLAMA_BASE_URL` environment overrides.
- Support `REDBYTE_AGENT_FORMAT=json|markdown` for machine-readable output (see RED_BYTE_LOCAL_AGENT_LAB.md).
