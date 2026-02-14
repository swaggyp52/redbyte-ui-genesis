# What RedByte Is

RedByte is a browser-based digital logic lab environment for ECE students. It replaces three tools in one window: Vivado's schematic/HDL workflow, a logic simulator, and the lab submission pipeline. A student with a Windows laptop and a Basys 3 board can install RedByte, open it, load a lab assignment, write Verilog, simulate it, program the FPGA, capture evidence, and export a submission — without touching a terminal, without configuring toolchains manually, and without switching between applications.

## The Golden Path

Every session follows one pipeline. There are no alternative routes, no hidden power-user modes, no "explore the OS" moments. The path is:

```
Dashboard  →  Studio  →  Verify  →  Package  →  Export
```

| Stage | What Happens | App |
|-------|-------------|-----|
| **Dashboard** | Pick a lab or starter kit. See recent projects. One button: "Start in Studio." | HomeApp |
| **Studio** | Write HDL, simulate, program hardware. Four sequential modes: Build → Simulate → Hardware → Submit. Each mode unlocks when the previous is satisfied. | LabWorkspaceApp |
| **Verify** | Automated submission gates check: code compiles, simulation ran, hardware programmed, evidence captured. Red/green checklist. | LabWorkspaceApp (submit mode) |
| **Package** | Generate `.rbproj` submission bundle with integrity hashes. One click. | LabWorkspaceApp (submit mode) |
| **Export** | Download the bundle. Student hands it to instructor. Done. | LabWorkspaceApp (submit mode) |

The Studio (LabWorkspaceApp) is the product. Everything else exists to get into it or get out of it.

## What Ships (v1 Surface)

**Core apps (registered, visible to students):**
- HomeApp — dashboard, starter kits, recent projects
- LabWorkspaceApp — the studio (HDL editor + sim + hardware + submission)
- LogicPlaygroundApp — visual gate-level playground (learning tool)
- SettingsApp — toolchain config, preferences
- FirstRunWizardApp — one-time setup (toolchain detection, board check)

**Support apps (registered, not in dock, opened by system):**
- FilesApp, TerminalApp, TextViewerApp, SystemLogApp, ToolchainSetupApp

**Instructor-only (hidden in student mode):**
- InstructorApp, SubmissionInspectorApp

**Everything else is dead code.** 15 app files on disk are not registered and should be deleted: WelcomeApp, StartHereApp, AppStoreApp, StatusPanelApp, VirtualLabApp, VirtualLabAppImpl, StudentLabApp, InstructorRunDetailApp, LabExaminerApp, LabExaminerAppRegistry, FpgaProofViewerApp, HelpApp, LogicHelpApp, UserManualApp, WalkthroughPage, LogicLabApp.

## Quality Bar

"Next Lab Ready" means a TA can hand a student this checklist and it works:

1. Install: `git clone` + `pnpm install` + `pnpm dev` — opens in browser
2. First Run: wizard detects toolchain, checks USB, confirms board
3. Open Lab: click starter kit on dashboard, lands in Studio
4. Build: write/edit Verilog, see syntax errors inline
5. Simulate: run simulation, see waveform, signals match expected
6. Hardware: program Basys 3 over USB, see confirmation
7. Submit: gates pass, bundle downloads, file is valid `.rbproj`

If any step fails with an unclear error or requires manual intervention, the product is not ready.

## What RedByte Is Not

- Not a general-purpose OS or desktop environment
- Not a marketplace or app store
- Not a teaching tool with tutorials (that's the instructor's job)
- Not a replacement for the command line (Terminal exists as escape hatch only)
- Not a platform with plugins or extensions

One golden path. One product. Ship it.
