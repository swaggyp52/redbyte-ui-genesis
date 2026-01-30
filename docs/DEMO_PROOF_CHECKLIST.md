# Classroom Demo Proof Checklist (End-to-End)

**Goal:** Verify the complete student assignment lifecycle in < 2 minutes.

## 1. Environment Setup

- [ ] Clean state (incognito window or clear storage).
- [ ] Launch: `pnpm preview:playground` (or your chosen script).
- [ ] Open **ECE Lab**.

## 2. Student Action (The Assignment)

1. **Interactive Start**: Observe "Empty Circuit" overlay.
2. **Action**: Click **LOAD STARTER CIRCUIT**.
   - *Verify:* Switch and LED appear.
3. **Simulation**:
   - Toggle Switch (Click).
   - *Verify:* LED turns ON.
   - *Verify:* "SIMULATION" badge is green.
4. **Recording**:
   - Click **REC** (Top Right).
   - Toggle Switch OFF then ON.
   - Click **STOP**.
5. **Export**:
   - Click **EXPORT EVIDENCE**.
   - *Verify:* Browser downloads `.rb-lab.zip`.

## 3. Instructor Action (The Grading)

1. Switch mode to **INSPECT** (or reload and open Submission Inspector).
2. **Drag & Drop**: Drag the downloaded `.rb-lab.zip` onto the Inspector.
3. **Verification**:
   - *Verify:* "Snapshot" shows the Switch and LED.
   - *Verify:* "Trace Data" is present (clean hash).
   - *Verify:* "Manifest" shows correct Timestamp and Agent ("RedByte ECELab").

## 4. Troubleshooting

- **Red Screen?** Check `studentErrors.ts` or console.
- **No Zip?** Check `JSZip` import.
- **Empty Inspector?** Check `read_capsule` logic.

**Pass Criteria:** Zero friction, zero console errors, valid zip.
