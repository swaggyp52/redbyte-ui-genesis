---
doc_status: current
last_validated: 2026-05-05
owner: Connor Angiel
used_by_claude: true
role: defines the trust and capability model for AI agents working on RedByte
---

# RedByte Agent Capability Model

This document defines what AI agents (local and cloud) are trusted to do on the RedByte codebase, and how that trust is earned incrementally.

---

## 1. Trust phases

Agent capability is graduated. A phase must be **proven stable** before the next phase is unlocked.

| Phase | Name | Capability | Trust gate |
|-------|------|-----------|------------|
| 0 | Connectivity | Smoke-test Ollama/model; check control doc presence | No code touched |
| 1 | Read-only intelligence | Read docs, generate context bundles, propose next prompts | Outputs go to `.redbyte/agent/runs/` only |
| 2 | Diff review | Analyse `git diff` against RedByte rules; detect doc gaps | No file writes to product code |
| 3 | Patch proposal | Generate `.patch` output only; never applies it | Human reviews patch before `git apply` |
| 4 | Controlled edit | Edit one file per session, with user confirmation before write | Human confirms each file before write |
| 5 | Controlled commit | Stage + commit, never push, human confirms message | Human confirms commit before execution |
| 6 | Slice automation | Full slice: edit → test → gates → commit, with human review checkpoint | Requires prior phases proven clean |

**Default (current):** Phases 0–2. Phases 3–6 require explicit scope approval.

---

## 2. Forbidden actions (all phases)

These constraints apply to every agent at every phase:

- No editing product files unless explicitly in scope (phases 4+)
- No `git add` or `git commit` without user confirmation (phases 5+)
- No `git push` — ever, at any phase
- No writing outside `.redbyte/agent/runs/` at phases 0–2
- No inventing requirements or features
- No claiming completion without evidence (diff, test output, gate output, commit hash)
- No reopening closed issues without new evidence

---

## 3. Context reading contract

Before generating any output, an agent must have read:

1. `AI_STATE.md` — change log and current session context
2. `docs/ACTIVE_WORK.md` — live priorities
3. `docs/product/RED_BYTE_CURRENT_TRUTH.md` — canonical state
4. `docs/product/RED_BYTE_AGENT_OPERATING_RULES.md` — operating constraints
5. `.redbyte/work/NEXT_WORK_PACKET.md` — work driver output (if available)

An agent that has not read these docs before proposing changes is operating outside its authority.

---

## 4. RedByte-specific trust distinctions

Agents must never conflate:

| Concept A | Concept B | Why distinct |
|-----------|-----------|-------------|
| Physical pin mapped | Verify evidence exists | Mapping is student action; Verify is behavioural proof |
| Draft export | Trusted export | Draft is artifact-ready; trusted requires Verify comparison evidence |
| NEEDS REVIEW chip shown | Error blocking progress | NEEDS REVIEW is advisory; specific fix path must be named |
| Committed locally | Pushed to origin | Git log confirms commit; remote status requires explicit push check |
| Test passing | Gate passing | Gates check end-to-end scenarios; unit tests check logic isolation |

---

## 5. Output labelling

Every agent-generated file must include:
- Generation timestamp (ISO 8601)
- Model name used
- Command or context that triggered generation

Example header (used by `rb-local-agent.mjs`):
```
# RedByte Next-Task Prompt

_Generated 2026-05-05T14:23:11.000Z_
_Model: qwen2.5-coder:7b_
```

---

## 6. Phase progression criteria

To advance from Phase N to Phase N+1:

1. Phase N outputs have been **used and validated** on at least 3 real slices
2. No false positives (incorrect review findings) in the last 5 review runs
3. No security or scope violations in any phase N run
4. Explicit approval from the lead engineer (Connor Angiel)

---

## 7. Cloud agent (Claude/Copilot) trust model

Cloud agents (Claude Sonnet, GitHub Copilot) operate under the same phase model, but their default scope is wider because they are running in a supervised interactive session:

- Claude in VS Code agent mode: defaults to Phase 4 capability (controlled edits with confirmation)
- GitHub Copilot inline: defaults to Phase 3 (suggestions only, human applies)
- Automated CI agents: Phase 0–1 only (read-only)

Cloud agents must still follow all forbidden actions above, and must still read the mandatory context docs before proposing changes.

---

## 8. Evidence requirements by claim type

| Claim | Required evidence |
|-------|------------------|
| "Tests pass" | `pnpm -w exec vitest run [pattern]` output showing N/N |
| "Gates pass" | Specific gate command output (e.g., `pnpm --filter @redbyte/rb-logic-core test`) |
| "Build passes" | `pnpm --filter @redbyte/playground build` output |
| "Committed" | `git log --oneline -1` showing the commit hash and message |
| "Pushed" | `git log --oneline origin/main..HEAD` showing 0 commits ahead |
| "Slice complete" | All of the above, plus control docs updated |
