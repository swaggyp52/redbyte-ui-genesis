# LAB_SPECS.md

## Lab Specifications in RedByte

Lab specifications ("lab specs") define what a given lab assignment expects from student evidence. They provide **guidance for instructors and graders**—not automation or enforcement.

---

## Philosophy: Guidance, Not Automation

- **Lab specs are for human graders.**
- They highlight missing or incomplete evidence, but never block grading or export.
- No auto-grading, no rubric logic, no LMS integration.
- Evidence remains the source of truth; lab specs are optional overlays.

---

## Lab Spec Schema (v1)

A minimal, extensible JSON format. Only `labId` is required; all other fields are optional.

```json
{
  "labId": "lab1-dff",            // required, unique identifier
  "title": "D Flip-Flop Timing",  // optional, human-readable
  "requiredExampleId": "11_d-flipflop", // optional, match against evidence
  "requirements": {
    "probes": ["clk", "Q"],      // optional, required probe names
    "minTicks": 20                // optional, minimum tick/sample count
  },
  "notes": "Students should demonstrate clocked storage behavior." // optional
}
```

### Field Reference
- `labId` (string, required): Unique identifier for the lab.
- `title` (string, optional): Human-readable title.
- `requiredExampleId` (string, optional): Example/circuit ID to match.
- `requirements` (object, optional):
  - `probes` (string[], optional): List of required probe names.
  - `minTicks` (number, optional): Minimum number of ticks/samples.
- `notes` (string, optional): Freeform notes for graders.

---

## What Is Validated

- **Probes:** Each required probe is checked for presence in the evidence.
- **Ticks:** Evidence is checked for minimum tick/sample count.
- **Example ID:** If specified, evidence is checked for matching exampleId.

Validation results are shown as:
- ✅ Met
- ❌ Missing/insufficient
- ⚠️ Not checked (if not specified in spec)

---

## What Is Not Validated

- No signal value checking
- No waveform or logic analysis
- No auto-grading or scoring
- No student-side enforcement
- No simulation re-runs
- No LMS or rubric integration

---

## Example `labspec.json`

```json
{
  "labId": "lab1-dff",
  "title": "D Flip-Flop Timing",
  "requiredExampleId": "11_d-flipflop",
  "requirements": {
    "probes": ["clk", "Q"],
    "minTicks": 20
  },
  "notes": "Students should demonstrate clocked storage behavior."
}
```

---

## Usage Workflow

1. **Instructor/TA loads a `.labspec.json`** in the Evidence Viewer.
2. Validation results appear in the "Lab Requirements" panel.
3. Grading is always possible, regardless of validation status.
4. Lab specs are optional and backward compatible—older evidence loads with no errors.

---

## Versioning
- This is Lab Spec Schema v1. Future versions may add fields, but will remain backward compatible and non-enforcing.
