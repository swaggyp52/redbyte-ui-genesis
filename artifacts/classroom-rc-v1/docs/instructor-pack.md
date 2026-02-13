# Instructor Pack Workflow (Classroom Deployment v1)

Instructor Packs provide a portable lab distribution artifact for classroom use.

## What an Instructor Pack contains

Each `instructor-pack-<labId>-<contentHash>.zip` includes:

- `pack_manifest.json`
- `starter_project.rbx.zip`
- `labStarterKit.json`
- `README.txt`
- `rubric.json` (optional)

`pack_manifest.json` stores per-file SHA-256 hashes and a deterministic `contentHash`.

## Exporting an Instructor Pack

1. Open **Home** in TA mode (`rb:mode=ta`).
2. In **Lab Starters**, click **Export Pack** for the target starter.
3. RedByte creates a deterministic pack and downloads it.

## Importing an Instructor Pack

Students (or instructors) can import via **Home**:

- Click **Import Instructor Pack**, or
- Drag and drop the ZIP onto the **Lab Starters** section.

On success, the starter appears under **Imported by Instructor** with:

- **Open + Start Lab**
- **View Instructions**

Opening an imported starter uses canonical project hydration from `starter_project.rbx.zip`.

## Integrity validation behavior

During import, RedByte validates:

- pack schema signature (`pack_manifest.json`)
- manifest schema version
- SHA-256 for each declared entry
- manifest `contentHash`

If validation fails, import is rejected with a user-facing error.

## Submission bundle gate envelope (PR3)

Submission bundles now include `submission-gates.json` with schema `rb_submission_gates_v1`.

Envelope fields:

- `schema_version`: `rb_submission_gates_v1`
- `labId`: active lab identifier for submission context
- `timestamp`: deterministic snapshot timestamp (derived from project `updatedAt` / `createdAt`)
- `context`: minimal submission context (`projectId`, `projectName`)
- `result`: lab gate verdict payload (`pass|warn|block`) and issue list

Inspector compatibility:

- Submission Inspector accepts both legacy gate payloads (`SubmissionGateResult`) and the v1 envelope above.

## Classroom Lockdown

TA mode in **Toolchain Setup** includes **Classroom Lockdown** toggle.

When Lockdown is enabled:

- Student mode is forced by default.
- Advanced TA/toolchain/grader surfaces are hidden.
- Toolchain Setup shows minimal readiness view.

TA escape hatch:

- URL: `?ta=1`, or
- localStorage `rb:mode:v1 = "ta"`

This allows instructors/TAs to access grading and diagnostics during class.
