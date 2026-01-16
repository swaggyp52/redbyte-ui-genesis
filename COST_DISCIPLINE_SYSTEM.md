# Cost-Disciplined AI Automation System

## Overview

This system implements a **2-tier, cost-efficient architecture** for automating repo audits with Claude AI:
- **Tier A (Local, Free, Deterministic)**: Gather all context via git, pnpm, and local checks
- **Tier B (Paid, Once Max)**: Single Claude decision call with cached results

## Architecture

```
User Request
    ↓
[ai-run.ps1] - Orchestration entrypoint
    ├─ [context_pack.ps1] - Tier A: Gather local context (free)
    │   ├─ git rev-parse (commit, branch)
    │   ├─ git status (changed files)
    │   ├─ pnpm quality (linter checks)
    │   ├─ pnpm proof:run (FPGA proof execution)
    │   └─ ops/proof (artifact inventory)
    │   → Output: ops/claude/work/<runId>/context.json
    │
    ├─ Cache Check (SHA256: commit + file hashes)
    │   ├─ Cache Hit  → Return cached decision (0 calls, exit 0)
    │   └─ Cache Miss → Continue to Tier B
    │
    ├─ DryRun Mode (-DryRun flag)
    │   → Print context summary and exit (0 calls, exit 0)
    │
    ├─ Budget Check (-MaxClaudeCalls parameter)
    │   ├─ <= 0 → Exit with local results (0 calls, exit 0)
    │   └─ > 0 → Proceed to Tier B
    │
    └─ [claude_decide.ps1] - Tier B: Claude decision (paid, once max)
        ├─ Call: claude -p "<compact prompt with context>"
        ├─ Parse JSON response
        ├─ Detect rate limit (immediate stop, no retries)
        ├─ Save report: ops/claude/reports/<runId>-<task>-decision.txt
        ├─ Cache result: ops/claude/cache/<cacheKey>.json
        └─ Exit with status
```

## Scripts

### `scripts/ai-run.ps1` - Main Orchestrator

**Purpose**: Unified entrypoint for all audit tasks with cost discipline.

**Usage**:
```powershell
# Standard usage (up to 1 Claude call if not cached)
.\scripts\ai-run.ps1 -Task "proof-audit"

# Preview without Claude (0 calls)
.\scripts\ai-run.ps1 -Task "proof-audit" -DryRun

# Local-only analysis (0 calls)
.\scripts\ai-run.ps1 -Task "proof-audit" -MaxClaudeCalls 0

# Multiple calls allowed (not recommended - wastes credits)
.\scripts\ai-run.ps1 -Task "proof-audit" -MaxClaudeCalls 5

# Specific task types
.\scripts\ai-run.ps1 -Task "ci-gate"
.\scripts\ai-run.ps1 -Task "phase4-replay-audit"
```

**Parameters**:
- `-Task` (required): `proof-audit`, `ci-gate`, or `phase4-replay-audit`
- `-RunId` (optional): Timestamp-based ID for this execution (default: `yyyyMMdd-HHmmss`)
- `-MaxClaudeCalls` (optional): Budget enforcement (default: `1`)
- `-DryRun` (switch): Preview mode, 0 calls

**Outputs**:
- Context: `ops/claude/work/<runId>/context.json` (8-10 KB)
- Decision: `ops/claude/reports/<runId>-<task>-decision.txt` (if Claude called)
- Cache: `ops/claude/cache/<cacheKey>.json` (if Claude called)

**Exit Codes**:
- `0`: Success (either cached, dry-run, or valid decision)
- `1`: Failure (rate limit hit, file not found, etc.)

### `scripts/context_pack.ps1` - Tier A Context Gathering

**Purpose**: Deterministically collect all local repo state without Claude.

**Usage** (called by ai-run.ps1):
```powershell
.\scripts\context_pack.ps1 -RunId "20260115-210724"
```

**What It Collects**:
1. Git metadata
   - Current branch
   - Commit hash (full and short)
   - Changed files since HEAD~1 or uncommitted
2. Quality checks
   - `pnpm quality` pass/fail + last 50 log lines
   - Exit code
3. Proof execution
   - `pnpm --filter @redbyte/fpga-bridge proof:run` pass/fail
   - Last 50 log lines (includes MOCK mode simulation results)
4. Artifacts inventory
   - Count of files in `ops/proof/`
   - File list (names only, ~100-200 files typical)
5. Git status summary
   - Full `git status --porcelain` output

**Output Structure** (`context.json`):
```json
{
  "timestamp": "ISO-8601",
  "branch": "main",
  "commit": "8e232f0f0200f135f58a2862781a1b145222e2fb",
  "commit_short": "8e232f0f",
  "changed_files": ["file1.ts", "file2.ts", ...],
  "local_checks": {
    "quality": {
      "pass": true,
      "exit_code": 0,
      "last_lines": ["line1", "line2", ...]
    },
    "proof_run": {
      "pass": true,
      "exit_code": 0,
      "last_lines": ["[PROOF] Results: 2 passed, ...]
    },
    "proof_artifacts": {
      "count": 87,
      "files": "...file list..."
    }
  },
  "git_status": ["M file.ts", "?? new-file.md", ...]
}
```

### `scripts/claude_decide.ps1` - Tier B Claude Decision

**Purpose**: Make one structured Claude call to decide on audit results.

**Usage** (called by ai-run.ps1):
```powershell
.\scripts\claude_decide.ps1 `
    -ContextFile "C:\lab\redbyte-ui\ops\claude\work\20260115-210724\context.json" `
    -Task "proof-audit" `
    -RunId "20260115-210724" `
    -TimeoutSec 45
```

**Prompt Pattern** (built from context):
- Embeds commit hash, changed files, quality/proof status
- Asks task-specific questions (e.g., for `proof-audit`: "Are integrity checks complete?", "Any risks?")
- Expects JSON response: `{status: "PASS"|"FAIL", why: "...", actions: [...]}`

**Features**:
- **Rate Limit Detection**: Reads Claude output, detects "hit your limit", stops immediately (no retries)
- **Timeout**: 45 seconds (prevents hanging on slow Claude responses)
- **JSON Parsing**: Extracts decision from Claude's response
- **Report Generation**: Saves to `ops/claude/reports/<runId>-<task>-decision.txt`

**Exit Codes**:
- `0`: Decision made successfully
- `1`: Rate limit hit, timeout, or parse error

## Caching System

### Cache Key Computation

```
Cache Key = SHA256(commit_hash + file_hash_1 + file_hash_2 + ...)
Example: proof-audit-40C3CF727E1F (first 12 hex chars)
```

**Cache Hit Conditions**:
1. Same commit hash
2. Same changed files (determined by SHA256)
3. Same task name

**Cache Storage**: `ops/claude/cache/<cacheKey>.json`

**Cache Hit Behavior**:
- Reads cached decision from previous run
- Returns immediately with 0 Claude calls
- Useful for re-running same task on same repo state

### When Cache Misses

Cache misses occur when:
1. Files have changed since last run (different SHA256)
2. New commit made
3. Different task requested
4. First run (no cache exists)

On cache miss:
- Gathers fresh context (Tier A)
- Makes Claude call (if budget allows)
- Saves result to cache for next run

## Cost Discipline Features

### Budget Enforcement

```powershell
# Hard limit: stop if > N Claude calls spent
-MaxClaudeCalls 0   # Local-only (free)
-MaxClaudeCalls 1   # Single call max (default)
-MaxClaudeCalls 5   # Wasteful (not recommended)
```

### DryRun Mode

```powershell
-DryRun  # Preview context without Claude call
```

Output includes:
- All gathered context
- Cache key computation
- Summary of findings
- **0 Claude calls consumed**

### Rate Limit Detection

When Claude API returns rate limit error ("You've hit your limit"):
1. Detects error string in response
2. **Stops immediately** (no retries)
3. Exits with code 1
4. Prevents credit waste

## Execution Flow Examples

### Example 1: First Run (Cache Miss, Budget Allows)

```
$ .\scripts\ai-run.ps1 -Task "proof-audit"

[TIER A] Gathering context...
  Branch: main, Commit: 8e232f0f, Quality: PASS, Proof:run: PASS, Artifacts: 87

[CACHE] Computing cache key...
  Cache key: proof-audit-40C3CF727E1F
  
[CACHE] MISS - Will compute

[TIER B] Making Claude decision...
  Calling Claude (timeout 45s, max retries 0)...
  [Decision received]
  
[CACHE] Saving result...
  Cache saved: proof-audit-40C3CF727E1F

ClaudeCallsUsed: 1
```

### Example 2: Cache Hit (Identical Repo State)

```
$ .\scripts\ai-run.ps1 -Task "proof-audit"

[TIER A] Gathering context...
  [same as above]

[CACHE] Computing cache key...
  Cache key: proof-audit-40C3CF727E1F
  
[CACHE] HIT - Using cached result
  [Returns cached decision from previous run]

ClaudeCallsUsed: 0
```

### Example 3: DryRun Mode (Preview Only)

```
$ .\scripts\ai-run.ps1 -Task "proof-audit" -DryRun

[TIER A] Gathering context...
  [same as above]

[CACHE] Computing cache key...
  Cache key: proof-audit-40C3CF727E1F
  
[CACHE] MISS - Will compute

[DRY-RUN] Skipping Claude (0 calls)
  [prints context JSON summary]

ClaudeCallsUsed: 0
```

### Example 4: Local-Only Mode (Free Analysis)

```
$ .\scripts\ai-run.ps1 -Task "proof-audit" -MaxClaudeCalls 0

[TIER A] Gathering context...
  [same as above]

[CACHE] Computing cache key...
  Cache key: proof-audit-40C3CF727E1F
  
[CACHE] MISS - Will compute

[BUDGET] MaxClaudeCalls=0 - stopping (local results only)

ClaudeCallsUsed: 0
```

### Example 5: Rate Limit (Automatic Stopping)

```
$ .\scripts\ai-run.ps1 -Task "proof-audit"

[TIER A] Gathering context...
  [same as above]

[TIER B] Making Claude decision...
  Calling Claude...
  [RATE LIMIT] Claude API limit hit - stopping (no retries on rate limit)

ClaudeCallsUsed: 1 (partial)
[FAIL] Claude decision failed
```

## Cost Savings Summary

### Without This System (Wasteful)
```
- Test 1: Run Claude → 1 call (debug)
- Test 2: Run Claude → 1 call (tweak)
- Test 3: Run Claude → 1 call (verify)
- Test 4: Run Claude → 1 call (fix)
= 4+ calls to achieve 1 decision (400% waste)
```

### With This System (Efficient)
```
- DryRun: Preview context → 0 calls
- LocalOnly: `-MaxClaudeCalls 0` → 0 calls
- CacheHit: Rerun same task → 0 calls
- OneCall: Initial execution → 1 call
= 1 call for decision, unlimited free previews
```

**Credit Conservation**:
- Default `-MaxClaudeCalls 1` prevents runaway spending
- Cache prevents recomputation on identical inputs
- DryRun and LocalOnly allow cost-free analysis
- Rate limit detection stops gracefully (no retry spam)

## Task Types

### `proof-audit`
**Purpose**: Verify FPGA proof integrity and quality gates.

**Context Used**:
- Quality check results (linter)
- Proof execution results (mock FPGA simulation)
- Artifact count (proof outputs)

**Sample Claude Question**:
```
Are FPGA proof integrity checks complete and passing? 
Are all quality gates met?
Any risks in changed files?
```

### `ci-gate`
**Purpose**: Validate CI/CD pipeline readiness.

**Context Used**:
- Workflow file changes
- Package versions
- Quality check results

### `phase4-replay-audit`
**Purpose**: Audit Phase 4 replay logs and verify correctness.

**Context Used**:
- Replay script changes
- Artifact logs
- Proof results

## Directory Structure

```
ops/
├── claude/
│   ├── work/
│   │   ├── 20260115-210724/
│   │   │   └── context.json (8-10 KB)
│   │   ├── 20260115-210758/
│   │   │   └── context.json
│   │   └── ...
│   │
│   ├── cache/
│   │   ├── proof-audit-40C3CF727E1F.json
│   │   ├── ci-gate-5B2A1C3D8E9F.json
│   │   └── ...
│   │
│   ├── reports/
│   │   ├── 20260115-210724-proof-audit-decision.txt
│   │   ├── 20260115-210758-ci-gate-decision.txt
│   │   └── ...
│   │
│   └── logs/
│       └── (reserved for future logging)
│
└── proof/
    ├── artifact-index-2026-01-16T02-07-49.txt
    ├── fpga-proof-2026-01-16T02-07-49.json
    ├── fpga-events-2026-01-16T02-07-49.ndjson
    └── ...
```

## Lessons Learned

### Problem: Credit Waste
- **Root Cause**: Testing Claude repeatedly without dry-run or caching
- **Solution**: Tier A (local) + caching + DryRun mode
- **Impact**: 4+ calls reduced to 0-1 per task

### Problem: Hanging on Rate Limits
- **Root Cause**: Retry logic attempting to re-call rate-limited API
- **Solution**: Immediate detection and stop, no retries
- **Impact**: Prevents 30+ second hangs and further credit burn

### Problem: Path Resolution
- **Root Cause**: Relative paths diverged between script contexts
- **Solution**: Use `git rev-parse --show-toplevel` for repo root
- **Impact**: Reliable cross-script file discovery

### Problem: Unsafe Subprocess Escaping
- **Root Cause**: PowerShell wildcard globbing on variables before passing to external exe
- **Solution**: ProcessStartInfo with explicit Arguments property + UTF8 temp file
- **Impact**: Prompts with `?`, quotes, special chars now safe

## Future Enhancements

- [ ] Multi-task execution (`-Tasks "proof-audit", "ci-gate"`)
- [ ] Parallel context gathering (current: sequential)
- [ ] Cache TTL (time-to-live, e.g., invalidate after 24h)
- [ ] Webhook integration (GitHub Actions, Azure Pipelines)
- [ ] Metrics dashboard (calls per day, cache hit rate, cost trend)
- [ ] Decision history (track all decisions made)
- [ ] A/B testing mode (compare decisions with different prompts)

## Troubleshooting

### Issue: "Could not find a part of the path"
**Solution**: Ensure scripts are run from repo root:
```powershell
cd C:\lab\redbyte-ui
.\scripts\ai-run.ps1 -Task "proof-audit"
```

### Issue: "You've hit your limit"
**Solution**: Wait for rate limit reset (typically 1 hour), then retry:
```powershell
Start-Sleep -Seconds 3600  # Wait 1 hour
.\scripts\ai-run.ps1 -Task "proof-audit"
```

### Issue: Cache not being used
**Solution**: Verify cache file exists and repo state is unchanged:
```powershell
# Check cache files
Get-ChildItem ops/claude/cache/

# Verify no new commits
git log -1 --oneline

# Verify no uncommitted changes
git status
```

### Issue: DryRun doesn't show context
**Solution**: Ensure `-DryRun` is passed:
```powershell
.\scripts\ai-run.ps1 -Task "proof-audit" -DryRun  # Correct
.\scripts\ai-run.ps1 -Task "proof-audit"          # Will attempt Claude
```

## Support

For issues or questions, check:
1. This document (COST_DISCIPLINE_SYSTEM.md)
2. Script comments (scripts/ai-run.ps1, context_pack.ps1, claude_decide.ps1)
3. Logs in ops/claude/work/<runId>/context.json
4. Reports in ops/claude/reports/<runId>-<task>-decision.txt
