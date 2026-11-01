> ⚠️ **SUPERSEDED — OS ERA.** This document describes an old workflow: COM port connection, `.rb-lab.zip` export, `StudentLabApp`, Blackboard submission. The current student workflow is Project → Design → Simulate → Board & Constraints → Build & Export (Vivado ZIP). See `docs/ide/` surface specs and `docs/course/STUDENT_QUICKSTART.md` for current stage guidance.

# Student Workflow (Basys 3)

**Status:** SUPERSEDED — see note above

This is the short, copy-paste-ready flow for students.

## 1) Install (one command)

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
iwr -useb https://raw.githubusercontent.com/<ORG>/<REPO>/main/scripts/bootstrap.ps1 | iex
```

## 2) Run RedByte locally

```powershell
pnpm dev
```

Open the URL printed in the terminal.

## 3) Connect Basys 3

1. Plug in the Basys 3 USB cable.
2. Open the Lab Workbench (StudentLabApp) Hardware tab.
3. Select the COM port from the dropdown and click **Connect**.
4. Confirm telemetry:
   - Packets/sec updates
   - Last update age stays under 1000 ms

## 4) Program the board

1. Ensure you have a `.bit` file for your design.
2. In the Hardware tab, enter the `.bit` path.
3. Click **Program Board** and wait for success.

## 5) Export your submission

1. Complete the lab steps and run self-check.
2. Export the v2 bundle (`.rb-lab.zip`).

## 6) Upload to Blackboard

Upload the `.rb-lab.zip` file to Blackboard as your submission.

## Instructor review (quick flow)

1. Open Submission Inspector and import the `.rb-lab.zip`.
2. Confirm signature status and bundle health.
3. Review checks + replay as needed.
4. Use **Export Grading Report** to download the JSON report.
