# Sprint 2B: Arduino Instrument - Verification Proof

**Date:** 2026-01-31
**Sprint:** 2B (Arduino Integration)
**Status:** Ready for Review

## Objective

Verify the functionality, persistence, and robustness of the new Arduino Instrument panel and its integration with the RedByte Deploy Mode.

## Pre-Requisites

1. RedByte UI running (`pnpm dev`).
2. Project with at least one output (LED/Probe) and one input (Switch/Clock).

## Proof 1: Arduino Mapping & Plotting

**Goal:** Verify live plotting and signal mapping accuracy.

1. **Open Deploy Tab**: Select **Arduino Uno (MCU)** from the target dropdown.
2. **Map Output**:
    - Locate **A0 (Analog Input)** in the left panel.
    - Map it to a circuit output signal (e.g., `counter.q0` or `led1`).
    - **Step:** Click the pin ID `A0` to enable plotting (green line appears).
3. **Simulate Change**:
    - Return to Circuit or use a mapped switch to toggle the signal.
    - **Verify:** The strip chart updates in real-time.
    - **Verify:** The numeric value display updates.
4. **Performance Check**:
    - Allow plot to run for >30 seconds.
    - **Verify:** No UI lag or stuttering.

## Proof 2: Pin Controls (Input Drive)

**Goal:** Verify Arduino pins can drive circuit inputs.

1. **Map Input**:
    - Locate **D3 (Digital PWM)**.
    - Map it to a circuit input (e.g., `switch0`).
2. **Toggle Control**:
    - Click the **HIGH/LOW** button for D3.
    - **Verify:** The mapped circuit signal changes state (check main circuit view or attached LED).
3. **PWM Control**:
    - Toggle **PWM** mode for D3.
    - Move slider.
    - **Verify:** (Note: In v1, this sets boolean state based on threshold, or passes float if circuit supports analog). For v1, verify slider interaction updates value.

## Proof 3: Snapshot Persistence & Multi-Board State

**Goal:** Verify data integrity across board switches and session reload.

1. **Setup Basys3**:
    - Select **Basys3**.
    - Map `SW0` -> `clk`.
    - Set `SW0` to ON.
2. **Setup Arduino**:
    - Select **Arduino**.
    - Map `A0` -> `counter.q0`.
    - Click **Capture Snapshot**.
3. **Switch Back**:
    - Select **Basys3**.
    - **Verify:** `SW0` mapping and state are preserved.
4. **Reload**:
    - Refresh the browser.
    - Select **Arduino**.
    - **Verify:** `A0` is still mapped.
    - **Verify:** Snapshot log contains the captured snapshot.

## Proof 4: Export/Import Integrity

**Goal:** Verify state survives full project serialization.

1. **Export**:
    - Click **Export Capsule** (or equivalent project save).
2. **Clear**:
    - Create New Project.
3. **Import**:
    - Import the exported capsule.
4. **Verify**:
    - Check **Arduino** view: Mappings and Snapshots exist.
    - Check **Basys3** view: Mappings exist.

## Notes

- Live plotting history is ephemeral and clears on reload (by design for v1 stability).
- Snapshots are persistent.
