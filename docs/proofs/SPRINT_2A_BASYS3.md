# Sprint 2A Proof: Basys3 Board View

**Date:** 2026-01-31
**Status:** Ready for Verification

This document defines the manual verification steps required to certify Sprint 2A. The following tests must be performed manually to ensure the "Premium Instrument" feel.

## 1. Loop Proof (Latency & Synchronization)

Goal: Verify instantaneous feedback between Virtual IO and Simulation.

**Steps:**

1. Open **Logic Playground**.
2. Create a simple circuit:
   - Add **SWITCH** component.
   - Add **LED** component.
   - Connect **SWITCH** output to **LED** input.
   - Label the Node between them "MY_NET".
3. Switch to **Deploy** tab.
4. In the Mapping Panel:
   - Map **MY_NET** (Circuit Input) <- **SW0**.
   - Map **MY_NET** (Circuit Output) -> **LD0**.
5. Physically click **SW0** on the Basys3 View.

**Pass Criteria:**

- [ ] **LD0** lights up immediately (same frame/tick) when SW0 is ON.
- [ ] **LD0** turns off immediately when SW0 is OFF.
- [ ] Rapid toggling (10x fast) shows no lag or desynchronization.

## 2. Capsule Proof (Integrity & Persistence)

Goal: Verify that Board Mapping is part of the rigorous Lab Project Capsule.

**Steps:**

1. With the setup from Proof 1 active.
2. Click **File -> Export Project**. Save `proof_test.rblab`.
3. Open the `.rblab` file (rename to .zip if needed) and inspect `project.json`.
4. **Action:** Locate `"boardMap"` section.
   - Verify `"signalToPinMap"` contains `{"MY_NET": "SW0"}` and `{"MY_NET": "LD0"}`.
5. **Action:** Modify the JSON manually (e.g. change "LD0" to "LD1") inside the zip.
6. **Action:** Import the modified capsule back into RedByte.

**Pass Criteria:**

- [ ] Import triggers an **Integrity Warning** (modified signature).
- [ ] Details show the file was tampered with.

## 3. Restoration Proof

Goal: Verify valid projects restore the board state perfectly.

**Steps:**

1. Import the original (unmodified) `proof_test.rblab`.
2. Go to **Deploy** tab.

**Pass Criteria:**

- [ ] Mappings are pre-filled (SW0, LD0).
- [ ] If SW0 was saved as ON, LD0 should be ON immediately (simulation ticked on load).

## 4. Unknown-State Proof

Goal: Verify the "Instrument" handles undefined states gracefully.

**Steps:**

1. In Design Mode, delete the connection between SWITCH and LED.
   - Now the LED component input is floating (Unknown/Hi-Z).
   - "MY_NET" node might still exist but have no driver.
2. Go to **Deploy** tab.
3. Observe **LD0** (mapped to MY_NET).
4. Click **LD0** to open Inspector.

**Pass Criteria:**

- [ ] **LD0** visual state is distinct (dim/amber/off) - not falsely "LOW".
- [ ] Inspector shows logic state as **UNKNOWN** (Amber color with '?').
- [ ] Inspector tooltip explains "Signal path unresolved".

---
**Sign-off:**
[ ] Verified by User
