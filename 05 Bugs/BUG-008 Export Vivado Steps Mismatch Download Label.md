---
type: bug
status: closed
area: export
priority: high
updated: 2026-03-26
related:
  - "[[Export Contracts]]"
---

# BUG-008 Export "Next in Vivado" Steps Mismatch Download Button Label

## Symptom

The primary download button is labelled "Download Vivado Project (Open Project)", implying the student should use Vivado's File → Open Project dialog to open the `.xpr`.

But the 3-step "Next in Vivado" checklist visible below instructs:
> "Run `vivado_import.tcl` from the extracted project folder."

This is the TCL batch workflow, not the Open Project workflow. The correct Open Project steps are hidden in a collapsed `<details>Advanced / full checklist</details>`.

## Root cause

`ExportSurface.tsx:1803-1807` — visible primary checklist uses the TCL-script path.
`ExportSurface.tsx:1836-1845` — Open Project path is in the collapsed advanced section.

The layout reverses the priority: the primary user path (Open Project → select .xpr) is in the collapsed section; the batch TCL path is the visible default.

## Fix

Swap the content priority: make "Open Project → select .xpr" the visible 3-step path; move the TCL batch command to the collapsed advanced section.

No state or pipeline changes required — pure copy/layout.
