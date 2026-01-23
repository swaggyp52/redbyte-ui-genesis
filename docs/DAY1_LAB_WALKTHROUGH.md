# Day 1 Lab Walkthrough

 **Goal:** Verify the complete student flow from "Zero to Submitted" in < 5 minutes.

## 1. Environment Setup

* [ ] Open `http://localhost:3000/?mode=beginner&example=xor`
* [ ] Confirm:
  * Top bar shows **Project: xor** (or similar).
  * "Day 1" beginner toolset is visible (no advanced menus).
  * **Export Lab Evidence** button is present in the top toolbar.

## 2. Student Actions (The "Happy Path")

* [ ] **Build:**
  * Drag 2 Switches and 1 AND gate.
  * Connect Switch A -> AND Input 1.
  * Connect Switch B -> AND Input 2.
  * Connect AND Output -> Lamp (if present) or just hover output pin.
* [ ] **Verify:**
  * Press **Run** (Green play button).
  * Toggle switches:
    * 0 + 0 = 0
    * 0 + 1 = 0
    * 1 + 0 = 0
    * 1 + 1 = 1 (Output High)
  * *Check:* Green wires indicate High signal.
* [ ] **Export:**
  * Click **Export Lab Evidence**.
  * Save file as `lab01-test.json`.
  * *Verify:* Download happens immediately.

## 3. Instructor Actions (Grading)

* [ ] **Open Viewer:**
  * Refresh page (or new tab).
  * Click **Start Here** -> **Open Submission Inspector** OR **Open Lab Evidence** button.
* [ ] **Load Evidence:**
  * Import `lab01-test.json`.
* [ ] **Verify Integrity:**
  * [ ] Look for **PASS** badge (Green).
  * [ ] Confirm Timestamp is recent.
  * [ ] Confirm App Version matches.
* [ ] **Grade:**
  * Review circuit snapshot.
  * Confirm logic is correct (2 switches feeding AND gate).

## 4. Troubleshooting

* If badge says **UNVERIFIED**:
  * Did you modify the JSON?
  * Is the hashing algorithm consistent?
* If circuit is empty:
  * Did you save/export *before* building?

## Conclusion

If all steps pass, the Day 1 Lab is ready for deployment.
