---
doc_status: current
last_validated: 2026-05-03
owner: Connor Angiel
used_by_claude: true
role: spec for the public website and first-run in-app onboarding — what to say, what to show, what not to claim
---

# RedByte — Public Site and Onboarding Spec

**Guiding constraint:** Do not build the website until the product spine (this doc set) is stable. Do not publish claims that the product cannot currently back. The website is a distribution channel, not a marketing document.

---

## 1. What the Website Must Say

### Required content (ground these in actual product state)

**What RedByte is:**
RedByte is a browser-based educational IDE for designing, verifying, and exporting digital logic circuits to the Digilent Basys3 FPGA board. It gives students a structured workflow — design visually, verify against test scenarios, map to board pins, export a Vivado-ready project — without requiring prior HDL experience or a professional EDA background.

**Who it is for:**
University students in digital logic and computer architecture courses that use the Basys3 board and AMD Vivado. Individual learners who want a real, connected-to-hardware environment for exploring digital logic.

**What it produces:**
A complete Vivado Kit ZIP (VHDL, XDC, testbench, TCL, README) that opens and synthesizes in AMD Vivado 2024.2 without modification. For supported circuit types.

**What "supported circuit types" means:**
Combinational circuits and rising-edge single-clock sequential circuits. Falling-edge clocking, multi-clock designs, and active-low reset are explicitly out of scope and are blocked at verification and export.

**What it requires:**
For design and verification only: a modern browser, no installation. For the hardware path: AMD Vivado 2024.2 and a Digilent Basys3 FPGA board.

### What must not appear on the website (not yet true or not yet stable)

- No claim that all lab starters are hardware-certified (they are L0/E0 only)
- No claim that all circuit types are supported
- No claim that the export "works for any design"
- No LMS integration, account-based features, or instructor dashboard (not built)
- No AI-assisted features
- No board support beyond Basys3
- No desktop app or offline mode

---

## 2. Required Pages and Sections

**Homepage**

| Section | Content |
|---------|---------|
| Hero | Headline, subheadline, "Open the IDE" CTA (no installation), supporting line about Vivado output |
| What it does | 3–4 sentence honest product description |
| The workflow | Visual or text representation of Project → Design → Verify → Map Pins → Export |
| Screenshots or GIF | At least one per major surface (Design, Verify, Export). Must show current UI, not mockups. |
| Who it's for | Students + individual learners; honest about the Basys3 requirement for hardware path |
| Known limitations / scope | Supported circuit types; Basys3 only; Vivado required for hardware |
| GitHub link | Repo link |
| Open the IDE | Persistent CTA |

**Setup / Prerequisites page**

- Browser: any modern browser (Chrome recommended for hardware path tooling)
- For hardware path only: AMD Vivado 2024.2 download and install
- Basys3 board required for hardware programming (links to Digilent product page)
- No server setup, no account, no installation for the IDE itself

**For Instructors page** (stub; link to University Pilot Plan contact when ready)

- What RedByte does in a digital logic course context
- Lab fixture system overview (lab starters, starter examples)
- Pilot inquiry contact

---

## 3. Required Screenshot and Demo Assets

These must be captured from the **live running product** at current UI state, not mockups.

| Asset | What it shows | Priority |
|-------|--------------|---------|
| Design surface screenshot | A real circuit (e.g., `signal-tour` 4-switch → 4-LED) with wiring visible | High |
| Verify surface screenshot | A passing Compare result with waveform panel visible | High |
| Export surface screenshot | Trusted Export state with 8-step Vivado checklist | High |
| Map Pins screenshot | Basys3 board visualization with pins mapped | Medium |
| Project surface screenshot | Project home with the workflow rail | Low |
| Demo GIF or video | 30–60 second walkthrough of the full student path | High (post-launch) |

**Capture protocol:** Use the dev server at 1366×768. Clear browser storage before capture to show first-load state honestly. Do not use dark mode unless it is the default.

---

## 4. Download / Setup Path

The IDE is live at [redbyteapps.dev](https://redbyteapps.dev). No download is required to use the design and verification workflow.

The hardware export path requires:
1. Export the Vivado Kit ZIP from RedByte's Export surface.
2. Install AMD Vivado 2024.2 (free Webpack edition is sufficient for Basys3).
3. Open the exported `.xpr` in Vivado and run synthesis, implementation, and bitstream generation.
4. Program the Basys3 via Vivado Hardware Manager.

This must be documented in a "Hardware Setup" page or expandable section, not buried in a README.

---

## 5. First-Run In-App Onboarding

This is **higher priority than the public website.** A student opening RedByte for the first time must be able to answer:

- What is this? (one sentence)
- What should I open first? (a starter example or a new project)
- How do I go from a circuit to a Vivado export?
- What does "Trusted Export" mean vs. "Draft Export"?
- What do I need installed to use the hardware path?

**Required onboarding behaviors (not all must be implemented for v1, but must be planned):**

| Behavior | Priority | Current state |
|----------|---------|--------------|
| Project surface shows clear "Start here" prompt when no project is loaded | High | Starter gallery exists; CTA clarity not audited |
| Workflow rail shows numbered steps with active state | High | Present; numeric badge may need honest "step N of 5" framing |
| Each surface has a one-line "What you do here" context line | High | Partially implemented in some surfaces |
| Export surface explains Draft vs. Trusted inline | High | Present (trust hero block added) |
| Verify surface explains what Compare means | Medium | Present (explainer block added) |
| Empty waveform panel has a "Run to see waveform" placeholder | Medium | Added in recent cleanup pass |
| Map Pins surface explains the board diagram without a 3-step guide after mapping is complete | Medium | Known friction (F-H2) |

**Explicitly out of scope for v1 onboarding:**
- Interactive tutorial overlay or guided tour
- User accounts or saved onboarding progress
- Video walkthroughs embedded in the IDE

---

## 6. What Not to Claim Publicly Yet

| Claim | Why not yet |
|-------|------------|
| "All lab starters are hardware-ready" | Lab starters are L0/E0 only; E1 certification per-row only |
| "Classroom-ready" without qualification | Clean-tree classroom signoff not yet completed |
| "Instructor dashboard" or "submission grading" | Not built |
| "Works for any digital logic design" | Combinational + single-clock sequential only |
| "Proven on Basys3" as a blanket claim | Only certain circuits have E1/E2/E3 proof; claim must be scoped |
| E3 (board behavior certified) for `golden` or `two-bit-counter` | Pending bench sessions |
| University pilot availability | Pilot plan not yet finalized; do not advertise until plan is stable |
