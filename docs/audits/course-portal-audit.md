# Course Portal Audit: RedByte OS + redbyteapps.dev (ECE140/ECE141)

## Scope and assumptions
- Audit date: 2026-01-20
- Repo state: `5beb537c` (clean working tree)
- Surfaces audited:
  - Website: `apps/manual-site` (HashRouter; routes in `apps/manual-site/src/App.tsx`)
  - OS: `apps/playground` + `packages/rb-apps` + `packages/rb-shell`
- Course/lab documents referenced in the request are not present in this repo; this audit uses repo evidence only and maps gaps to the stated ECE140/ECE141 requirements.

## Findings summary (top risks)
1. No course-specific hub or canonical student entry path. The website is generic and does not present a single ECE140/ECE141 funnel.
2. No installable OS artifacts, versioned downloads, or checksums. The site relies on cloning the repo; there is no semester-pinned release distribution.
3. Verification is script-only (`doctor.ps1`, `smoke_fpga.ps1`) with no in-app "Verify Install" button or proof artifact students can submit.
4. Labs are not packaged as modules in the UI (no Lab Catalog, no step/checkpoint flow, no lock/unlock). There is a single lab JSON in `labs/` but no catalog surface.
5. HDL simulation/waveform workflow is missing. Verilog export exists, but there is no HDL editor or simulator to replace ModelSim/Xilinx simulation for Lab 3.

## Audit table (Area | Current State | Risk | Fix | Acceptance Test)

| Area | Current State | Risk | Fix | Acceptance Test |
| --- | --- | --- | --- | --- |
| Website funnel: course hub | No ECE140/ECE141 hub page; Home is general (`/`). | Students have no canonical entry path; course-specific steps are scattered. | Add `/courses/ece140-141` hub with clear 1→5 flow. | Open `/courses/ece140-141` and verify it links to Install, Verify, Lab Catalog, and Evidence Export in <3 clicks. |
| Website funnel: downloads | Install page uses bootstrap command only; no binaries, version list, or checksums. | No stable, audited install artifact; impossible to verify integrity or rollback. | Add versioned downloads with SHA-256 and release notes. | Download page shows OS version, file size, and SHA-256; checksum verification script matches. |
| Website funnel: install clarity | Home says "Windows, macOS, Linux" but Install page only lists Windows 10/11. | Conflicting platform expectations. | Align platform support on Home + Install. | Home and Install pages list the same supported platforms. |
| Website funnel: verify install | Verification is script-based (`scripts/doctor.ps1`, `scripts/smoke_fpga.ps1`); no in-app verification step. | Students cannot prove environment is correct; no standardized verification token. | Add in-app "Verify Install" button that produces `verification.json`. | Fresh machine runs verify; `verification.json` contains PASS=true and OS version. |
| Website funnel: submission instructions | Submission schema lives in `/manual#student-export-schema`; no course-specific submission page. | Students can miss evidence expectations. | Add course hub section "What to submit" linking to schema. | Hub page lists required bundle contents and links to schema. |
| Website funnel: known issues | No versioned known issues page; Instructors page has generic "Common failures." | Support burden during lab week; no version-specific guidance. | Add `/support` page with versioned issues. | `/support` lists issues by OS version; each includes a fix path. |
| Release engineering: versioning | `scripts/bootstrap.ps1` uses pinned tag `fpga-mvp-0.1.0`, but site bootstrap clones repo; no release artifacts. | No "semester channel" builds; students can pull wrong code. | Create semester channel tags and publish artifacts to site. | `Spring 2026` channel points to one build with checksum; OS starts with expected version. |
| Release engineering: reproducibility | `bootstrap.ps1` pins Node/pnpm and uses `pnpm install --frozen-lockfile`; requires Vivado even in SIM. | SIM-only installs fail; reproducibility tied to external vendor toolchain. | Allow SIM bootstrap without Vivado; gate Vivado only for programming. | SIM bootstrap completes without Vivado; hardware programming warns but does not block. |
| Release engineering: CI smoke | `test:proof` and `quality:smoke` exist, not tied to release or web downloads. | No enforced gates before publishing to students. | Require `test:proof` and `quality:smoke` for release tags. | Release pipeline fails if proof suite or smoke gate fails. |
| Release engineering: rollback | No documented rollback or previous-release link on site. | If a release breaks, students have no safe fallback. | Keep last stable build accessible and selectable on site. | `/install` lists current + last stable build and checksums. |
| Product capability: input toggling | OS QA checklist exists (`docs/OS_QA_CHECKLIST.md`), but statuses are stale; runtime confirmation required. | Potential regressions in click blocking/toggles. | Add a deterministic UI smoke test for input toggling in CI. | E2E test toggles input within 100ms and verifies state change. |
| Product capability: determinism | Audit mode exists (`RB_AUDIT=1`) with proof tests. | Good coverage but not tied to release. | Make audit test gate mandatory. | `pnpm test:proof` includes audit determinism test and is required for release. |
| Product capability: waveform viewer | Oscilloscope and waveform viewer exist; focused on logic signals, not HDL waveforms. | Lab 3 requires HDL sim + waveform verification. | Add HDL simulation with waveform export (VCD/trace). | Sample HDL sim produces waveform file; inspector displays expected transitions. |
| Product capability: HDL support | Verilog export exists (`packages/rb-apps/src/export/verilogExport.ts`), no HDL editor or simulator; no VHDL support. | Lab 3 tooling gap vs ModelSim/Xilinx simulation. | Add HDL editor + simulator or integrate vendor simulator with deterministic trace. | User can run Verilog sim and view waveform in OS without external tools. |
| Product capability: evidence export | RB Zip v2 export implemented and documented (`docs/STUDENT_EXPORT_SCHEMA.md`). | Good; but submission path not enforced in course hub. | Add "What to submit" in course hub; add verify artifact for install. | Bundle export contains manifest/trace/integrity; verify token present. |
| Labs-as-modules: lab catalog | No Lab Catalog UI; Start Here opens apps, not structured labs. | Students lack guided lab flow and consistent steps. | Add Lab Catalog that lists Lab 1–8 with status. | Lab Catalog lists all labs with open/locked state. |
| Labs-as-modules: step engine | No step/checkpoint engine for labs; lab JSON exists but not wired. | No consistent checkpoints or evidence prompts. | Implement step engine with checkpoints + evidence prompts. | Lab 1 shows ordered steps and checkboxes; progress persists. |
| Labs-as-modules: templates | Single `labs/basys3_mvp_lab/lab.json` exists; no template delivery. | No starter files or lab pack distribution. | Define Lab Pack format and deliver starter files in OS. | Opening a lab creates project with starter files. |
| Labs-as-modules: autograder hooks | Checks exist for FPGA trace; not tied to lab pack gating. | No uniform grading pipeline across labs. | Attach checks to lab packs and enforce in Inspector. | Import bundle -> checks auto-run and show pass/fail. |
| Labs-as-modules: lock/unlock | No scheduling or lock/unlock. | Course pacing not enforced. | Add instructor controls for lab availability. | Instructor toggles lab availability; student sees lock state. |
| Hardware bridge: board detect | `rb-fpga-bridge` provides `/ports` and `/connect`; StudentLabApp has COM selection. | Good for Basys 3 UART; needs course-specific mapping. | Add explicit board mapping UI and instructions for Basys 3. | Selecting COM shows board model and UART settings. |
| Hardware bridge: program bitstream | `/program` endpoint uses Vivado batch; UI action exists. | Requires external Vivado; fragile for student installs. | Bundle toolchain or provide controlled lab machine fallback. | Programming succeeds on lab image; SIM path remains functional without Vivado. |
| Hardware bridge: IO capture | UART telemetry captured to NDJSON; trace recorder exists. | No "logic analyzer" UI or pin mapping view. | Add IO capture view with pin labels from board_profile.json. | Trace view shows labeled signals and capture window. |

## Appendix A: Manual-site page inventory
- Routes (from `apps/manual-site/src/App.tsx`):
  - `/` Home
  - `/install` Install
  - `/instructors` Instructor Day 1
  - `/getting-started` Getting Started
  - `/demo` Demo
  - `/examples` Examples
  - `/guide` Manual
  - `/guide/walkthrough` Walkthrough
  - `/manual` Manual redirect
  - `/about` About
- Router: HashRouter (URLs are `#/path` in production).

## Appendix B: Repo inventory (relevant assets)
- Install/verify scripts: `scripts/bootstrap.ps1`, `scripts/doctor.ps1`, `scripts/smoke_fpga.ps1`
- FPGA bridge: `packages/rb-fpga-bridge` (UART parser, /ports, /connect, /program)
- Evidence schema: `docs/STUDENT_EXPORT_SCHEMA.md`
- Lab template: `labs/basys3_mvp_lab/lab.json`
- Signing + proof: `packages/rb-fpga-signing`, `packages/rb-fpga-proof-core`
- OS apps: `packages/rb-apps/src/apps/StartHereApp.tsx`, `StudentLabApp.tsx`, `SubmissionInspectorApp.tsx`, `LogicPlaygroundApp.tsx`
- Website facts: `apps/manual-site/src/content/mvpFacts.ts`

## Appendix C: Inventory commands
- `git rev-parse --short HEAD` -> `5beb537c`
- `git status -sb` -> clean
