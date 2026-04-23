# Student UX Layer

This document defines which content is student-facing vs. diagnostic-only in the RedByte IDE,
and the content rules that govern each surface.

---

## Two Contexts

### Student Context (IdeApp)
Students use the IDE directly for lab assignments. They have zero understanding of (and zero
interest in) manifest hashes, bundle IDs, capsule state, pipeline stages, or CI gate results.
Their mental model is: **build → verify → export to Vivado**.

All surfaces in `IdeApp` are always-on simplified view. No flags, no URL params, no CSS toggling.

### Instructor Context (SubmissionInspectorApp)
Instructors use the Submission Inspector to grade student exports. They need full diagnostic
detail: hash verification, gate verdicts, manifest inspection, tamper detection results.
This context retains all diagnostic views without restriction.

---

## Surface-by-Surface Rules

### ProjectSurface (`mode: 'project'`)

**Student sees:**
- Lab name and assignment number (prominent, top of page)
- Student name input field (prominent, not buried in a column)
- Submission preview: last verify status, pass/fail counts, gate verdict
- "Export Submission" — primary CTA button

**Student does NOT see by default:**
- Manifest hash or bundle ID
- "Gate verdict: PASS/FAIL" in internal CI language (show as human-readable: "Ready to submit" / "Needs work")
- Device ID (shown only if student name is empty, as a warning)

**Advanced accordion (collapsed by default):**
- Bundle hash, manifest hash, submission ID
- Raw gate verdict string

---

### DesignSurface (`mode: 'design'`)

**Student sees:**
- Circuit canvas with drag-and-drop primitives
- Diagnostic callout when routed from a failing verify result ("Gate X failed — check its inputs")
- Project health indicator (basic: "Circuit OK" / "Issues found")

**Student does NOT see:**
- Internal node IDs
- Raw circuit JSON
- Simulation tick counts

---

### VerifySurface (`mode: 'verify'`)

**Student sees:**
- Pass/Fail verdict (large, clear)
- Truth table with ✓/✗ per row
- Failing row highlighted
- "Jump to failing node →" (navigates to DesignSurface with diagnostic route)
- Hint callout on FAIL (7 fact-grounded hints)
- Sequential tick banner when `hasDff` is true

**Student does NOT see:**
- Internal trace IDs
- Raw vector bytes
- "TRACE" state as a primary view (shown only in advanced section)

---

### HardwareSurface (`mode: 'hardware'`)

**Student sees:**
- A short list of relevant project signals grouped as inputs, outputs, clock/reset, or other
- A central clickable Basys3 board visual for assigning the selected signal
- Clear mapping rows in the shape signal → board control → physical package pin
- "Mapping complete" / "Pins missing" status

**Student does NOT see:**
- XDC constraint syntax in the main view
- Internal port validation error codes (show as plain English)
- Raw mapping entry ids, HDL port fields, mapping kind, alias, direction, or comma-separated pin forms as the default mapping path

**Advanced accordion (collapsed by default):**
- Structured mapping data editor for legitimate bus/slice/group repair

---

### ExportSurface (`mode: 'export'`)

**Student sees:**
- Readiness checklist: "Circuit built?", "Simulation passed?", "Pins mapped?" (plain language)
- Precise build state: ready to build, stale / rebuild needed, ready to download, or blocked by a real prerequisite
- "Download Vivado Kit" — large primary CTA
- Generated HDL panel: `top.vhd`, `constraints.xdc`, `testbench.vhd` (always visible when ready)
- Copy-to-clipboard on each generated file
- "Open in Vivado" steps panel (collapsible, shown after download)

**Student does NOT see by default:**
- "Blocked" for merely missing or stale export bundles when the project can be built
- Manifest hash, bundle hash
- "Capsule state: not sealed" language
- "Evidence capsule" terminology
- Artifact checklist internals (file count, byte count per file)

**Advanced accordion (collapsed by default):**
- Manifest hash, bundle hash
- File list with byte counts and SHA values
- "Evidence capsule" details for instructor reference

---

### ImportSurface (`mode: 'import'`)

**Student sees:**
- 3 tabs: "Write HDL" | "Upload ZIP" | "Paste XDC"
- Clear placeholder text per tab
- Inline parsing errors in plain language ("Entity not found — check port names")
- Detected submission callout (when importing a RedByte submission ZIP)

**Student does NOT see by default:**
- "Pipeline Stage: WAITING" or any pipeline stage indicator
- "HDL Parsed: WAITING" diagnostic status
- Raw parse tree or token counts
- Internal error codes (map to plain English in `ERROR_MESSAGE_MATRIX.md`)

---

### SubmissionViewerSurface (used in SubmissionInspectorApp)

**Always visible (instructor context):**
- Gate verdict and grade summary (pass/fail per lab requirement)
- Student name, device ID, submission timestamp
- Hash/integrity verification result

**Also visible in instructor context:**
- Full manifest with file hashes and sizes
- Bundle ID and submission ID
- Tamper detection details

**If embedded in IdeApp (student context):**
- Gate verdict: plain language ("Your work looks ready" / "Submission needs attention")
- Integrity status: "Verified OK" or "Integrity check failed" (no hash values)
- Advanced accordion: same hash data available on expand

---

## Diagnostic Language Ban List

The following terms must not appear in default student-facing views:

| Banned term | Student-appropriate replacement |
|-------------|--------------------------------|
| "Capsule state: not sealed" | (hide entirely) |
| "Evidence capsule" | "Submission package" |
| "Pipeline Stage: WAITING" | (hide entirely) |
| "HDL Parsed: WAITING" | "Ready to import" / "Parsing…" |
| "Manifest hash" | (Advanced accordion only) |
| "Bundle hash" | (Advanced accordion only) |
| "bundleId" | (Advanced accordion only) |
| "Gate verdict: FAIL" | "Submission needs attention" |
| "Gate verdict: PASS" | "Ready to submit" |
| "not sealed" | (hide entirely) |
| "artifact" | "file" |
| "capsule" | "submission" |

---

## Status Pill Budget

Maximum status pills per surface: **3**

Allocation priority:
1. Circuit/project health
2. Verify result
3. Export readiness

Do not show independent pills for: node count, wire count, tick count, hash status, file count.

---

## Advanced Accordion Pattern

When diagnostic data must be preserved but not shown by default:

```tsx
<details>
  <summary>Advanced</summary>
  {/* hash values, integrity data, etc. */}
</details>
```

This data is never deleted from the system. It is available to anyone who opens the accordion.
Instructors using SubmissionInspectorApp see it expanded by default.
