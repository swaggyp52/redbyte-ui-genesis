# RedByte Platform Audit & Remediation Plan
**Canonical Guidance Document** | Effective: February 2, 2026

This document outlines the systematic audit and remediation of the RedByte Platform across six integrated phases. This is the authoritative guide for all implementation work.

---

## Phase 1: Robust Hardware Integration

### Basys 3 FPGA Support
- Implement a complete FPGA deployment workflow using existing Verilog generator and Vivado integration
- Synthesize student's 4-bit adder design and program Basys 3 board via USB-JTAG
- Invoke Vivado in batch mode (as stubbed in rb-fpga-bridge) to generate bitstream
- Call programBitstream() utility to load bitstream onto the board
- Ensure .xdc pin constraints (already generated in CodeView) correctly map:
  - SW0–SW7 to input pins
  - LD0–LD4 to output LEDs for adder lab
- Include user feedback in UI (progress spinner, success/error toast) during synthesis and programming

### FPGA Telemetry & Control
- Extend serial protocol on Basys 3 to support output driving
- Current bridge reads switch/button states but doesn't send LED updates (Basys3Backend.setPins() is a no-op)
- Define command (e.g., `SET LED <value>`) or embed LED bits in telemetry packet
- PC can send computed outputs to FPGA when in simulation bridge mode
- Update FPGA's UART firmware or provide "passthrough" bitstream
- In Hardware (Bridge) mode: flipping virtual switch in RedByte toggles physical Basys switch or drives FPGA inputs
- Physical LED states reported back, keeping 3D lab view and hardware in sync
- In programmed mode: FPGA runs user's adder logic natively; RedByte relies on board's LEDs for output verification

### Arduino Uno Integration
- Finalize end-to-end workflow for Arduino
- Bridge already supports flashing sketches via arduino-cli
- Package default firmware (e.g., RedByte I/O protocol sketch)
- Ensure Upload button in Hardware panel writes firmware to Uno
- Firmware must handle GET/SET/PIN commands for continuous monitoring and real-time output driving
- Improve auto-detection:
  - Use BridgeDevice info (manufacturer, VID/PID) to distinguish Arduino models
  - Display friendly names (currently any FTDI device labeled as Basys3)

### Connection Stability
- Harden HardwareClient class reconnect logic
- Implements retries and background polling – extend with UI indicators:
  - "Connecting…" state
  - "Reconnecting" state
  - Error states with messaging
- Test scenarios:
  - Bridge agent not running
  - Device unplugged mid-session
  - Graceful recovery or informative messages to student
- Implement Auto-Adopt cleanup: automatically remove or disable orphaned FPGA/Arduino nodes in 3D lab when hardware disconnects
- See TODO in HardwareAutoAdopt.tsx

### Documentation & Guides
- Update lab setup instructions to reflect new hardware flow
- Example: Lab 2 requires "Deploy to Basys3" button which compiles and loads design onto board
- Emphasize one-time driver/tool installs (Vivado, Arduino CLI)
- Automate as much as possible in PowerShell bootstrap script
- Ensure "university-grade" hardware experience: students seamlessly go from design to physical test without manual file wrangling

---

## Phase 2: Simulation Engine & Signal Visualization

### Deterministic Propagation
- Confirm logic simulator (rb-logic-core and rb-logic-3d) uses:
  - Deterministic, event-driven propagation for combinational logic
  - Consistent tick for sequential logic
- Current tick rate: 50 ms (real-time appearance for user interactivity)
- Enable faster-than-real-time stepping when running headless checks
- Dual-mode approach:
  - Interactive mode: preserve 50 ms delay for responsiveness
  - "Run Test" function: temporarily disable delay and iterate to completion for automated test benches

### Waveform Viewing (Oscilloscope)
- Enhance Oscilloscope tool for signal waveforms over time
- RedByte already records signal history (traceBuffer in hardwareStore) and logs simulation events
- Build on existing OscilloscopeView to:
  - Select any wire or pin as probe
  - Plot value over simulation ticks
  - Add pan/zoom controls
  - Place cursors or measure periods/delays (professional tool features)
  - Implement trigger settings (rising/falling edge on specific signal) to auto-pause simulation
- UI has placeholders for triggers and cursors
- Mimic capabilities of DigitalJS and Vivado waveforms: single-step, set triggers, examine signal timings

### Truth Tables and Test Vectors
- Introduce Combinational Analysis feature (inspired by Logisim's truth table tool)
- Could live in "Logic Analyzer" app or side panel
- Utilize LabEvaluator and checkpoint system:
  - TruthTableCheckpoint type exists in schema
  - TestVectorCheckpoint type exists in schema
- Allow students to:
  - Define input combinations and expected outputs for subcircuit
  - Run simulation for each combination
  - Report pass/fail (similar to unit tests)
  - Get immediate feedback
- Internally: leverage evaluateAtTick() to get circuit outputs at stable state for each vector
- UI representation: interactive 0/1 cells, highlight discrepancies in red/green

### Performance & Accuracy
- Profile simulation with larger circuits to identify bottlenecks
- Three.js visualization slows with many components:
  - Consider throttling re-renders (e.g., update graphics every N ticks or when values change, not every 20ms)
- Ensure logic evaluation efficiency:
  - Use topological sorting or dependency graphs
  - Only recompute affected nodes each tick
- Add support for tri-state and high-impedance if 3-state buses are in use
- Verify propagation delays (if modeled) are consistent with expectations
- For sequential logic:
  - Verify flip-flops and registers trigger on correct clock edges
  - Handle race conditions properly
  - May need explicit tick ordering for synchronous elements

### Responsive Waveform UI
- Offload waveform rendering to WebWorker or use Canvas/WebGL for performance with long runs
- Oscilloscope must handle at least several thousand samples per signal
- Implement downsampling or rolling window:
  - Current code: MAX_SAMPLES = 500 – make user-configurable or auto-expand if memory allows
- Test fast signal toggling (e.g., 4-bit counter at 1 Hz clock):
  - Ensure plotted waveform matches reality
  - Don't drop edges
  - Consider slow sampling interval or interpolation for visual smoothness

---

## Phase 3: Export/Import and Data Fidelity

### Reliable Project Export
- Export system mostly in place: creates .rbx.zip with manifest, capsule, events, etc.
- Focus on ensuring round-trip fidelity:
  - Student exports project
  - Deletes in-app
  - Re-imports file
  - Continues seamlessly
- Implement TODO in handleImportProject: load imported circuit into UI
  - Open in Logic Playground or Virtual Lab
  - Convert saved CircuitV1 JSON back to runtime Circuit objects (via adapters)
  - Initialize all relevant stores (lab state, history, etc.)
- Write integration tests:
  - Save and load complex circuit (with subcircuits, custom labels, etc.)
  - Catch serialization gaps

### Integrity Verification
- Leverage existing SHA-256 hashing to detect tampering
- When importing, if capsule's evidenceHash doesn't match contents:
  - Flag to user (e.g., "Integrity Check Failed: Project may have been modified")
  - Use fields already in manifest and capsule
  - Ensure evidenceHash populated during export (currently a TODO)
- For valid imports: display "✅ Integrity verified" toast (already implemented)
- Gives TAs confidence student submissions are unaltered

### Human-Readable Exports
- Ensure README.md in export is informative:
  - Summarize lab name, student, date
  - Include self-check results (pass/fail counts)
  - Expand to table of student's key connections
  - Include circuit screenshot if possible
- JSON is source of truth for re-import
- Human-readable summary helps when reviewing offline
- Consider mini renderer: output SVG of circuit
  - DigitalJS can export circuits to SVG
  - RedByte could reuse 2D canvas logic to draw to off-screen SVG context

### Backward Compatibility and Schema Evolution
- Include version tags in JSON (manifest has schema_version)
- Handle older versions if any
- Example: if LabProjectV1 changes (new fields for future labs), write migration code so older .rbx.zip files still import correctly
- Maintain changelog of format updates in VERSIONS.md (as specified in FPGA MVP spec)
- For now (v1.0): keep import code flexible
  - Ignore unknown fields
  - Supply defaults for missing ones

### Streamlined Sharing
- Add Export Project option (distinct from "Export Evidence") for general circuit design sharing
- Not tied to lab submission: omits grading vectors
- Saves circuit and user-generated description
- Uses same .rbx.zip structure but focus on portability
- Encourages students to share designs outside lab context (similar to Logisim's .circ files)
- Clear UI labeling:
  - "Export Submission" (with full evidence)
  - "Save Project"
- Both should round-trip without loss

---

## Phase 4: UI/UX Stability and Design

### Polish Interactive Elements
- After recent usability fixes, ensure all controls are responsive
- Test all buttons, dropdowns, sliders for proper event handling:
  - Toolbar icons (undo/redo, zoom, grid toggle) in 2D and 3D editors
  - Right Dock tabs click area (fixed to be more accessible – perform sweep for similar quirks)
  - Modal dialogs (drag or close intuitively)
  - Scrollbars (appear when content overflows)

### Undo/Redo Consistency
- History store in place; node movements and wiring synchronized (no ghost reverts)
- Connect undo/redo actions to:
  - Keyboard shortcuts: Ctrl+Z / Ctrl+Y (or Cmd on Mac)
  - Menu commands
  - historyStore.undo() and .redo()
- Update Edit menu or top bar with "Undo" and "Redo" entries showing action name
  - Example: "Undo Add AND Gate"
- Ensure every state-mutating action calls pushState():
  - Adding a component
  - Deleting
  - Moving
  - Connecting wires
  - Changing pin value
- Test edge cases: undoing component addition with wires attached
  - Wires should be removed too
  - Circuit object model should handle via internal data (unit test advisable)

### Visual Consistency & Themes
- Address cosmetic issues in placeholders audit
- Enable Light Mode support or remove dead code paths forcing dark mode
- If supporting: add theme toggle in settings to switch Tailwind classes
- Unify animation timings across components:
  - Define standard durations for fades, slides in CSS or theme token
  - Replace current mix of 100ms/120ms/140ms
- Use consistent styling for empty states:
  - Show placeholder message with icon when panel has no content
  - Example: "No devices connected" in Hardware panel instead of blank
- Increase z-index of top navigation bar:
  - Dialogs/dropdowns from it appear above other UI
  - Fix TopBar z-index issue

### Error Handling
- Introduce per-app error boundaries
- Wrap each app window (Logic Playground, Virtual Lab, etc.) in React <ErrorBoundary>
- One app error doesn't take down entire RedByte OS
- Display friendly error message within that window
- Option to restart that app
- Log error details to console or file for debugging
- Critical for classroom: one glitch in (e.g.) Inspector doesn't force loss of entire session

### Guidance and Onboarding
- Improve in-app guidance for new users
- Short tooltip/highlight for key UI areas on first Virtual Lab open:
  - "Click here to place components" arrow
  - "Use Oscilloscope to view waveforms" prompt
  - Etc.
- TAs and students may be new to RedByte
- Incorporate "Walkthrough" or tutorial app:
  - Load sample project (like half-adder)
  - Guide step-by-step in building it
  - Similar to Tinkercad's interactive lessons
- Use existing WalkthroughPage.tsx structure to script steps

### Cross-Application Sync
- Finalize unified project store so 2D logic view and 3D lab stay in lockstep
- After Phase 2: student can place/edit components in either view
- Use adapters (toLab2DModel, toVirtualLab3DModel) to propagate changes
- Example: wire two gates in 3D Lab → 2D circuit diagram updates immediately
- Likely means deprecating separate local state in LogicPlaygroundApp in favor of central unifiedProjectStore.currentProject
- Phase 2 unified store work already done – rigorously test:
  - Editing in one representation reflects in other
  - Resolve lingering issues (components doubling, positions resetting)
  - Addressed by state sync fixes (no dual sources of truth)
- With single source of truth:
  - Ensure camera views or UI-specific fields not accidentally serialized
  - Keep project clean

---

## Phase 5: Codebase Sustainability and Quality

### Clean Up Tech Debt
- Tackle list in STALE_AND_PLACEHOLDERS.md systematically
- Remove or update placeholder logic that confuses maintainers or degrades UX:
  - Generate real latency stats for TruthHUD or remove field
  - Connect verification status in TruthHUD to actual lab evaluation result (not hardcoded false)
  - Eliminate duplicate protocol type definitions: use @redbyte/rb-protocol everywhere
  - Ensure bridge agent imports from shared package
  - Strip out old unused code (e.g., commented-out WebSocket in hardwareSessionStore)
- Each small fix makes codebase leaner, easier to maintain
- Crucial as platform scales

### Documentation & Comments
- Maintain up-to-date documentation as features evolve
- Design decisions captured in markdown files (FPGA MVP spec, lab-ready plan)
- Continue this practice:
  - Update spec docs when modifications made
  - Add Changelog for major user-facing changes
- Correct stale comments in code:
  - Example: hardwareClient.ts comments refer to old API schema versions
  - Prevent future confusion
- For complex modules (simulation engine, bridge agent):
  - Add in-line comments explaining non-obvious logic
  - Example: document packet format for Basys telemetry in code, matching spec

### Testing
- Expand automated test suite
- Unit tests exist (122/122 passing after fixes)
- Add tests for new hardware workflows:
  - Simulate full Lab 2 run programmatically
  - Connect mock Basys (perhaps MockBasys3Backend)
  - Flip bits in mock serial input
  - Assert RedByte simulation produces correct outputs
  - Assert export capsule marks hardware.verified = true
- Include end-to-end tests for import/export (Phase 3):
  - Ensure no regression in project serialization
- If possible, integrate CI step that runs on Windows:
  - Vivado/arduino-cli involved
  - Catch environment-specific issues
- Even if full FPGA programming can't be easily CI-tested:
  - Test Vivado invocation command constructed properly given dummy design

### Dependency Audit
- Review package.json for each package
- Update any outdated libraries
- Ensure Three.js, React, Zustand, etc., are stable versions and compatible
- React 19 and Vite 7 used – double-check for breaking changes
- Lock versions as required by deterministic philosophy:
  - No ^ ranges for critical packages (per spec)
- Remove unused dependencies
- Verify license compliance:
  - Will be used in academia
  - Ensure no GPL code (aside from intended, like Logisim's base if any)

### Performance Profiling
- Use profiling tools to monitor CPU and memory usage:
  - Idle vs. heavy use
  - Open complex circuit and simulate for a while
  - Export heap snapshot to check for leaks
- Fix any found leaks:
  - ErrorBoundary will help catch runaway exceptions
  - On app close: ensure intervals or web workers terminated
- Optimize hot spots:
  - Example: useLabStore selector triggers too many React re-renders
  - Consider batching updates or splitting stores

### Future-Proof Architecture
- Plan how new features integrate without ballooning complexity
- Example: supporting additional boards (Arduino Mega, different FPGA)
- Establish plugin-like architecture for hardware backends:
  - Add without modifying core logic
- Current design routes by target string ('arduino-uno', 'basys3')
- Formalize by having registry of supported hardware with capabilities:
  - Similar to BoardCapabilities interface
- Adding new board: implement backend class and update config
- No scattered checks throughout codebase

---

## Phase 6: Leverage Best Practices from Industry Tools

### Feature Parity with Logisim Evolution
- Introduce user-friendly logic analysis features inspired by Logisim:
  - Truth table tool (covered in Phase 2)
  - Combinational circuit generation:
    - Given truth table, suggest minimized gate implementation
  - Support Logisim's "probing" methodology:
    - Click any wire in 2D circuit to see current value
    - Color-coding on wires (green for HIGH, blue for just-changed)
    - Similar to Logisim's live simulation indicators
- Visual cues make debugging circuits easier at a glance

### Advanced Simulation Modes (DigitalJS)
- Take inspiration from DigitalJS: allow HDL integration (future versions)
- Let advanced students import Verilog module into project:
  - Example: ALU or memory controller
  - Simulate alongside graphical components
- DigitalJS shows feasibility of compiling Verilog to simulated circuit in-browser
- RedByte's modular architecture (and existing Yosys-to-DigitalJS pipeline referenced) can be extended:
  - Support "HDL component" node type
  - User provides Verilog code
  - Code synthesized to internal format
- While not immediate: keep extensibility in mind
- Ensure codebase can grow into more advanced territory

### Tinkercad Circuits' Ease of Use
- Strive for plug-and-play simplicity of Tinkercad when connecting hardware virtually
- Tinkercad: run Arduino code and view signals on virtual oscilloscope without setup
- RedByte approach:
  - Bundle Arduino firmware and FPGA "telemetry bitstream"
  - As soon as user connects board and hits "Live", correct firmware/bitstream auto-deployed
  - Requires user confirmation
  - Eliminates manual steps, makes lab setup nearly instant
  - Similar to Tinkercad's virtual hardware
- Continue offering simulation-only mode:
  - For web demo or hardware unavailable
  - Rich experience without physical devices
  - Dual approach ensures no student blocked if hardware forgotten
  - Reward students connecting boards with deeper understanding

### Vivado/Quartus Professional Workflows
- Mirror proven flows of professional FPGA tools in student-friendly way:
  - Project Summary view like Vivado:
    - Show device utilization (gates, LUTs, etc. – approximate by counting components)
    - Timing estimates after synthesis
  - Concept of timing simulation vs. functional simulation:
    - Initially RedByte assumes ideal propagation
    - Eventually allow assigning gate delays
    - Perform post-synthesis timing analysis using actual FPGA timing data
    - Vivado can generate timing reports; parsing could highlight why hardware differs from ideal simulation
  - Simple path to export design to Vivado or Quartus:
    - Generate Xilinx Project TCL or EDIF netlist
    - Students who want to continue in vendor tool can do so
- For import/export:
  - Vivado/Quartus use own project files; RedByte doesn't import those
  - Ensure JSON can convert to VHDL/Verilog means compatibility with any external tool

### Import/Export Strategies
- Continue using portable, text-based format (JSON/ZIP) for designs
- Similar to Logisim's XML and DigitalJS's JSON
- Eases version control and sharing
- Already included in .rbx.zip:
  - Circuit
  - Timeline
  - Evidence
- Keep this philosophy for new features:
  - New component type
  - New lab checklist
  - Include in export
- Consider "Export to PDF" or print feature for documentation:
  - Output circuit schematic
  - Perhaps truth table or waveform snippet
  - Lab reports can include diagrams directly from RedByte

---

## Implementation Schedule

Schedule these phases over coming weeks before Lab 2 deployment:

1. **Start with critical hardware programming and simulation fixes** (Phases 1 and 2)
   - Core functionality must be solid
2. **Then address import/export and UI polish** (Phases 3 and 4)
   - Improve reliability and user experience
3. **Concurrently, chip away at code debt** (Phase 5)
   - Ongoing improvements
4. **Incorporate best-practice features** (Phase 6)
   - As ongoing improvements

---

## Expected Outcome

By following this plan, RedByte will evolve into a stable, comprehensive digital logic platform that rivals the best educational tools:

- **Logisim's ease of logic design**
- **Tinkercad's approachable hardware simulation**
- **Vivado's rigor for real FPGA deployment**

All in one unified system.

---

## Document Status

- **Created:** February 2, 2026
- **Authority:** Canonical guidance document
- **Next Review:** Upon completion of Phase 1
- **Updates:** Modify this file as priorities shift or phases complete
