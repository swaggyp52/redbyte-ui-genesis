# RedByte v1.0 Stabilization Roadmap (Lab-Ready Release)

To reach a lab-ready v1.0 release of RedByte as a robust digital logic education platform, this roadmap proposes phased engineering work. Tasks are grouped by major theme and aligned in phases to gradually stabilize backend architecture, solidify the simulation and hardware pipeline, improve UI reliability, expand testing, and polish the user experience.

This plan ensures students can visually build circuits, use probes/inspector tools fluidly, save/export their work, and flash designs to real hardware - all within a smooth, professional RedByte OS environment.

## Phase 1: App Architecture Hardening & Backend Stabilization

### Phase 1 Tracker

#### P1A Canonical Server (Backend First)

- [ ] Inventory existing API routes and lab UI call sites (`api/server.mjs` + frontend fetch clients)
- [ ] Implement `POST /api/labs/ingest` (request/response aligned with repo docs)
- [ ] Implement `GET /api/labs/runs` (or confirm existing; request/response aligned with repo docs)
- [ ] Implement `GET /api/labs/runs/:run_id` + artifact serving (or confirm existing)
- [ ] Implement `POST /api/labs/diff` (or confirm existing; request/response aligned with repo docs)
- [ ] Confirm retirement of legacy server paths (no UI calls to retired endpoints)
- [ ] Add minimal API verification (unit/fixture test or lightweight integration)
- [ ] Gate: `pnpm -r build`

#### P1B Persistence + Deterministic Evidence (No Data Loss)

- [ ] Confirm canonical project store + schema (`packages/rb-lab-engine` unified project store + LabProjectV1)
- [ ] Save/load across sessions works (manual QA steps documented)
- [ ] Add export/import roundtrip equality test for project format (`.rbproj` or canonical equivalent)
- [ ] Verify `.rb-lab.zip`/`.rbx.zip` evidence capsule metadata is deterministic (no hidden randomness)
- [ ] Gate: `pnpm ops:student-export-fixture-test` (if defined) and `pnpm -r build`

#### P1C State + Performance (Render-Storm Immunity)

- [ ] Apply stable selector pattern repo-wide where needed (Zustand selectors + React hooks)
- [ ] Verify no runaway renders in key apps (Logic Playground / ECE Lab)
- [ ] Ensure store cleanup on unmount + window close (no leaked subscriptions)
- [ ] Gate: smoke checklist run for OS + lab windows (document the steps executed)

#### P1D 2D/3D Lab Unification (After Foundation)

- [ ] Confirm 2D is canonical state; 3D is read-only subscriber (no topology edits in 3D)
- [ ] 3D edit attempts route to "Edit in 2D" action/message
- [ ] Remove duplicate lab apps/modules and consolidate to one lab module
- [ ] 3D render loop pauses when hidden/inactive
- [ ] Gate: end-to-end lab flow smoke test (ingest -> run -> export/import -> verify)

### Unify Lab Surfaces (2D & 3D)

Merge the ECE Lab (2D editor) and 3D Lab viewer into one unified Virtual Lab experience.

- Single source of truth for circuit state: the 2D logic engine is canonical.
- 3D visualization strictly subscribes to 2D state (read-only).
- Any 3D edit attempt prompts an "Edit in 2D" action.
- Consolidate duplicate code from separate Lab apps (e.g. ECELabApp and VirtualLabApp) into one module.

This improves consistency and eliminates divergent lab code paths.

### Backend API & Server Fixes

Finalize backend Node server endpoints to support lab workflows:

- Implement required API routes for lab ingestion, verification, diffing, etc.
  - Examples: `POST /api/labs/ingest`, `/api/labs/runs`, `/api/labs/diff`
- Use a central canonical server approach; keep legacy servers retired.
- Enforce client-server separation: no UI code calls Node or filesystem modules directly.
- Wire student-facing lab UI features (export, self-grade) to the new endpoints.

These fixes lay the foundation for reliable guided lab assignments and backend processing.

### Unified Project & Persistence

Refactor project data management so every circuit or lab is fully savable/loadable across sessions:

- Use a unified project store and standardized formats (e.g. `.rbproj`, `.rb-lab.zip`) so 2D, 3D, and backend share structures.
- Robust import/export:
  - Save to virtual filesystem
  - Export as shareable file
- Evidence/capsule bundle creation is deterministic and includes required metadata (lab ID, circuit snapshot, results).
- Add round-trip tests: export then re-import yields identical circuit state.

This guarantees students can save work, submit lab bundles, and later reopen them without data loss.

### FPGA/Hardware Bridge Integration

Harden deployment architecture for real hardware:

- Define a clear app <-> local bridge contract (HTTP or WebSocket per Bridge spec) for:
  - Device discovery
  - Bitstream programming
  - Live I/O monitoring
- Ensure Basys-3 FPGA flow is complete and error-tolerant:
  - Verilog generation
  - Vivado bitstream build (CLI)
  - JTAG programming
  - UI progress updates for long operations
- Integrate Arduino workflow as described in docs:
  - Upload firmware sketch
  - Live mode toggling
- All hardware actions fail gracefully with student-friendly errors (e.g. "Bridge offline" when agent isn't running).

By the end of this phase, every circuit is exportable to Verilog and (when hardware is available) flashable to an FPGA/Arduino with one click.

### State Management & Performance Audit

Audit client state (Zustand stores + React integration):

- Fix patterns that cause infinite loops (e.g. getSnapshot loop).
- Apply selector memoization/stable refs broadly to prevent re-render storms.
- Ensure no memory leaks (unsubscribe on unmount; reset stores when windows close).
- Enforce architectural invariants ("UI purity": no Node-specific imports in frontend) via linting.

Solidifying state management prevents subtle bugs and provides a stable base for feature work.

## Phase 2: Simulation & Hardware Pipeline Robustness

### Phase 2 Tracker

- [ ] Deterministic tick engine: repeatability tests + UI controls stable (pause/step/run/Hz)
- [ ] Combinatorial loop detection: clear error/warning path, no hangs
- [ ] Probes/inspector: stable live updates at speed (no dropped samples for moderate circuits)
- [ ] Wire tracing: net highlight consistency across 2D/3D (tick-synced animations if enabled)
- [ ] Save/load + undo/redo reliability: edge cases covered, auto-save and crash recovery verified
- [ ] SIM <-> HW live mode: robust bridge disconnect handling + student-friendly errors
- [ ] Gate: `pnpm -r build` + relevant unit/integration tests

### Deterministic Tick-Based Simulation

Strengthen the core simulation engine so it's 100% deterministic and controllable:

- Ensure a pure `CircuitEngine.tick()` and a scheduler (`TickEngine`) as per ADR.
- Verify repeatability: same circuit + same input sequence -> identical outputs.
- Implement simulation controls:
  - Speed control (1-60 Hz)
  - Pause/resume
  - Single-step clock cycle
- UI reflects current tick/time and controls work without glitches.

### Combinatorial Loop Handling

Prevent infinite propagation within a tick by detecting combinatorial feedback loops:

- Detect loops (output feeding back to input without clocked element/delay).
- Require explicit delay nodes/clocked elements for feedback paths.
- On detection:
  - Halt with clear error, or
  - Auto-insert a virtual delay element (if permitted by design)
- Provide student-friendly warning (e.g. "Feedback loop detected - add a Delay component").

### Enhanced Simulation Instruments (Probes & Tracing)

Make probe tools, inspectors, and signal history tracing reliable during simulation:

- Fast probe attach workflow (click net/wire to attach analyzer).
- Live instrument panel updates (waveform/digital readouts).
- Oscilloscope/SignalScope performance:
  - Capture at speed without lag
  - Buffering tuned to avoid frame drops at 60 Hz for moderate circuits
- Probe management UI:
  - Naming signals
  - Visibility toggles
  - Removing probes
  - Sync with circuit state
- Property inspector:
  - Shows current logic state
  - Allows editing component configuration
  - Updates in real time while running

### Wire Highlighting & Traceability

Improve wire tracing UX across 2D and 3D:

- Hover/selection highlights an entire net across schematic + 3D view.
- Optional logic-level color coding (e.g. highlight for logic "1").
- Signal propagation animation in 3D:
  - Driven by simulation tick count (not wall-clock time)
  - Preserves determinism

### Save/Load and Undo Reliability

Solidify history/snapshots and persistence:

- Undo/redo covers all edit operations without corrupting state.
- Complex edits batch into logical history entries without partial connections.
- Auto-save periodically (e.g. every 30s) to localStorage/IndexedDB to prevent data loss.
- Crash recovery offers restore of last circuit state.
- Export/share formats re-import exactly:
  - Custom chips
  - Probe placements
  - Recorded simulation traces

### Robust Hardware Mode & Live I/O

Make SIM <-> HW mode switching seamless:

- Map circuit I/O to physical I/O (switches/LEDs) and toggle modes.
- In HW mode, physical board drives app inputs; board outputs are read back into app.
- Continuous synchronization (polling or event-driven bridge updates).
- Automatic fallback to simulation with clear alert if bridge/device disconnects.
- Use the Student Error Message Matrix for actionable error text.

## Phase 3: UI Reliability, Performance, and Stability

### Phase 3 Tracker

- [ ] Windowing stability: focus/z-index/minimize/maximize contracts verified (smoke checklist)
- [ ] React stability: no infinite update depth issues; render storm detector clean on key apps
- [ ] Performance: 2D/3D rendering gated by visibility; performance mode works
- [ ] Error handling: Error Boundary verified; student-friendly errors replace raw exceptions
- [ ] Cross-browser sanity: Chrome/Firefox/Edge smoke pass (documented)
- [ ] Gate: `pnpm -r build` + selected Playwright/Vitest smoke gates

### Windowing and OS Polishing

Polish the RedByte OS shell for professional window/app management:

- Fix focus/z-index/Alt+Tab inconsistencies.
- Sensible default window sizes/positions; remember last position on reopen.
- Subtle window animations (minimize/restore/focus change).
- UI polish (taskbar, icons, context menus): no placeholder assets, no overlapping text.
- Verify across screen sizes/browsers; ensure scaling works (high-DPI CSS fixes).

### Eliminate React Rendering Glitches

Systematically hunt and eliminate React rendering issues:

- Use dev tools (e.g. render storm detector) to identify hot components.
- Fix causes: unstable dependencies, effects writing state in loops, selector churn.
- Apply Zustand selector caching where needed to avoid Maximum update depth errors.
- Add dev-only guards (e.g. warn if a component renders >N times per second).

### Optimized Rendering & Frame Rate

Improve render performance for both 2D and 3D:

- 2D canvas:
  - Draw only what changed (dirty rectangles) or memoize React SVG trees
- 3D:
  - Instanced rendering for large object counts (wires, LEDs)
  - Pause render loop when hidden/inactive
- Add a "performance mode" toggle:
  - Disable heavy effects
  - Option to turn off 3D entirely
- Target smooth 60 FPS for small/medium circuits; degrade gracefully for large circuits.

### Error Handling & Logging

Strengthen error boundaries and logging:

- Verify global Error Boundary catches failures across components; Reload truly resets app state.
- Add error reporting (Sentry or custom endpoint) for stack traces + contextual state (with privacy considerations).
- Replace raw errors with student-friendly messages per the Error Matrix (e.g. synthesis failures show actionable guidance).

### Cross-Platform and Browser Testing

Verify behavior across environments:

- Browsers: Chrome, Firefox, Edge (and Safari if Mac support intended).
- OS: Windows, Mac, Linux (especially for Bridge connectivity + file downloads).
- High-DPI devices; tablet/touch if supported.

## Phase 4: Comprehensive Testing & Continuous Integration

### Phase 4 Tracker

- [ ] Unit tests: core logic engine + tick engine + export utilities (deterministic fixtures)
- [ ] Integration/E2E: lab workflow + key UI flows covered (headless)
- [ ] Visual regression: critical UI states baselined and diffed in CI (if adopted)
- [ ] CI gates enforced: `pnpm -r build`, `pnpm agent:verify`, `pnpm ops:student-export-fixture-test`
- [ ] Gate: CI configuration green and blocking merges

### Unit Test Coverage

Build unit tests for critical deterministic logic:

- CircuitEngine:
  - Gate truth tables
  - Flip-flop behavior
  - Tick progression
- TickEngine:
  - start/pause/step timing
- Utilities:
  - Netlist generation
  - Verilog export
  - Lab data formats

Include edge cases (empty circuits, maximum supported nodes) and aim for high coverage on core logic.

### Integration & E2E Testing

Expand tests for user flows and integration points:

- Headless UI tests: build circuit, wire gates, run simulation, attach probe, verify outputs.
- Lab submission tests: export evidence, run grading pipeline, verify results.
- Hardware loop tests with stubbed bridge mode (e.g. dry-run) to simulate discovery/programming.

### Visual Regression Testing

Add screenshot-based regression tests for critical UI states:

- Desktop loaded
- Sample circuit views
- 3D view with sample circuit
- Lab instruction layouts
- Instrument panels

Compare against baselines to catch CSS/layout regressions automatically.

### Continuous Integration Pipeline

Integrate tests into CI on each PR:

- Build: `pnpm -r build`
- Agent verification gate: `pnpm agent:verify`
- Export fixture gate: `pnpm ops:student-export-fixture-test`

Make CI blocking for merges; optionally add deployment previews gated on green CI.

### Continuous Delivery & Monitoring

Set up staging deployments + production monitoring:

- Auto-deploy merges to a QA/staging site.
- Versioning via git tags; app displays version string.
- Document rollback procedures.
- Monitor runtime errors and uptime; optionally track usage analytics for feature adoption.

## Phase 5: UX Design Polish & Cleanup

### Phase 5 Tracker

- [ ] Visual consistency sweep: design system alignment across apps (no placeholder UI)
- [ ] Workflow friction audit: shortcuts, tooltips, guidance, clearer long-operation progress
- [ ] Notifications/messages: student-friendly, consistent, actionable
- [ ] Cleanup: remove deprecated paths/TODOs; docs updated; license/attribution audit
- [ ] Gate: full regression smoke pass + `pnpm -r build`

### Refine Visual Design & Layout

Standardize UI styling and refine aesthetics:

- Consistent color schemes, fonts, component styles.
- Polished circuit canvas (grid background, icons, transitions).
- 3D view aesthetics: quality models/lighting; 3D should impress as well as function.
- Add Help/tutorial overlay for first-time users.

### Streamline User Workflows

Reduce friction in common workflows:

- Quick-add palette + keyboard shortcuts for building circuits.
- Clear post-programming success feedback; guide users into hardware live I/O mode.
- Responsive lab layout: instructions side-by-side with editor.
- Tooltips and context-sensitive hints.

### Improve Feedback and Notifications

Make feedback consistent and student-friendly:

- Toasts for save/export/program actions.
- Clear messages for invalid actions (e.g. output-to-output connections).
- Progress indicators for long operations (bitstream build status updates).

### Final Code Cleanup

Before declaring v1.0:

- Remove deprecated code paths, TODOs, and dev hacks.
- Clean up feature flags (default off; documented if kept).
- Run linters/formatters and fix inconsistencies.
- Update documentation (README, manual, deployment guide).
- Audit licenses/attributions for third-party assets.
- Full regression pass using smoke test checklist; add tests for recently added features.

## Summary

By executing these phases, RedByte will evolve from preview-quality to a robust, production-ready v1.0 platform. The end state is a stable environment where students can design, simulate, debug, and deploy digital logic circuits to real hardware with confidence that the system is reliable, accurate, and easy to use.

## Sources (Repo-Local)

- RedByte Product Surfaces & 3D integration: [PRODUCT_SURFACES.md](./PRODUCT_SURFACES.md), [INTERACTION_CONTRACT.md](./INTERACTION_CONTRACT.md)
- ECE Lab workflows and lab-ready plan: [lab-ready-plan.md](./lab-ready-plan.md), [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)
- Tick-based simulation ADR: [adr-0002-logic-engine-ticks.md](./specs/adrs/adr-0002-logic-engine-ticks.md)
- Snapshot loop fix / selector stability notes: [SNAPSHOT_LOOP_FIX.md](../SNAPSHOT_LOOP_FIX.md), [zustand-selectors.md](./zustand-selectors.md)
- Hardware workflow references: [RB_FPGA_MVP_SPEC.md](./RB_FPGA_MVP_SPEC.md), [fpga-validation-guide.md](./fpga-validation-guide.md), [fpga-merge-review-checklist.md](./fpga-merge-review-checklist.md)
- Student-friendly error text: [ERROR_MESSAGE_MATRIX.md](./ERROR_MESSAGE_MATRIX.md), [TROUBLESHOOTING_MATRIX.md](./TROUBLESHOOTING_MATRIX.md)
- OS reliability and smoke tests: [OS_QA_CHECKLIST.md](./OS_QA_CHECKLIST.md), [playground-ux-smoke-test.md](./playground-ux-smoke-test.md)
- CI/release notes and build gates context: [V1_DEPLOYMENT_SUMMARY.md](./V1_DEPLOYMENT_SUMMARY.md)
