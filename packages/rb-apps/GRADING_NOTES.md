# Grading Notes Panel (Track 5.3)

## How to Use

- In the Evidence Viewer, fill in the **Score** (number), **Pass** (checkbox), **Notes** (freeform), and **TA Initials** fields as needed.
- **TA Initials** are required if any grading field is filled.
- Click **Export Grading Notes** to download a `grading.json` file bound to the evidence hash.
- Use **Clear** to reset grading fields.

## What’s Exported

- Evidence file hash (binds grading to evidence)
- Timestamp
- Score (optional)
- Pass/Fail (optional)
- Notes (optional)
- TA initials (required if grading fields are set)

## Association

- The exported grading file is separate from the evidence JSON.
- The hash ensures grading is attached to the correct evidence.

---

For schema details, see `gradingExport.ts`.
