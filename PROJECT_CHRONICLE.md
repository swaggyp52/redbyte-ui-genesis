# PROJECT CHRONICLE
### RedByte OS Genesis — The Complete Living Record

---

## 📋 DOCUMENT PURPOSE & USAGE

**THIS IS THE SINGLE SOURCE OF TRUTH FOR THE ENTIRE PROJECT.**

This document is a living chronicle — a comprehensive diary that captures:
- **What this project is and why it exists**
- **The complete technical architecture and how everything connects**
- **Every decision, every pattern, every invariant that must never break**
- **The full history of what's been built and how it was built**
- **Common workflows, known issues, gotchas, and pain points**
- **Active work, current objectives, and what comes next**

### For AI Agents (Claude, Codex, and others)

**MANDATORY READING REQUIREMENTS:**
1. ✅ Read this file BEFORE proposing or executing ANY work
2. ✅ Treat this as higher priority than prior chat context
3. ✅ Update this file AFTER completing ANY task or change
4. ✅ Add a timestamped entry in the "Chronicle of Changes" section
5. ✅ Sign your updates in the "AI Contributions Log" section

**This is not optional.** Every line of code in this project serves an explicit purpose. Understanding that purpose starts here.

### For Humans

This document is also for you. It's the fastest way to understand the entire project, onboard new team members, and maintain continuity across work sessions.

---

## 🎯 PROJECT IDENTITY

**Name:** RedByte OS Genesis
**Owner:** Connor Angiel
**Type:** Browser-based OS-style digital logic simulation and construction platform
**Stack:** TypeScript, React 19, Vite 7, pnpm, Three.js, Zustand, Tailwind CSS
**Deployment:** Cloudflare Pages (auto-deploy from `main`)
**Repository:** Monorepo using pnpm workspaces
**Canonical Branch:** `main` (always production-ready)
**License:** RedByte Proprietary License (RPL-1.0)
**Version:** v0.1.0-preview (Release Hardening RC)
**Live Preview:** redbyteapps.dev

---

## 🌟 WHAT IS THIS PROJECT & WHY DOES IT EXIST?

### The Vision

RedByte OS Genesis is **an educational digital logic circuit simulation platform** designed to make learning about computer architecture, digital logic, and circuit design **interactive, visual, and fun**.

Think of it as:
- **A digital logic sandbox** where you can build circuits from basic gates (AND, OR, NOT) up to complex systems (flip-flops, counters, CPUs)
- **An OS-like environment** with windowed apps, a shell, file system, and desktop metaphor
- **A debugging powerhouse** with signal recording/replay, time-travel debugging, and mismatch localization
- **A learning platform** with tutorials, examples, pattern recognition, and circuit health analysis

### Why It Exists

**Problem:** Learning digital logic is often abstract and disconnected from hands-on experimentation. Existing tools are either too complex (professional EDA tools) or too simplistic (basic simulators).

**Solution:** RedByte bridges the gap by providing:
1. **Real-time visual feedback** — See signals flow through circuits in 2D and 3D
2. **Powerful debugging** — Record runs, replay them, and identify exactly where bugs occur
3. **Progressive learning** — Start with simple gates, build up to complex systems
4. **Production-grade quality** — Professional UX, comprehensive testing, accessibility support
5. **Browser-based** — No installation, works everywhere, shareable URLs

### Core Features

- ✅ **Interactive 2D circuit editor** with drag-drop, pan/zoom, wire routing
- ✅ **3D circuit visualization** using Three.js for spatial understanding
- ✅ **Real-time signal simulation** with deterministic evaluation
- ✅ **Recording/replay system** — Debug circuits by recording runs and replaying them step-by-step
- ✅ **Mismatch localization** — Automatically identify the source of circuit errors using suspect set tracing
- ✅ **Learning mode** with tutorials, examples, and guided lessons
- ✅ **Circuit health analysis** — Real-time error detection and suggestions
- ✅ **Oscilloscope view** — Visualize signal waveforms over time
- ✅ **Chip library** — Save and reuse custom components
- ✅ **File system** with persistence and save/load circuits
- ✅ **Shell environment** with multiple apps (launcher, settings, terminal, help)

---

## 🏗️ TECHNICAL ARCHITECTURE

### System Overview

RedByte is built as a **browser-based operating system metaphor**:

```
┌─────────────────────────────────────────────────────────┐
│                    Browser Window                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │              Shell (rb-shell)                     │  │
│  │  ┌─────────────────────────────────────────────┐  │  │
│  │  │         Desktop / Window Manager            │  │  │
│  │  │  ┌───────────┐  ┌──────────┐  ┌──────────┐  │  │  │
│  │  │  │ App Window│  │App Window│  │App Window│  │  │  │
│  │  │  │ (Playground)  │ (Files)  │  │(Settings)│  │  │  │
│  │  │  └───────────┘  └──────────┘  └──────────┘  │  │  │
│  │  │                                             │  │  │
│  │  │  [Dock] [Desktop Icons] [System Tray]     │  │  │
│  │  └─────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Package Architecture (Monorepo)

```
redbyte-ui/
├── apps/                    # Application entry points
│   ├── playground/          # Main web app (Vite SPA)
│   ├── studio/              # Studio application
│   └── docs/                # Documentation site
│
├── packages/                # Shared libraries
│   ├── rb-logic-core/       # ⚡ Core simulation engine
│   ├── rb-logic-adapter/    # Logic core adapters
│   ├── rb-logic-view/       # 🎨 2D circuit canvas (React)
│   ├── rb-logic-3d/         # 🎨 3D visualization (Three.js)
│   ├── rb-apps/             # 📱 Application components
│   ├── rb-shell/            # 🖥️ OS shell wrapper
│   ├── rb-windowing/        # 🪟 Window management
│   ├── rb-primitives/       # 🧱 React UI primitives
│   ├── rb-theme/            # 🎨 Theme/styling
│   ├── rb-tokens/           # 🎨 Design tokens
│   ├── rb-utils/            # 🛠️ Utilities & Zustand stores
│   └── rb-icons/            # 🎨 Icon library
│
└── tools/config/            # Shared build configs
```

### Core Systems Explained

#### 1. **Logic Simulation Engine (rb-logic-core)**

**Purpose:** The heart of the platform — evaluates circuits and propagates signals.

**Key Components:**
- `CircuitEngine` — Signal propagation and evaluation
- `TickEngine` — Simulation loop management (deterministic timing)
- `NodeRegistry` — Component registration system (gates, switches, lamps, etc.)
- `TraceRecorder` — Records simulation traces for debugging
- `Serialization` — Circuit save/load with compression (uses pako)

**Node Types:**
- **Basic Gates:** AND, OR, NOT, NAND, NOR, XOR, XNOR
- **I/O:** PowerSource, Switch, Lamp, Probe
- **Timing:** Clock, Delay
- **Composite:** RS Latch, D Flip-Flop, JK Flip-Flop, Full Adder, 4-bit Counter

**How It Works:**
1. User builds circuit by adding nodes and wires
2. `CircuitEngine` evaluates signal values recursively
3. Each node has a pure `evaluate` function (deterministic, no side effects)
4. Signals propagate through wires based on connectivity
5. `TickEngine` manages simulation steps (ticks)
6. `TraceRecorder` captures state at each tick for replay

**Why This Matters:**
- Deterministic evaluation means bugs are reproducible
- Pure functions make testing easy
- Trace recording enables time-travel debugging

#### 2. **2D Circuit Editor (rb-logic-view)**

**Purpose:** Interactive canvas for building circuits visually.

**Main Component:** `LogicCanvas`

**Features:**
- Pan/zoom with mouse wheel and drag
- Grid snapping for aligned components
- Node selection and dragging
- Wire connection with validation (no cycles, type checking)
- Toolbar with editing tools
- Real-time signal visualization (color-coded wires)

**State Management:** Zustand store (`useLogicViewStore`)

**Why This Matters:**
- Provides the primary UI for circuit construction
- Real-time visual feedback makes logic tangible
- Keyboard-first design for power users

#### 3. **3D Visualization (rb-logic-3d)**

**Purpose:** Spatial 3D representation of circuits.

**Main Component:** `Logic3DScene`

**Technologies:**
- Three.js (WebGL rendering)
- React Three Fiber (React bindings)
- drei (Three.js helpers)

**Features:**
- 3D node meshes with signal colors
- 3D wire meshes connecting nodes
- Camera controls (orbit, pan, zoom)
- Selection map for interactive picking

**Why This Matters:**
- Helps visualize complex circuits in 3D space
- Makes spatial relationships clearer
- Educational value for understanding circuit layout

#### 4. **Application Layer (rb-apps)**

**Purpose:** All application-level logic, components, and state.

**Apps Included:**
- `LogicPlaygroundApp` — Primary circuit editor/simulator
- `LogicHelpApp` — Interactive help system
- `FilesApp` — File system browser
- `TerminalApp` — Command-line interface
- `SettingsApp` — Configuration manager
- `LauncherApp` — App launcher
- `WelcomeApp` — Onboarding

**Sub-systems:**

##### State Management (Zustand Stores)
- `circuitStore` — Circuit data (nodes, wires, simulation state)
- `chipStore` — Reusable component library
- `runRecorderStore` — Recording/replay state
- `probeStore` — Signal tracing
- `oscilloscopeStore` — Signal waveform visualization
- `layoutStore` — UI layout state
- `viewStateStore` — View configuration
- `hierarchyStore` — Circuit hierarchy
- `fileSystemStore` — File management

**Why Zustand?**
- Lightweight, no boilerplate
- Multiple stores = better separation of concerns
- Easy to test (stores are just functions)

##### Recording & Replay System
**Files:**
- `runRecord.ts` — Run record data structures
- `runRecordUtils.ts` — Digest/normalization utilities
- `stimulus.ts` — Input event replay
- `proofPack.ts` — Proof packaging

**How It Works:**
1. User starts recording (captures initial state)
2. All user inputs (switch toggles, clock ticks) are logged
3. Simulation state is captured at each tick
4. Replay: Re-run simulation with same inputs, compare outputs
5. Mismatch localization: If outputs differ, trace back to find the bug

**Why This Matters:**
- **Debugging superpower** — Record a bug, replay it, fix it
- **Educational** — Students can see exactly how circuits evolve over time
- **Verification** — Prove a circuit works by recording test runs

##### Mismatch Localization (Advanced Debugging)
**File:** `mismatchLocalization.ts`

**Purpose:** Automatically identify which node(s) caused a circuit to behave incorrectly.

**How It Works:**
1. Compare expected trace (golden run) with actual trace (buggy run)
2. Identify mismatched outputs
3. Backward trace through circuit topology to find "suspect nodes"
4. Highlight suspect nodes in UI

**Why This Matters:**
- Saves hours of manual debugging
- Makes learning from mistakes easier
- Unique feature not found in most simulators

##### Circuit Health Analysis
**Component:** `CircuitHealthPanel`

**Purpose:** Real-time error detection and suggestions.

**Checks:**
- Unconnected inputs
- Floating outputs
- Potential oscillations
- Power supply issues
- Timing hazards

**Why This Matters:**
- Guides beginners toward correct circuit design
- Catches common mistakes before they become bugs

#### 5. **Shell & Windowing (rb-shell, rb-windowing)**

**Purpose:** OS-like desktop environment.

**Features:**
- Window management (create, focus, minimize, maximize, close)
- Dock with running apps
- Desktop with icons
- Launcher (Cmd/Ctrl+K)
- Command palette
- System search
- Toast notifications
- Error boundary with recovery

**Window Lifecycle:**
- Apps are registered in app registry
- Shell.openWindow creates new windows
- Singleton apps (Settings, Launcher) reuse existing window
- Non-singleton apps (Files) create multiple windows
- Z-index management for stacking
- Focus management (single-focus invariant)
- Session persistence (windows survive reload)

**Why This Matters:**
- Professional OS-like UX
- Supports multi-window workflows
- Teaches OS concepts (windowing, process management)

---

## 🧬 ARCHITECTURAL INVARIANTS (NEVER BREAK THESE)

These rules are **permanent** unless explicitly changed in this document:

### Core Principles
1. **OS metaphor is canonical** — Boot → Desktop → Apps structure is sacred
2. **Monorepo structure is authoritative** — Packages are not merged or flattened
3. **`main` is always production** — Never push broken code to main
4. **Cloudflare Pages auto-deploys from `main`** — Main is live
5. **Terminal-first development only** — GitHub UI actions are forbidden
6. **One change-set per commit** — No mixing unrelated changes
7. **No speculative refactors** — Only change what's needed for the task
8. **No global changes without explicit authorization** — Ask first

### Legal & Attribution
- Legal attribution must reference **Connor Angiel**
- No AI agent may introduce automation bots without approval

### Window & Shell Lifecycle Contract
**Focus surface and interaction rules:**
- New windows always receive focus on creation
- Focusing a window unfocuses all other windows (single-focus invariant)
- Minimized windows remain in window store but excluded from layout
- Z-index is unique per window and increases monotonically
- Focusing a window raises its z-index above all others

**Dock interaction rules:**
- Clicking Dock icon for singleton app restores minimized window + focuses
- Clicking Dock icon for non-singleton app creates new instance
- Dock never creates duplicate singleton windows
- Dock running indicator shows only non-minimized windows

**Keyboard semantics (OS-level):**
- Cmd/Ctrl+K opens Launcher (global, always available)
- Cmd/Ctrl+, opens Settings (global)
- Escape in Launcher closes Launcher
- Cmd/Ctrl+W closes focused window
- Cmd/Ctrl+` cycles to next window

### Launcher Contract
- Launcher is the canonical OS entry point
- Launcher is a singleton app (only one instance allowed)
- When invoked and minimized, Launcher restores and gains focus
- Launcher does NOT steal focus when dismissed

### Files App Contract
- Files is a non-singleton app (multiple windows allowed)
- Each Files window has independent navigation state
- Window title reflects current folder (e.g., "Files — Documents")
- Keyboard navigation: Arrow keys, Enter opens, Escape closes

### Settings App Contract
- Settings is a STRICT singleton
- Settings changes propagate live to all components (no flicker, no remounts)
- Settings state lives outside Settings component (survives window close)
- Settings persist to localStorage and reload on Shell boot
- Corrupted localStorage resets to safe defaults (no crash)

### Intent System Contract
**Intents enable explicit app-to-app interaction:**
- Intents are EXPLICIT, user-initiated actions (never implicit)
- Intents are routed by the Shell, NOT apps directly
- Intent payloads are immutable once dispatched
- No global state for intents (routing is synchronous)
- All intent actions are explicit user choices (button, menu, or keyboard shortcut)

### Command System Contract
**Commands are system-level actions:**
- Commands are STATELESS and SYNCHRONOUS (no async side effects)
- Commands operate on focused window when applicable
- Commands do NOT open new windows (only manipulate existing)
- Commands do NOT fire when typing in text inputs

**Available commands:**
- `focus-next-window` — Cycle to next window (Cmd/Ctrl+`)
- `focus-prev-window` — Cycle to previous window
- `close-focused-window` — Close focused window (Cmd/Ctrl+W)
- `minimize-focused-window` — Minimize focused window (Cmd/Ctrl+M)

### Session Contract
**Session restore preserves workspace continuity:**
- Session restore is BEST-EFFORT and FAILURE-SAFE
- Session restore is AUTOMATIC on boot (no user confirmation)
- What gets restored: Normal windows, maximized windows, minimized windows, z-index, focus
- What does NOT get restored: Launcher window, app-specific internal state
- Window state persists to localStorage on every mutation

### Layout Contract
**Window layouts are explicit spatial commands:**
- Layouts are EXPLICIT and USER-TRIGGERED (never automatic)
- Layouts are PER-SESSION (restored on reload)
- Available layouts: Snap Left, Snap Right, Snap Top, Snap Bottom, Center
- Keyboard shortcuts: Cmd/Ctrl+Alt+Arrow keys, Cmd/Ctrl+Alt+C

---

## 📦 PACKAGE DEPENDENCY GRAPH

```
rb-shell (OS wrapper)
  ├── rb-apps
  ├── rb-windowing
  ├── rb-theme
  └── rb-utils

rb-apps (Applications)
  ├── rb-logic-view (2D Canvas)
  ├── rb-logic-3d (3D Visualization)
  ├── rb-logic-adapter
  ├── rb-logic-core (Engine)
  ├── rb-theme
  ├── rb-utils
  └── rb-icons

rb-logic-view
  ├── rb-logic-core
  └── zustand

rb-logic-3d
  ├── rb-logic-core
  ├── rb-logic-adapter
  ├── three.js
  ├── @react-three/fiber
  └── @react-three/drei

rb-theme
  └── rb-tokens

playground (SPA)
  ├── rb-shell
  ├── rb-apps
  └── rb-windowing
```

---

## 🧪 TESTING STRATEGY

### Test Framework
- **Primary:** Vitest 2.1.8 (unit/integration tests)
- **React:** React Testing Library 16.1.0
- **E2E:** Playwright 1.50.1
- **Coverage:** @vitest/coverage-v8

### Test Distribution
- **Total test files:** 66
- **Total tests:** 433+
- **All tests passing:** ✅ Required for merge

### Test Categories

1. **Unit Tests**
   - `builtins.test.ts` — Logic gate behaviors
   - `composite.test.ts` — Multi-gate circuits
   - `serialization.test.ts` — Save/load functionality
   - `TickEngine.test.ts` — Simulation timing

2. **Component Tests**
   - `logic-playground.test.tsx` — Main app
   - `files.test.tsx` — File operations
   - `launcher.test.tsx` — App launching
   - `circuitHealthPanel.test.tsx` — Health indicator

3. **Feature Tests**
   - `run-recorder.test.tsx` — Recording/replay
   - `run-record-utils.test.tsx` — Utilities
   - `mismatch-localization.test.tsx` — Bug localization
   - `replay-lock.test.tsx` — Replay synchronization

4. **Integration Tests**
   - `files-operations.test.tsx` — File system
   - `logic-help.test.tsx` — Help system
   - `chip-system.test.tsx` — Chip management

### Quality Gates
- All tests passing
- Lint passing
- TypeCheck passing
- Build successful
- Zero warnings in test output

### Test Commands
```bash
pnpm test          # Run all tests
pnpm coverage      # Coverage report
pnpm a11y          # Accessibility tests
pnpm perf          # Performance tests
```

---

## 🛠️ DEVELOPMENT WORKFLOWS

### Setting Up the Project
```bash
# Clone repo
git clone <repo-url>
cd redbyte-ui

# Install dependencies (requires pnpm 10.24.0+)
pnpm install

# Start dev server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

### Common Tasks

#### Adding a New Logic Node Type
1. Define behavior in `packages/rb-logic-core/src/behaviors/`
2. Register in `packages/rb-logic-core/src/registry/NodeRegistry.ts`
3. Add tests in `packages/rb-logic-core/src/__tests__/`
4. Add UI component in `packages/rb-apps/src/components/`
5. Update palette in `packages/rb-apps/src/components/EnhancedPalette.tsx`

#### Adding a New App
1. Create component in `packages/rb-apps/src/apps/`
2. Register in app registry
3. Add to shell
4. Add tests
5. Update documentation

#### Making a Commit
```bash
# Check status
git status

# Stage changes
git add <files>

# Commit with descriptive message
git commit -m "feat(playground): add new feature

Detailed description of changes.

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Push to remote
git push
```

#### Creating a Pull Request
```bash
# Create new branch
git checkout -b feature/my-feature

# Make changes, commit

# Push branch
git push -u origin feature/my-feature

# Create PR using gh CLI
gh pr create --title "feat: my feature" --body "Description of PR"
```

---

## 🐛 KNOWN ISSUES & GOTCHAS

### General
- **Issue:** AI_STATE.md is massive (45,924 tokens) and hard to parse
  - **Solution:** Created PROJECT_CHRONICLE.md as the new single source of truth

### Circuit Simulation
- **Gotcha:** Circuits must be acyclic for deterministic evaluation
  - Combinational loops will cause infinite recursion
  - Use flip-flops to break feedback loops

- **Issue:** Signal propagation delay is simplified
  - Real circuits have gate delays, our simulation uses instantaneous propagation within a tick
  - This is by design for educational simplicity

### Recording/Replay
- **Gotcha:** Replays must use exact same circuit topology
  - Changing circuit structure invalidates recorded traces
  - Use digest comparison to detect changes

### UI/UX
- **Issue:** 3D view performance can degrade with very large circuits (1000+ nodes)
  - Consider LOD (level of detail) optimizations in future

- **Gotcha:** Window focus can be confusing when multiple windows overlap
  - Single-focus invariant means only one window is focused at a time
  - Click to focus

### Testing
- **Gotcha:** Tests run in JSDOM, not real browser
  - Some browser APIs may not work
  - Use Playwright for full browser testing

---

## 📚 DOCUMENTATION STRUCTURE

This project has multiple documentation files. Here's what each one is for:

### Root Level
- **PROJECT_CHRONICLE.md** (THIS FILE) — Comprehensive living record of everything
- **AI_STATE.md** — Legacy AI state ledger (being phased out, but still contains valuable phase/contract history)
- **README.md** — Basic project intro for humans

### docs/ Folder
- **ARCHITECTURE.md** — High-level system architecture (kernel, shell, apps)
- **PROJECT_MODEL.md** — Data model for project state (logic, CPU, signals)
- **APP_MAP.md** — Map of all applications and their purposes
- **LEARNING_GUIDE.md** — Educational content and tutorials
- **ONBOARDING_PLAN.md** — New contributor onboarding
- **DESKTOP_PACKAGING.md** — Desktop app packaging instructions
- **REDSTONE_VIEWER.md** — Redstone viewer documentation
- **SIGNAL_VIEWER.md** — Signal viewer documentation

### Package READMEs
Each package has its own README:
- `packages/rb-logic-core/README.md` — Logic engine API
- `packages/rb-apps/README.md` — Application layer
- `packages/rb-logic-view/README.md` — 2D canvas API
- `packages/rb-logic-3d/README.md` — 3D visualization API
- `packages/rb-shell/README.md` — Shell API
- (etc.)

### Documentation Principles
1. **No overlapping information** — Each doc has a clear, unique purpose
2. **Cross-reference freely** — Docs should link to each other
3. **Keep it updated** — Update docs when you update code
4. **This file is the master** — PROJECT_CHRONICLE.md ties everything together

---

## 📈 RECENT DEVELOPMENT WORK

### Latest Commits (Last 30 Days)

#### 036c502c — `feat(playground): run recorder replay hardening + view-only replay mode`
- Added view-only replay mode for safer playback
- Improved replay stability and error handling
- Enhanced UI for recording/playback controls

#### f0b38e6f — `fix(build): resolve HelpDock JSX parse error`
- Fixed build error in HelpDock component

#### 8ecc39a8 — `chore(playground): micro toolbars, command palette, 3D selection map, probe forwarding fixes`
- Added micro toolbars for context-sensitive controls
- Integrated command palette for power users
- Enhanced 3D selection map
- Fixed probe forwarding issues

#### 153ca983 + 87190899 — `fix(playground): resolve circuit interaction errors`
- Multiple fixes for circuit interaction bugs

#### Earlier Work
- Critical state synchronization bug fix (node position persistence)
- Single-click switch toggle improvement
- Usability hardening sprint (comprehensive testing and fixes)

### Modified Files (Current Session)
Based on git status, active work includes:
- Test files for run recorder, mismatch localization, replay lock
- Components: LogicPlaygroundApp, EnhancedPalette, OscilloscopeView, PropertyInspector, RightDock, RunRecorderPanel, SchematicView, SplitViewLayout
- Recording system: runRecord.ts, runRecordUtils.ts, runRecorderStore.ts
- New utilities: digest.ts, mismatchLocalization.ts, replayLock.ts
- 3D and 2D view updates

---

## 🎯 CURRENT OBJECTIVES & NEXT STEPS

### Active Development Phase
**Status:** Release Hardening RC (v0.1.0-preview)

### Immediate Priorities
1. ✅ Run recorder replay hardening (COMPLETED)
2. ✅ Mismatch localization implementation (COMPLETED)
3. 🔄 Documentation consolidation (IN PROGRESS — this file!)
4. ⏳ Final testing and polish before v0.1.0 release

### Future Features (Backlog)
- Desktop app packaging (Electron/Tauri)
- Advanced waveform analysis
- Circuit optimization suggestions
- Collaborative editing (multi-user)
- Cloud circuit storage
- Mobile-responsive UI
- Additional logic node types (RAM, ROM, ALU components)
- Verilog/VHDL export
- Breadboard view (physical circuit simulation)

---

## 🔧 TECHNOLOGY STACK REFERENCE

### Core Framework
- **React** 19.2.1 (with experimental features)
- **TypeScript** 5.x
- **Vite** 7.2.6 (ESM-first, fast HMR)
- **pnpm** 10.24.0+ (workspaces)

### State Management
- **Zustand** 5.x (primary state management)
- Multiple stores for separation of concerns

### Graphics & Visualization
- **Three.js** 0.172.0 (3D rendering)
- **React Three Fiber** 9.4.2 (React bindings for Three.js)
- **react-three/drei** 9.119.3 (Three.js helpers)

### Styling
- **Tailwind CSS** 3.4.18
- **PostCSS** 8.5.6
- **Autoprefixer** 10.4.22

### Testing
- **Vitest** 2.1.8 (unit/integration)
- **React Testing Library** 16.1.0
- **Testing Library user-event** 14.6.1
- **JSDOM** 27.2.0
- **Playwright** 1.50.1 (e2e)
- **@vitest/coverage-v8** (coverage)

### Utilities
- **pako** 2.1.0 (compression for circuit serialization)

### Code Quality
- **ESLint** + custom a11y plugin
- **Prettier** (formatting)
- **TypeScript** (static analysis)

### Deployment
- **Cloudflare Pages** (production hosting)
- **GitHub Actions** (CI/CD)

---

## 🤖 AI CONTRIBUTIONS LOG

**Instructions for AI Agents:**
After completing ANY work on this project, add an entry here with:
- Timestamp (ISO 8601 format)
- Your identifier (Claude Sonnet 4.5, Codex GPT-4, etc.)
- Brief description of what was done
- Links to affected files or commits

---

### 2026-01-07T00:00:00Z - Codex (OpenAI)

**Task:** PR-H export artifacts and project save/load wiring

**What was done:**
- Added RBProject export helpers plus netlist, Verilog, and debug bundle exporters
- Wired Logic Playground project save/open/export actions (TopCommandBar + command palette)
- Persisted oscilloscope time window/tick guide settings and probe restore for project load
- Added export tests and corrected circuit HUD test matcher

**Files touched (high level):**
- `packages/rb-apps/src/apps/LogicPlaygroundApp.tsx`
- `packages/rb-apps/src/components/TopCommandBar.tsx`
- `packages/rb-apps/src/export/*.ts`
- `packages/rb-apps/src/stores/oscilloscopeStore.ts`
- `packages/rb-apps/src/stores/probeStore.ts`
- `packages/rb-shell/src/CommandPalette.tsx`
- `packages/rb-shell/src/searchRegistry.ts`
- `packages/rb-shell/src/Shell.tsx`
- `packages/rb-apps/src/__tests__/project-format.test.ts`
- `packages/rb-apps/src/__tests__/netlist-export.test.ts`
- `packages/rb-apps/src/__tests__/verilog-export.test.ts`
- `packages/rb-apps/src/__tests__/debug-bundle.test.ts`
- `packages/rb-logic-view/src/__tests__/circuit-hud.test.tsx`

**Signature:** Codex (OpenAI)

### 2026-01-06T[TIMESTAMP] - Claude Sonnet 4.5

**Task:** Created PROJECT_CHRONICLE.md — the comprehensive living documentation for the entire project

**What was done:**
- Explored entire codebase structure using specialized Explore agent
- Read and analyzed existing documentation (AI_STATE.md, ARCHITECTURE.md, PROJECT_MODEL.md)
- Interviewed user to understand documentation needs and philosophy
- Synthesized all technical architecture, history, patterns, and context into this single comprehensive document
- Structured documentation to serve both AI agents and human contributors

**Files created:**
- PROJECT_CHRONICLE.md (this file)

**Files referenced:**
- AI_STATE.md (legacy state ledger — massive, will be gradually phased out)
- docs/ARCHITECTURE.md (kernel, shell, app architecture)
- docs/PROJECT_MODEL.md (data model specifications)
- All package-level READMEs
- 66 test files across rb-apps and rb-logic-view
- Core implementation files across all packages

**Architectural insights captured:**
- Complete monorepo structure and package dependencies
- Logic simulation engine architecture (CircuitEngine, TickEngine, NodeRegistry)
- Recording/replay system with mismatch localization
- State management patterns using Zustand
- Window lifecycle and focus management contracts
- Intent and command system semantics
- Session persistence and workspace management

**Next AI agent should know:**
- This file is now the canonical entry point for understanding the project
- AI_STATE.md still contains valuable phase/contract history — reference it for detailed contract specifications
- Update this file's "Chronicle of Changes" section after completing work
- Sign your work in this "AI Contributions Log" section
- Cross-reference other docs instead of duplicating information

**Signature:** Claude Sonnet 4.5 (Anthropic) — 2026-01-06

---

## 📝 CHRONICLE OF CHANGES

**Instructions:**
This section is a high-level timeline of major changes. After completing significant work, add an entry here in reverse chronological order (newest first).

---

### 2026-01-07 - Project Artifacts and Export Layer

**What:** Added deterministic project export format plus netlist/Verilog/debug bundle outputs and project save/open/export wiring in Logic Playground.

**Why:**
- Projects need a single, stable artifact format for review, replay, and archival
- Exporting structural netlists and Verilog makes circuits portable to downstream tooling
- Debug bundles package proof artifacts with circuit snapshots for deterministic verification

**Impact:**
- Users can save/load full project state (layout, probes, oscilloscope settings)
- Exported artifacts are deterministic and diff-friendly
- Added coverage for exporters and corrected a circuit HUD test matcher

**Files:**
- `packages/rb-apps/src/export/*.ts`
- `packages/rb-apps/src/apps/LogicPlaygroundApp.tsx`
- `packages/rb-apps/src/components/TopCommandBar.tsx`
- `packages/rb-shell/src/CommandPalette.tsx`
- `packages/rb-shell/src/searchRegistry.ts`
- `packages/rb-shell/src/Shell.tsx`
- `packages/rb-apps/src/__tests__/project-format.test.ts`
- `packages/rb-apps/src/__tests__/netlist-export.test.ts`
- `packages/rb-apps/src/__tests__/verilog-export.test.ts`
- `packages/rb-apps/src/__tests__/debug-bundle.test.ts`

**By:** Codex (OpenAI)

---

### 2026-01-06 - Documentation Consolidation

**What:** Created PROJECT_CHRONICLE.md as single comprehensive documentation file

**Why:**
- AI_STATE.md grew to 45,924 tokens (too large to parse efficiently)
- Documentation was scattered across multiple files with overlapping information
- Need a single, authoritative, living record that both AI agents and humans can trust

**Impact:**
- Easier onboarding for new contributors
- Faster context-loading for AI agents
- Clear separation of concerns across documentation files
- Single source of truth for project decisions and architecture

**Files:**
- Created: PROJECT_CHRONICLE.md
- Referenced: AI_STATE.md, ARCHITECTURE.md, PROJECT_MODEL.md

**By:** Claude Sonnet 4.5

---

### 2025-12-XX — Run Recorder Replay Hardening

**What:** Added view-only replay mode and improved replay stability

**Why:**
- Users needed a safer way to view recorded runs without accidentally modifying state
- Replay errors were causing confusion

**Impact:**
- More reliable debugging experience
- Better separation between view and edit modes during replay

**Files:**
- packages/rb-apps/src/components/RunRecorderPanel.tsx
- packages/rb-apps/src/stores/runRecorderStore.ts
- packages/rb-apps/src/recording/runRecord.ts

**Commit:** 036c502c

---

### 2025-12-XX — Mismatch Localization Implementation

**What:** Implemented automatic bug localization using suspect set tracing

**Why:**
- Debugging complex circuits manually is time-consuming
- Students need guidance on where errors occur

**Impact:**
- Dramatically reduces debugging time
- Educational value — shows students *why* circuits fail, not just that they fail

**Files:**
- packages/rb-apps/src/utils/mismatchLocalization.ts
- packages/rb-apps/src/__tests__/mismatch-localization.test.tsx
- packages/rb-apps/src/utils/digest.ts

**By:** Development team

---

### 2025-12-XX — Micro Toolbars & Command Palette

**What:** Added context-sensitive micro toolbars and integrated command palette

**Why:**
- Power users need keyboard-first workflows
- Context menus weren't discoverable enough

**Impact:**
- Improved UX for advanced users
- Faster workflows for common tasks

**Files:**
- packages/rb-apps/src/components/TopCommandBar.tsx
- Multiple palette and toolbar components

**Commit:** 8ecc39a8

---

### 2025-11-XX — Circuit Interaction Fixes

**What:** Resolved multiple circuit interaction errors

**Why:**
- Users reported issues with node dragging, wire connections, and focus management

**Impact:**
- More stable circuit editing experience

**Commits:** 153ca983, 87190899

---

### 2025-11-XX — Critical State Sync Bug Fix

**What:** Fixed node position persistence bug causing circuit state desync

**Why:**
- Circuit layouts weren't persisting correctly across reloads
- Critical blocker for reliable save/load

**Impact:**
- Circuits now reliably maintain layout across sessions

**Commit:** 4ebd5a78 (marked CRITICAL)

---

### 2025-11-XX — Single-Click Switch Toggle

**What:** Enabled single-click switch toggle and improved drag detection

**Why:**
- Previous UX required double-click, which felt unnatural
- Drag vs click detection was too sensitive

**Impact:**
- More intuitive interaction model

**Commit:** f6cc2b99

---

### 2025-10-XX — Usability Hardening Sprint

**What:** Comprehensive usability review and fixes across the platform

**Why:**
- Preparing for v0.1.0 public preview
- Need production-grade quality

**Impact:**
- Numerous small UX improvements
- Better error handling
- Accessibility improvements

**Commit:** 7e08290d (sprint report)

---

(Earlier changes documented in AI_STATE.md and git history)

---

## 🙏 ACKNOWLEDGMENTS

**Project Owner:** Connor Angiel

**AI Assistants:**
- Claude Sonnet 4.5 (Anthropic) — Architecture, documentation, testing, development assistance
- Codex GPT-4 (OpenAI) — Development assistance

**Technologies & Libraries:**
- React Team (Meta) — React 19
- Vite Team — Vite 7
- Zustand Team (Poimandres) — State management
- Three.js Team — 3D rendering
- React Three Fiber Team (Poimandres) — React Three bindings
- Vitest Team — Testing framework
- And countless open-source contributors

---

## 📜 LICENSE

**RedByte Proprietary License (RPL-1.0)**

Copyright © 2025 Connor Angiel. All rights reserved.

See LICENSE file for full terms.

---

## 📞 CONTACT & SUPPORT

**Owner:** Connor Angiel

**Repository:** [Add GitHub URL]

**Live Preview:** redbyteapps.dev

**Issues:** Use GitHub Issues for bug reports and feature requests

**Contributing:** Read this document first, then check CONTRIBUTING.md (if it exists)

---

## 🎨 VISUAL SYSTEM REFERENCE

### Color Palette (From rb-tokens)
- Signal HIGH: Green (#22c55e)
- Signal LOW: Gray (#6b7280)
- Signal UNDEFINED: Red (#ef4444)
- Background: Dark theme (#0f172a)
- Accent: Blue (#3b82f6)

### Typography
- Primary font: System fonts (-apple-system, BlinkMacSystemFont, "Segoe UI", ...)
- Monospace: JetBrains Mono, "Fira Code", Consolas, monospace

### Layout Grid
- Base unit: 8px
- Icon size: 24px
- Button height: 32px
- Window min width: 400px
- Window min height: 300px

---

## 🔍 SEARCH INDEX (For Quick Navigation)

**Looking for something specific? Use Cmd/Ctrl+F to search this document.**

Keywords: architecture, testing, state management, circuit simulation, recording, replay, debugging, mismatch localization, 3D visualization, window management, intents, commands, session persistence, Zustand, React, Three.js, Vite, monorepo, pnpm, documentation, AI agents, Codex, Claude, Connor Angiel, RedByte OS Genesis

---

**END OF PROJECT_CHRONICLE.md**

---

*Last updated: 2026-01-07*
*Document version: 1.0.0*
*Maintained by: AI Agents + Connor Angiel*
*Status: Living Document — Update After Every Significant Change*
