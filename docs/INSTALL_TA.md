# TA / Instructor Installation Guide

## 1. System Setup (Windows)

Use the standard automated installer:

1. Clone repo: `git clone https://github.com/redbyte-org/redbyte-ui-genesis.git`
2. Run: `.\Start-RedByte.ps1`

## 2. Setting Up the Hardware Bridge

For Lab 1 and beyond, you need the Bridge Agent running.

1. Run `.\Start-RedByte.ps1`
2. Press `y` when asked to start the Bridge.
3. Alternatively, open a new PowerShell terminal and run: `pnpm bridge:dev`

## 3. Verifying Student Work (Capsule Grading)

RedByte uses **Evidence Capsules** (`.rb-lab.zip`) for grading. You do not need the student's laptop.

1. Ask student to submit their `.rb-lab.zip` file.
2. Open **Submission Inspector** app in your RedByte OS.
3. Drag and drop the `.rb-lab.zip` file into the target area.
4. **Verify:**
    * **Screenshot:** Check circuit topology match.
    * **Vectors:** Check "Pass/Fail" status on test vectors.
    * **Trace:** Click "Replay" to watch their exact simulation trace (deterministic).
    * **Hardware:** If applicable, check "Hardware Verified" stamp (SHA match).

## 4. Troubleshooting

* **Bridge "Offline":** Ensure `rb-bridge-agent` terminal is open and showing "Waiting for client...".
* **Port Busy:** Ensure no other app (Arduino IDE, Cura) is using the COM port.
* **"Dist not found":** Run `pnpm build:os` manually.
