# RedByte Product Manual — Asset Plan

**Document:** RB-MAN-001 v1.0
**Date:** 2026-03-31
**Purpose:** Catalog of visual assets, diagrams, screenshots, and design elements for the RedByte Product Manual. This plan guides future capture sessions and visual refinement passes.

---

## 1. Cover Page

### Concept
Dark gradient background (slate-900 → deep red) with the RedByte wordmark in white, "Red" accented in brand red (#dc2626). Subtitle in muted uppercase tracking. Clean, minimal, no imagery — lets the brand and typography speak. Professional EDA manual aesthetic.

### Assets Required
- **RedByte wordmark** — SVG or high-resolution PNG of the "RedByte" logotype with red accent on "Red."
- **Cover background** — CSS gradient (implemented in HTML companion). No external image dependency.

### Print Considerations
- Cover uses `print-color-adjust: exact` to ensure gradient and colors render in PDF output.
- Letter size (8.5 × 11 in) with full-bleed cover appearance simulated via zero top margin on first page.

---

## 2. Screenshots to Capture

Each screenshot should be captured at 1440×900 resolution in the dark theme (the canonical RedByte visual identity). Browser chrome should be cropped. Each screenshot should show the surface in a representative, non-empty state.

| ID | Surface / View | State | Caption | Section |
|----|---------------|-------|---------|---------|
| SS-01 | **Design Surface** — Full canvas | 2-switch AND gate circuit with lamp. Palette visible on left, properties panel on right. | "The Design surface with a combinational AND gate circuit." | §7.2, §8 |
| SS-02 | **Design Surface** — Component palette | Palette expanded showing gate categories, search field visible. | "The searchable component palette." | §7.2 |
| SS-03 | **Verify Surface** — PASS state | Truth table with all rows passing. Green PASS banner visible. | "Verification PASS with all truth table rows satisfied." | §7.3, §9 |
| SS-04 | **Verify Surface** — FAIL state | Truth table with highlighted failing rows. Hint callout visible. | "Verification FAIL with failing rows highlighted and diagnostic hints." | §7.3, §9 |
| SS-05 | **Verify Surface** — Testbench Preview | Testbench preview panel showing signal pills (IN blue, OUT green). | "Testbench Preview panel with signal direction and assertion status." | §7.3 |
| SS-06 | **Hardware Surface** — Map Pins tab | Port-to-pin mapping table with dropdowns. Partially mapped. | "Hardware pin mapping with port-to-pin assignment dropdowns." | §7.4, §10 |
| SS-07 | **Hardware Surface** — Mapping complete | All ports assigned. "Mapping complete" status visible. | "Completed pin mapping with all ports assigned to Basys 3 pins." | §7.4 |
| SS-08 | **Export Surface** — READY state | Readiness checklist all green. Download button enabled. HDL preview visible. | "Export surface at READY status with generated HDL preview." | §7.5, §11 |
| SS-09 | **Export Surface** — HDL preview panel | `top.vhd` content visible in preview pane with copy button. | "Generated VHDL preview with copy-to-clipboard." | §7.5 |
| SS-10 | **Import Surface** — Write HDL tab | VHDL pasted in editor. Parsed ports table showing detected ports. | "Import surface with VHDL source and parsed port detection." | §7.6, §12 |
| SS-11 | **Import Surface** — Fidelity callout | Import result showing "Reconstructed" fidelity badge. | "Reconstructed fidelity report after structural VHDL import." | §7.6 |
| SS-12 | **Project Surface** — Starter examples | Example cards visible (Signal Tour, Logic Gates, etc.). | "Starter example selection on the Project surface." | §5, §7.1 |
| SS-13 | **Project Surface** — Submission preview | Student name field, verify status, Export Submission button. | "Submission-ready state with student metadata and gate verdict." | §7.1, §13 |
| SS-14 | **Global Shell** — Left rail navigation | Left rail with all six mode entries. Active marker on Design. | "IDE navigation rail with workflow progress indicators." | §6 |
| SS-15 | **Submission Inspector** — Full diagnostic | Instructor view with hash verification, gate verdict, file manifest. | "Submission Inspector showing full diagnostic detail for grading." | §13 |

---

## 3. Diagrams to Create

### 3.1 Workflow Diagrams

| ID | Diagram | Type | Description | Section |
|----|---------|------|-------------|---------|
| DG-01 | **Canonical Workflow** | Linear flow | Project → Design → Verify → Hardware → Export. Color-coded stages with arrows. | §4.1 |
| DG-02 | **Data Flow: Student Submission** | Vertical flow | Design → Verify (ledger stored) → Map Pins → Export (HDL generation) → Submission (ZIP with integrity). | §4, §14 |
| DG-03 | **Verification Decision Flow** | Decision tree | Circuit has DFF? → Yes: clocked-macro schedule / No: combinational schedule. Shows tick sequences. | §9 |
| DG-04 | **Vivado Handoff Pipeline** | Horizontal pipeline | RedByte Export → ZIP contents → Vivado Create Project → Synthesis → Implementation → Bitstream → Program. | §11 |
| DG-05 | **Import Fidelity Decision** | Decision tree | Source file type → fidelity level determination → what is preserved vs. lost. | §12, Appendix E |

### 3.2 Architecture Diagrams

| ID | Diagram | Type | Description | Section |
|----|---------|------|-------------|---------|
| DG-06 | **Five-Layer Architecture** | Stacked layer diagram | Layer A (Logic Core) through Layer E (UX Shell). Shows dependency direction. | §4.4 |
| DG-07 | **Application Context Map** | Grid/matrix | IdeApp, LogicPlaygroundApp, LabWorkspaceApp, SubmissionInspectorApp — features available in each. | §3 |
| DG-08 | **Simulation Engine Pipeline** | Sequence diagram | Input change → topological sort → node evaluation → signal cache → change detection → (repeat or stable). | §4.2 |

### 3.3 Reference Diagrams

| ID | Diagram | Type | Description | Section |
|----|---------|------|-------------|---------|
| DG-09 | **Basys 3 Board Pin Map** | Annotated board diagram | Top-down view of Basys 3 with labeled switch, LED, button, display, and clock regions. | §10, Appendix B |
| DG-10 | **Vivado Kit ZIP Structure** | File tree diagram | `top.vhd`, `constraints.xdc`, `testbench.vhd` with file descriptions. | §14 |
| DG-11 | **Submission Package Structure** | File tree diagram | `rb-project.json`, `verify-ledger.json`, `manifest.json` with integrity annotations. | §14 |
| DG-12 | **Student vs. Instructor View** | Split comparison | Side-by-side showing what student sees vs. what instructor sees for the same submission. | §13 |

---

## 4. Tables Rendered in Manual

| Table | Location | Content |
|-------|----------|---------|
| Core Capabilities | §2.2 | Seven capabilities with descriptions |
| Design Philosophy | §2.3 | Four principles with meanings |
| Application Contexts | §3 | Four contexts with purpose, submission, diagnostic detail |
| Verification Schedules | §4.3 | Combinational vs. clocked-macro behavior |
| Import Fidelity Levels | §4.5 | Three levels with source, preservation |
| Starter Examples | §5.3 | Five examples with description and circuit type |
| Global Shell Regions | §6.1 | Four regions with location and content |
| Surface Reference Tables | §7.1–7.6 | Purpose, controls, outputs per surface (6 tables) |
| Component Palette Categories | §7.2 | Seven gate categories with component lists |
| Basys 3 Pin Categories | §7.4 | Six pin categories with quantities |
| Generated Files | §11.1 | Three files with type and purpose |
| Common Vivado Errors | §11.3 | Four errors with cause and resolution |
| Troubleshooting Tables | §15.1–15.7 | Seven diagnostic tables (design, verify, export, Vivado, bridge) |
| Logic Primitive Reference | Appendix A | Full gate/flip-flop/IO reference (4 sub-tables) |
| Pin Reference | Appendix B | Switches, LEDs, buttons, display, clock |
| File Specifications | Appendix C | Generated file entity names and properties |
| Import Fidelity Matrix | Appendix D | Five sources × five preservation columns |

---

## 5. Callout Box Styles

Four callout types are used throughout the manual, implemented as styled `<div>` elements in the HTML companion and as blockquote conventions in the markdown source:

| Type | Color | Border | Use Case |
|------|-------|--------|----------|
| **Note** | Blue (#eff6ff) | Blue left border | Supplementary information, clarifications. |
| **Warning** | Amber (#fffbeb) | Amber left border | Important information affecting results. |
| **Caution** | Red (#fef2f2) | Red left border | Actions that may cause data loss or errors. |
| **Tip** | Green (#ecfdf5) | Green left border | Best practices, recommended approaches. |

Each callout includes a bold uppercase label ("NOTE", "WARNING", "CAUTION", "TIP") followed by the body text.

---

## 6. Visual Motifs and Design System

### Typography
- **Headings:** Inter (900/700/600 weights). Scale: 1.8rem (H1), 1.3rem (H2), 1.05rem (H3).
- **Body:** Inter 400, 10.5pt, 1.65 line height.
- **Code:** JetBrains Mono, 0.85em, with subtle background highlight.

### Color Palette
- **Primary accent:** RedByte Red (#dc2626)
- **Text:** Slate 800 (#1e293b)
- **Headings:** Slate 900 (#0f172a)
- **Muted text:** Slate 500 (#64748b)
- **Table headers:** Slate 100 background (#f1f5f9)
- **Code background:** Slate 100 (#f1f5f9) inline, Slate 900 (#0f172a) blocks
- **Status badges:** Emerald (pass), Red (fail), Blue (info), Amber (warning)

### Section Dividers
- H1 sections use a 3px red bottom border as the primary divider.
- H2 sections use a 1px slate-200 bottom border.
- Page breaks precede each H1 section in print layout.

### Numbered Procedures
- Red circular step numbers (26px diameter) with white text.
- Left border line connecting steps visually.
- "Result" boxes in green with emerald left border after significant procedures.

### Status Badges
- Inline pill-shaped badges with semantic colors.
- Used in tables and inline references for PASS/FAIL/INFO/WARN states.

---

## 7. Print and Readability Considerations

### Page Layout
- **Page size:** US Letter (8.5 × 11 in).
- **Margins:** 1 in top/bottom, 0.9 in left/right.
- **Page numbers:** Centered bottom, Inter 9pt, slate-500 color.
- **First page:** No page number (cover).

### Page Breaks
- Each major section (H1) starts on a new page.
- Tables and callout boxes use `page-break-inside: avoid`.
- Code blocks use `page-break-inside: avoid`.
- Headings use `page-break-after: avoid`.

### PDF Generation
The HTML companion is designed for direct "Print to PDF" from Chrome, Edge, or Firefox. Recommended settings:
- **Scale:** 100%
- **Margins:** Default (uses `@page` CSS rules)
- **Background graphics:** Enabled (required for cover page, callout colors, table headers, badges)
- **Headers and footers:** Disabled (manual provides its own page numbering via CSS counters)

### Accessibility
- All tables include header rows for screen reader navigation.
- Color is never the sole indicator of meaning (badges include text labels).
- Code blocks maintain sufficient contrast (light text on dark background).
- Link text is descriptive (no "click here" patterns).

---

## 8. Future Asset Capture Workflow

When screenshots and diagrams are available for capture:

1. **Launch RedByte** in development mode at `http://localhost:5173`.
2. **Set viewport** to 1440×900 pixels.
3. **Select dark theme** (the canonical visual identity).
4. **Load the "Logic Gates" starter example** for most screenshots (provides a representative non-trivial circuit).
5. **Navigate to each surface** and capture at the state described in the screenshot table above.
6. **Save screenshots** as PNG files in `docs/manuals/assets/` with the naming convention `ss-01-design-full.png`.
7. **Create diagrams** using Mermaid, draw.io, or Figma. Export as SVG for resolution independence. Save in `docs/manuals/assets/`.
8. **Reference assets** in both the markdown source (as `![caption](assets/filename.ext)`) and the HTML companion (as `<img>` tags with `alt` text and figure captions).

---

## 9. Asset Directory Structure

```
docs/manuals/
├── RedByte_Product_Manual.md              # Canonical editable source
├── RedByte_Product_Manual_print.html      # Print-ready styled companion
├── RedByte_Product_Manual_ASSET_PLAN.md   # This file
└── assets/                                # Future: screenshots and diagrams
    ├── ss-01-design-full.png
    ├── ss-02-design-palette.png
    ├── ...
    ├── dg-01-canonical-workflow.svg
    ├── dg-02-data-flow.svg
    └── ...
```

---

*End of Asset Plan*
