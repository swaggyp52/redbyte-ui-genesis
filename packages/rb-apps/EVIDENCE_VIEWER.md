# Evidence Viewer (Track 5.2)

## How to Open Evidence

- Click the **“Open Lab Evidence…”** button in the top toolbar.
- Select a previously exported `lab-evidence-*.json` file.
- The viewer will display the evidence snapshot in a read-only mode.

## What “UNVERIFIED” Means

- If the evidence file’s integrity hash does not match, or is missing, the viewer will show **UNVERIFIED** or **FAIL**.
- You can still view the file, but grading should not be trusted unless status is **Verified**.

## What’s Shown

- Circuit snapshot (read-only)
- Probe list
- Oscilloscope snapshot/trace stats
- Context and simulation info
- Integrity verification result (PASS/FAIL/UNVERIFIED)

> [!TIP]
> **Instructor/TA Tip:** Always check for the **PASS** badge before grading. If it says **FAIL** or **UNVERIFIED**, the evidence file may have been tampered with or corrupted.

## What’s Not Supported

- Editing, running, or saving the evidence
- Grading automation, scoring, or rubric logic
- Upgrading or mutating the evidence file
- Fetching remote assets or re-running simulation

---

For schema details, see `evidenceSchema.ts`.
