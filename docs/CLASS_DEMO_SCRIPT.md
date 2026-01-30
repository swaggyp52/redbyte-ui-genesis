# Golden Demo Script: Day 1 Lab Launch

**Duration**: 10–12 Minutes
**Goal**: Show students *exactly* what to do, proving it works.

## Intro (Minutes 0-2)

**Say:** "Welcome to ECE 101. For our labs, we're using RedByte OS. It's a professional-grade environment that runs right in your browser, but connects to real hardware."

1. **Navigate to:** `/students` (The canonical page)
2. **Point out:** "Browser Mode" vs "Local Desktop".
3. **Say:** "For today, you can run in the browser to learn the interface. For Lab 1, you'll need the Local Desktop version to talk to the FPGA."
4. **Action:** Click "Start Lab 0".

## The Walkthrough (Minutes 2-5)

**Say:** "This is Lab 0. It's a system check. We're going to build a simple AND gate."

1. **Action:** App launches. "Start Here" window appears.
2. **Action:** Click "Lab Assignment".
3. **Visual Check:** ECE Lab opens. Lab Template "Intro to Digital Logic" loads.
4. **Say:** "On the left, you have your instructions. On the right, your breadboard."
5. **Action:**
   - Drag 2 Switches.
   - Drag 1 AND Gate.
   - Drag 1 LED.
   - Press `W` (Wire Mode), connect them.

## Verification & Sim (Minutes 5-7)

**Say:** "Now, let's prove it works before we build it physically."

1. **Action:** Press `Space` (Start Sim).
2. **Action:** Toggle SW1 (LED off). Toggle SW2 (LED off). Toggle BOTH (LED ON).
3. **Say:** "The simulation is running. This proves our logic is correct."
4. **Bailout:** If Sim doesn't start, check if "Step" mode is paused. Press `Space` again.

## The "Magic" (Minutes 7-9) [HARDWARE OPTIONAL]

*If hardware is connected:*
**Say:** "Now watch this. I'm connecting to the Basys 3."

1. **Action:** Click "Hardware" Tab.
2. **Action:** Click "Connect".
3. **Visual Check:** Toast "Connected to COMx".
4. **Say:** "I am now controlling the physical board from this browser window."
5. **Action:** Toggle physical switches. Watch virtual LED match physical LED.

*If hardware fails:*
**Say:** "Normally we'd connect hardware here. Since I don't have a board hooked up right now, we'll trust our simulation."

## Evidence & Export (Minutes 9-11)

**Say:** "You need to prove you did this to get credit. We don't do screenshots."

1. **Action:** Click "Export Evidence" (Top Right).
2. **Action:** Save file: `Angiel_Lab0.rb-lab.zip`.
3. **Say:** "This file contains your circuit, your simulation logs, and a cryptographic signature verifying it's real."

## Grading (Minute 12)

1. **Action:** Open `Submission Inspector` from Launcher.
2. **Action:** Drag and drop `Angiel_Lab0.rb-lab.zip` into it.
3. **Visual Check:** Big green "PASS" badge.
4. **Say:** "This is what the TAs see. Green means go. Upload this zip file to Canvas, and you're done."

## Q&A Rehearsal

**Student:** "Does it work on Mac?"
**You:** "Browser mode works on Mac for design. Hardware connection requires a small helper app, similar to Windows."

**Student:** "I can't download the installer."
**You:** "Use the Browser Mode for Lab 0. We'll sort out installs in office hours."
