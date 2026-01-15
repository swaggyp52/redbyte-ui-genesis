# Night Shift Quick Start

**YOU ARE NOW READY FOR OVERNIGHT AUTONOMOUS EXECUTION.**

All safety checks passed. 4 steps to launch:

---

## Step 1: Choose Your AI Worker (30 seconds)

Pick ONE and rename it to `night_shift_worker.ps1`:

### Option A: Anthropic Claude (Recommended)
```powershell
cd C:\Users\conno\redbyte-ui\scripts
Rename-Item night_shift_worker_anthropic.ps1 night_shift_worker.ps1
```
**Cost**: ~$0.03 per ticket (8K tokens avg)  
**Quality**: Excellent at following constraints  
**Speed**: ~30 seconds per patch  

### Option B: OpenAI GPT-4
```powershell
cd C:\Users\conno\redbyte-ui\scripts
Rename-Item night_shift_worker_openai.ps1 night_shift_worker.ps1
```
**Cost**: ~$0.04 per ticket (8K tokens avg)  
**Quality**: Very good, sometimes adds markdown  
**Speed**: ~20 seconds per patch  

### Option C: Local Ollama (Free)
```powershell
cd C:\Users\conno\redbyte-ui\scripts
Rename-Item night_shift_worker_ollama.ps1 night_shift_worker.ps1
```
**Cost**: FREE (runs on your GPU/CPU)  
**Quality**: Good for simple tickets  
**Speed**: ~2 minutes per patch (depends on hardware)  
**Requires**: `ollama serve` running + `ollama pull deepseek-coder:6.7b`

---

## Step 2: Set API Key (1 minute)

### If you chose Anthropic:
```powershell
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "sk-ant-api03-YOUR_KEY_HERE", "User")
```

### If you chose OpenAI:
```powershell
[System.Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "sk-YOUR_KEY_HERE", "User")
```

### If you chose Ollama:
```powershell
# Start Ollama server (keep running)
ollama serve

# In another terminal, pull model (one-time, ~4GB download)
ollama pull deepseek-coder:6.7b
```

**Verify** (close and reopen PowerShell):
```powershell
$env:ANTHROPIC_API_KEY  # Should print your key
# OR
$env:OPENAI_API_KEY
```

---

## Step 3: Dry Run Test (2 minutes)

**CRITICAL**: Test manually BEFORE scheduling overnight.

```powershell
cd C:\Users\conno\redbyte-ui
git status  # MUST be clean (no uncommitted changes)

# If dirty, stash first:
git stash

# Run Night Shift manually
.\scripts\night_shift.ps1
```

**What to expect**:
1. Sees "PHASE 2a" ticket is IN_PROGRESS (skips it)
2. Picks "PHASE 2b: LabApp Component" (first READY ticket)
3. Creates branch `feat/nightshift/phase-2b-labapp-component`
4. Invokes worker → generates patch
5. Applies patch
6. Runs `pnpm test --run` (saves to `ops/proof/`)
7. Runs `pnpm -r build` (saves to `ops/proof/`)
8. Runs Playwright smoke test (saves to `ops/proof/`)
9. Commits changes
10. Pushes branch
11. Opens PR via `gh pr create`
12. Updates queue status to PR_OPEN
13. Logs everything to `ops/NIGHT_SHIFT_LOG.md`

**If it succeeds**:
- ✅ You'll see a new PR on GitHub
- ✅ Proof files in `ops/proof/phase-2b-*`
- ✅ Log entry in `ops/NIGHT_SHIFT_LOG.md`

**If it fails**:
- ❌ Runner stops immediately (no cascading failures)
- ❌ Logs reason to `ops/NIGHT_SHIFT_LOG.md`
- ❌ Leaves branch for manual review

**Check the PR**: Ensure tests passed, build succeeded, changes look sane.

---

## Step 4: Schedule for Overnight (5 minutes)

### Option A: Windows Task Scheduler GUI

1. Press `Win+R`, type `taskschd.msc`, press Enter
2. Click "Create Task" (right panel)
3. **General** tab:
   - Name: `RedByte Night Shift`
   - Description: `Autonomous agent runs for RedByte OS`
   - Run whether user is logged on or not: ✅ CHECK THIS
   - Run with highest privileges: ❌ LEAVE UNCHECKED
   - Configure for: Windows 10/11

4. **Triggers** tab:
   - New → Daily
   - Start: Today at 2:00 AM
   - Recur every: 1 day
   - Stop task if it runs longer than: 6 hours ✅ CHECK THIS

5. **Actions** tab:
   - New → Start a program
   - Program: `powershell.exe`
   - Arguments: `-NoProfile -ExecutionPolicy Bypass -File "C:\Users\conno\redbyte-ui\scripts\night_shift.ps1"`
   - Start in: `C:\Users\conno\redbyte-ui`

6. **Settings** tab:
   - Allow task to be run on demand: ✅ CHECK
   - Stop task if it runs longer than: 6 hours ✅ CHECK
   - If task fails, restart every: 1 hour (max 3 attempts)

7. Click OK → Enter your Windows password if prompted

### Option B: PowerShell Command (Advanced)

```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"C:\Users\conno\redbyte-ui\scripts\night_shift.ps1`"" `
  -WorkingDirectory "C:\Users\conno\redbyte-ui"

$trigger = New-ScheduledTaskTrigger -Daily -At 2am

$settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan -Hours 6) `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Hours 1)

Register-ScheduledTask -TaskName "RedByte Night Shift" `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -User $env:USERNAME `
  -RunLevel Limited
```

---

## Verify Scheduling Worked

```powershell
# List all scheduled tasks with "Night Shift"
Get-ScheduledTask | Where-Object { $_.TaskName -like "*Night Shift*" }
```

**Expected output**:
```
TaskPath  TaskName             State
--------  --------             -----
\         RedByte Night Shift  Ready
```

---

## What Happens Overnight

**2:00 AM** (every night):
1. Task Scheduler wakes up
2. Runs `scripts/night_shift.ps1` in background
3. Runner picks up to 2 READY tickets from `ops/NIGHT_SHIFT_QUEUE.md`
4. For each ticket:
   - Creates feature branch
   - Generates code (via AI worker)
   - Runs tests + build + smoke test
   - Opens PR if all green
   - Stops if anything fails
5. Writes full log to `ops/NIGHT_SHIFT_LOG.md`
6. Exits

**Morning** (when you wake up):
1. Check GitHub for new PRs tagged "Night Shift"
2. Review changes + proof links
3. Merge if good, close if bad
4. Repeat tomorrow night

---

## Monitoring

### Check Last Run
```powershell
# View Night Shift log
Get-Content ops/NIGHT_SHIFT_LOG.md -Tail 50

# View proof files from last run
Get-ChildItem ops/proof/ -File | Sort-Object LastWriteTime -Descending | Select-Object -First 10
```

### Check Queue Status
```powershell
# See what's next
Get-Content ops/NIGHT_SHIFT_QUEUE.md | Select-String -Pattern "Status.*READY" -Context 2
```

### Manually Trigger (for testing)
```powershell
# Run on demand (Task Scheduler GUI)
# Right-click "RedByte Night Shift" → Run

# OR via PowerShell
Start-ScheduledTask -TaskName "RedByte Night Shift"
```

---

## Safety Rails Recap

✅ **Never touches main directly** (branch + PR only)  
✅ **Stops on first failure** (no cascading damage)  
✅ **Logs everything** (ops/NIGHT_SHIFT_LOG.md + proof files)  
✅ **Max 2 tickets per night** (prevents runaway execution)  
✅ **Headless UI tests** (catches regressions without desktop session)  
✅ **Secrets in env vars** (never committed to repo)  
✅ **Patch-based changes** (deterministic, reviewable, revertible)  

**You can sleep. The system won't break your repo.**

---

## Troubleshooting

### "Worker failed: ANTHROPIC_API_KEY not set"
- Env var not persisted. Set again with `[System.Environment]::SetEnvironmentVariable(...)` and restart PowerShell.

### "Missing required command: gh"
- Install GitHub CLI: `winget install --id GitHub.cli`

### "Repo is dirty. Commit/stash changes"
- Uncommitted changes exist. Run `git status` and commit or stash them.

### "Playwright not found"
- Install browsers: `pnpm exec playwright install chromium`

### "FAIL: Tests indicate failure"
- Check `ops/proof/<slug>-tests.txt` for details
- Review branch manually: `git checkout feat/nightshift/<slug>`
- Fix + push, or close branch and update ticket

### Task runs but no PRs appear
- Check `ops/NIGHT_SHIFT_LOG.md` for errors
- Verify GitHub CLI auth: `gh auth status`
- Manually run `.\scripts\night_shift.ps1` to see live output

---

## Maintenance

### Add New Tickets
Edit `ops/NIGHT_SHIFT_QUEUE.md`:
```markdown
## [P0] [READY] Your New Feature
**Status**: READY
**Goal**: Brief description
**Files**: List of files to create/edit
**Acceptance**: 3-10 bullet points
**Constraints**: Keep it minimal
```

### Pause Night Shift
```powershell
Disable-ScheduledTask -TaskName "RedByte Night Shift"
```

### Resume Night Shift
```powershell
Enable-ScheduledTask -TaskName "RedByte Night Shift"
```

### Change Schedule (e.g., run at 3 AM instead)
```powershell
$trigger = New-ScheduledTaskTrigger -Daily -At 3am
Set-ScheduledTask -TaskName "RedByte Night Shift" -Trigger $trigger
```

---

**Last Updated**: 2026-01-14 23:20 UTC  
**Status**: ✅ PRODUCTION READY  
**Next Steps**: Execute Step 1-4 above, then go to bed 😴
