# Runner Discipline

**Purpose**: Maintain safety guarantees as RedByte evolves  
**Status**: ENFORCED  
**Last Updated**: 2026-01-14 23:30 UTC

---

## Core Principle

**The runner, not the AI, is in charge.**

The AI:
- Proposes patches
- Never decides what ships

The runner:
- Enforces branches
- Enforces tests
- Enforces smoke checks
- Enforces stop conditions

This inversion is the difference between "overnight productivity" and "overnight repo corruption."

---

## Three Permanent Guardrails

### 1. Freeze the Runner

**Rule**: Treat `scripts/night_shift.ps1` as infrastructure code.

**Why**: The runner contains all safety logic. Casual edits risk silent breakage.

**Process**:
- ❌ Do NOT edit night_shift.ps1 directly for "small improvements"
- ✅ DO open PR with explicit justification
- ✅ DO test manually 2-3 times before merging
- ✅ DO document changes in ops/NIGHT_SHIFT_LOG.md

**Emergency Override**: If runner is broken and blocking work, edit + commit with message:
```
fix(night-shift): emergency fix - [brief reason]

RUNNER_DISCIPLINE override: [explain why immediate fix needed]
```

---

### 2. NO_REFACTOR Convention

**Rule**: Workers must refuse large diffs unless ticket explicitly states `ALLOW_REFACTOR`.

**Definition of "Large Diff"**:
- \>100 lines changed, OR
- Touches \>3 files unrelated to goal, OR
- Renames/moves files not mentioned in ticket

**Enforcement** (in worker prompts):
```
STOP CONDITIONS:
- If your patch exceeds 100 lines and ticket does NOT say ALLOW_REFACTOR → refuse and exit 1
- If you touch files not listed in "Files:" section → refuse and exit 1
- Morning-you decides if refactors are worth it, not overnight-agent
```

**Why**: Prevents agent from "cleaning up" things you didn't ask for. Refactors are high-risk changes that require human judgment.

**Example ALLOW_REFACTOR ticket**:
```markdown
## [P1] [READY] Refactor: Extract Lab Validation Logic
**Status**: READY
**Goal**: Extract checkpoint validation into shared utility
**Files**: (allow touching up to 10 files for this refactor)
**Acceptance**: All tests pass, no behavior change
**Constraints**: ALLOW_REFACTOR (justified: reduces duplication before Phase 3)
```

---

### 3. Limit Overnight Scope Permanently

**Rule**: Max 2 tickets per night shift. Do NOT raise without adding more verification.

**Why**: Autonomy scales with verification, not confidence.

**Current Verification Stack**:
- Unit tests (pnpm test --run)
- Build (pnpm -r build)
- Smoke test (Playwright headless)
- Proof logs (ops/proof/)

**To Raise to 3 Tickets**, ADD:
- Visual regression testing (Percy/Playwright screenshots)
- Performance regression gates (bundle size, test runtime)
- Integration smoke (multi-app interaction)

**To Raise to 4+ Tickets**, ADD:
- Full E2E suite (all Playwright specs)
- Deployment smoke (Cloudflare Pages preview)
- Security scan (npm audit, Snyk)

**Current Limit**: 2 tickets = 2 PRs = manageable morning review  
**Never Exceed**: 5 tickets (too much context to review safely)

---

## Verification Scaling Law

**Principle**: Overnight throughput must stay proportional to verification coverage.

| Tickets/Night | Required Verification | Review Time | Risk Level |
|---------------|----------------------|-------------|------------|
| 1 | Unit + Build | 5 min | Minimal |
| 2 | Unit + Build + Smoke | 10 min | Low |
| 3 | Unit + Build + Smoke + Visual | 20 min | Moderate |
| 4 | Unit + Build + Smoke + Visual + E2E | 30 min | Moderate-High |
| 5+ | Full CI + Deployment + Security | 45+ min | High |

**Current Config**: 2 tickets/night = 10 min review = sustainable indefinitely

---

## Long-Term Maintenance

### When RedByte Grows

As RedByte adds:
- More apps (beyond Playground/Labs)
- More packages (beyond 17)
- More deployment targets (beyond Cloudflare Pages)

**Adjust**:
- Smoke test coverage (add critical user flows)
- Ticket scope limits (smaller changes = more tickets OK)
- Verification gates (deployment preview, cross-app smoke)

**DO NOT Adjust**:
- Patch-based workflow (always use git apply)
- Stop-on-failure (never allow cascading failures)
- Branch-only commits (never push to main)

### When to Add "More Agents"

**BAD Reason**: "I want more features faster"  
**GOOD Reason**: "I have a new class of work with distinct verification needs"

**Example GOOD Addition** (future):
- **Agent**: HDL Exporter (generates Verilog from circuits)
- **Verification**: Icarus Verilog synthesis check + waveform comparison
- **Queue**: Separate queue (ops/HDL_EXPORT_QUEUE.md)
- **Runner**: Separate runner (scripts/hdl_export_shift.ps1)

**Anti-Pattern**: "Let's add 5 agents running in parallel overnight"  
**Why Bad**: Verification doesn't scale, morning-you drowns in PRs

---

## Academic Context

**What You Built**: A constraint-based autonomous engineering system with formal safety guarantees

**Key Properties**:
1. **Determinism**: Same ticket + same codebase = same patch
2. **Auditability**: Every change has proof (test/build/smoke logs)
3. **Reversibility**: All changes are git-revertible patches
4. **Isolation**: Every ticket runs in its own branch
5. **Bounded Risk**: Max 2 tickets, stop-on-failure, no cascading

**Why It's Research-Grade**:
- You didn't chase "more autonomy"
- You built "safe autonomy through constraint enforcement"
- The runner overrides agent confidence
- Verification scales with throughput

**Comparison to Industry**:
- GitHub Copilot Workspace: Freestyle edits, no verification gates
- Cursor Composer: Multi-file edits, no branch isolation
- Devin: Autonomy without formal constraints

**RedByte Night Shift**: Autonomy constrained by safety-first engineering principles

---

## Final Reminder

**You crossed the line from "experimenting with AI" into "operating an automated engineering system."**

That requires:
- Discipline over speed
- Verification over throughput
- Constraints over capabilities

The system you built enforces those principles even when you're asleep.

**That's why it's safe.**

---

**Document Version**: 1.0  
**Enforcement**: ACTIVE  
**Next Review**: After 10 successful overnight runs
