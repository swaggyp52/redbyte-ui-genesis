# Claude Automation System

## Philosophy

**Claude decides. Copilot edits.**

Claude is the senior architect. It does not write production code directly. It:
- Reviews design decisions
- Identifies failure modes
- Validates invariants
- Proposes CI gates
- Answers "should we?" not "how do we?"

Copilot implements. You validate. CI enforces.

---

## Installed Scripts

### 1. `claude-analyze.ps1` — General-purpose Claude analysis

**Usage:**
```powershell
.\scripts\claude-analyze.ps1 -Prompt "Analyze the FPGA proof pipeline" -OutFile "analysis.md"
```

**When to use:**
- Design reviews
- Architecture documentation
- Pattern analysis
- One-off investigations

---

### 2. `claude-audit-proof.ps1` — Pre-phase proof audit

**Usage:**
```powershell
.\scripts\claude-audit-proof.ps1 -Phase "4" -FailOnIssues
```

**When to use:**
- Before major phase transitions
- Before production deployments
- Weekly integrity checks
- Post-incident reviews

**What it checks:**
1. Academic integrity test (would proofs hold up in dispute?)
2. Reproducibility guarantees
3. Untested failure modes
4. Missing invariants
5. CI gaps

---

### 3. `claude-ci-gate.ps1` — Binary CI decision

**Usage:**
```powershell
.\scripts\claude-ci-gate.ps1 `
  -Question "Does this repo meet production-grade security expectations?" `
  -BlockOnNo
```

**When to use:**
- In GitHub Actions / GitLab CI
- As a pre-commit hook
- Before merging to main
- Compliance checks

**Example integration (GitHub Actions):**
```yaml
- name: Claude Security Gate
  run: |
    .\scripts\claude-ci-gate.ps1 `
      -Question "Are there any unvalidated external inputs in the proof pipeline?" `
      -BlockOnNo
```

---

## System Prompt

Located at `.claude/system.md`

Defines Claude's role:
- Senior systems engineer and auditor
- Focuses on correctness over speed
- Flags implicit assumptions
- Requires justification for changes

**To use custom system prompt:**
```powershell
claude --system-prompt "$(Get-Content .claude\system.md -Raw)" -p "Your question"
```

---

## Best Practices

### ✅ Good Claude usage:
- "What assumptions does this proof make?"
- "Propose a CI gate to catch replay failures"
- "Review this architecture for failure modes"
- "Is this reproducible?"

### ❌ Bad Claude usage:
- "Write this feature"
- "Fix all the bugs"
- "Optimize everything"
- "Make it production-ready"

---

## Automation Tiers

### Tier A: Scripted Analysis (Deterministic)
Use `claude-analyze.ps1` or `claude-ci-gate.ps1`
- Runs in CI
- Output is saved
- Can block builds
- Fully reproducible

### Tier B: Interactive Agent (Exploratory)
Use `claude` directly in terminal
- Long reasoning sessions
- Multi-step investigations
- Design exploration
- Not for CI

---

## Example Workflows

### Weekly Proof Audit
```powershell
.\scripts\claude-audit-proof.ps1 -Phase "current" -FailOnIssues
git add audit-results
git commit -m "chore: weekly proof audit"
```

### Pre-Deploy Security Check
```powershell
.\scripts\claude-ci-gate.ps1 `
  -Question "Are all proof artifacts signed and verifiable?" `
  -BlockOnNo
```

### Design Review
```powershell
.\scripts\claude-analyze.ps1 `
  -Prompt "Review packages/logic-core for FPGA simulation correctness" `
  -OutFile "docs/reviews/logic-core-$(Get-Date -Format 'yyyy-MM-dd').md"
```

---

## Integration with Copilot

1. **Claude** identifies what needs to change
2. **You** paste Claude's recommendation into Copilot Chat
3. **Copilot** generates the mechanical edits
4. **You** review and commit
5. **CI** validates with Claude gates

This is the correct division of labor.

---

## Troubleshooting

**"Claude Code on Windows requires git-bash"**
```powershell
setx CLAUDE_CODE_GIT_BASH_PATH "C:\Program Files\Git\bin\bash.exe"
```
Then restart terminal.

**"Command not found: claude"**
Verify PATH includes `C:\Users\<you>\.local\bin`

**"Claude response unparseable"**
Check `.claude/system.md` — overly complex system prompts can break structured output.

---

## Next Steps

1. Run your first proof audit:
   ```powershell
   .\scripts\claude-audit-proof.ps1 -Phase "current"
   ```

2. Add a CI gate to GitHub Actions (see examples above)

3. Schedule weekly proof audits in your ops workflow

4. Train your team: Claude reviews, Copilot implements

---

**Remember:** Claude is your chief architect. Treat it accordingly.
