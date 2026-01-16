# Manual Claude Audit Instructions

Since `claude -p` requires Git Bash (which isn't fully configured), use the **Claude Code terminal** directly.

## Run Proof Audit Manually

1. Open the **Claude Code** terminal tab in VS Code
2. Paste this prompt:

```
Analyze this redbyte-ui repository's proof system for Phase current.

Answer these questions with extreme rigor:

1. **Academic Integrity Test**: If this system were used in an academic integrity dispute, 
   would the proof artifacts hold up under scrutiny? Why or why not?

2. **Reproducibility**: Can every proof artifact be regenerated deterministically from source? 
   List any exceptions.

3. **Failure Modes**: Identify one failure mode not currently tested in the proof pipeline.

4. **Missing Invariants**: What critical assumptions are implicit but not validated?

5. **CI Gap**: What could fail in production that would pass CI today?

Return detailed markdown with specific file/line references where relevant.
Be brutally honest. This is a pre-flight check, not a sales pitch.
```

3. Review Claude's response
4. Copy the response to `audit-results/proof-audit-YYYY-MM-DD.md`

## Automation Note

Once Git Bash is fully installed and working at `C:\Program Files\Git\bin\bash.exe`, the automated scripts will work:
```powershell
.\scripts\claude-audit-proof.ps1 -Phase "current"
```

Until then, use Claude Code terminal interactively.
