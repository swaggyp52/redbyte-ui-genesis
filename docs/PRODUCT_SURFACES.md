# Product Surfaces & Interaction Contract

**Core Principle:** Single Source of Truth. 2D is the Editor. 3D is the Viewer.

## Surface 1: Logic Playground (2D, Editable)

* **Purpose:** Sandbox learning, experiments.
* **Role:** Editor.
* **Contract:**
  * Allows topology mutation (drag, wire, delete).
  * Source of Truth: `CircuitEngine`.
  * Hardware: Only available if Bridge is reachable.

## Surface 2: ECE Lab (2D, Editable, Guided)

* **Purpose:** Lab workflow, instructions, evidence.
* **Role:** Editor (Canonical).
* **Contract:**
  * Allows topology mutation.
  * Must load starter circuits if empty.
  * Export: `.rb-lab.zip` (Standard Format).

## Surface 3: 3D Lab Viewer (Read-Only)

* **Purpose:** Inspection, visualization, "wow factor".
* **Role:** Viewer.
* **Contract:**
  * **NO EDITS.** Attempts show "Edit in 2D" toast.
  * Syncs with 2D engine state.
  * Selection/Inspection allowed.

## Interconnection

* **Format:** All surfaces use `.rb-lab.zip`.
* **State:** 2D Engine drives the state. 3D View subscribes.
* **Environment:** Web Demo = Sim Only. Local Install = Sim + Hardware.
