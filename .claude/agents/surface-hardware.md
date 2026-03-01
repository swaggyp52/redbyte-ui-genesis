# Agent Bootstrap: HardwareSurface

## Domain

HardwareSurface is the IDE surface responsible for FPGA board connection, LED/switch/button simulation, hardware bring-up validation, and proof bundle generation. It bridges the software simulation runtime with the physical Basys 3 board and provides three distinct operational modes.

---

## Key Files

| Purpose | Path |
|---|---|
| Main surface component | `packages/rb-apps/src/apps/ide/surfaces/HardwareSurface.tsx` |
| IO bus hook (sw/ld/btn state) | `packages/rb-apps/src/apps/ide/ioBus.ts` |
| 2D board render component | `packages/rb-apps/src/apps/ide/components/HardwareBoard2D.tsx` |
| Board signal context | `packages/rb-apps/src/apps/ide/BoardSignalContext.ts` |
| Surface layout wrapper | `packages/rb-apps/src/apps/ide/components/IdeSurfaceLayout.tsx` |
| IDE primitive components | `packages/rb-apps/src/apps/ide/components/IdePrimitives.tsx` |
| Surface layout primitives | `packages/rb-apps/src/apps/ide/components/SurfaceLayoutPrimitives.tsx` |
| Project health type | `packages/rb-apps/src/apps/ide/projectHealth.ts` |
| Runtime sim state type | `packages/rb-apps/src/apps/ide/projectRuntime.ts` |
| 3D scene entry point | `packages/rb-logic-3d/src/Lab3DScene.tsx` |
| 3D package exports | `packages/rb-logic-3d/src/index.ts` |
| Board profile types | `packages/rb-board-profiles/src/types.ts` |
| Board profile loader | `packages/rb-board-profiles/src/loadBoardProfile.ts` |
| Basys 3 profile JSON | `packages/rb-board-profiles/profiles/basys3.json` |
| Arduino profile JSON | `packages/rb-board-profiles/profiles/arduino.json` |

---

## Architecture Notes

### Three HW Modes

`HwMode` is a union type `'live' | 'bringup' | 'proof'`, stored in local state as `hwMode`. Each mode controls which dock panel, inspector section, and board overlay are rendered. The mode tab bar lives in the `ide-hw-mode-toggle` div. The 3D toggle is a fourth button in that same bar and is orthogonal to mode — `show3D` can be true in any mode.

```
live    → Live Monitor dock   + Signal Log inspector
bringup → Bring-Up dock       + Step Result + Assertion Log inspector
proof   → Proof Bundle dock   + Assertion Summary + Expected Behavior inspector
```

Switching modes via the tab buttons calls `setShow3D(false)` and `setHwMode(m)` atomically so that the 3D view always collapses when switching modes.

### Show3D State and Lab3DScene

`show3D: boolean` is local component state, default `false`. When `true`, a `div.ide-hw-3d-wrap` is conditionally rendered containing `<Lab3DScene />`. The `Lab3DScene` is imported from `@redbyte/rb-logic-3d` (package `packages/rb-logic-3d`).

```tsx
{show3D && (
  <div className="ide-hw-3d-wrap" data-testid="ide-hw-3d-viewport">
    <Lab3DScene
      leds={ledsBitmask}
      switches={switchesBitmask}
      buttons={buttonsBitmask}
      mappedPins={mappedPinNames}
      onSwitchToggle={handle3dSwitchToggle}
      onButtonPress={handle3dButtonPress}
      onButtonRelease={handle3dButtonRelease}
      width="100%"
      height="100%"
    />
  </div>
)}
```

`Lab3DScene` wraps `Rb3DViewport` (Three.js canvas) and `Basys3Board3D` (the 3D mesh). Its camera is fixed at position `[0, 16, 13]` targeting `[0, 0, 1]`.

### Bitmask Memos

Three `useMemo` calls convert `ioBus.state` bit arrays into packed integers for `Lab3DScene`:

```ts
// LD0 = bit 0, LD15 = bit 15 — 16-bit integer
const ledsBitmask = useMemo(
  () => ioBus.state.ld.reduce<number>((m, b, i) => m | (b << i), 0),
  [ioBus.state.ld]
);

// SW0 = bit 0, SW15 = bit 15 — 16-bit integer
const switchesBitmask = useMemo(
  () => ioBus.state.sw.reduce<number>((m, b, i) => m | (b << i), 0),
  [ioBus.state.sw]
);

// BTNC=bit 0, BTNU=bit 1, BTNL=bit 2, BTNR=bit 3, BTND=bit 4 — 5-bit integer
const buttonsBitmask = useMemo(
  () => ioBus.state.btn.reduce<number>((m, b, i) => m | (b << i), 0),
  [ioBus.state.btn]
);
```

`mappedPinNames` is a separate memo that extracts the `label` strings from `mappingRows` where `pin` is non-empty — these are shown as teal-highlighted components in the 3D board.

### useIoBus Hook

`useIoBus` lives in `ioBus.ts`. It consumes `ioRows` (filtered from `mappingRows` where `nodeId` is present), `runtimeSim`, and `setInput`. It produces:

- `state.sw[0..15]`, `state.ld[0..15]`, `state.btn[0..4]` — current `Bit` values read from sim signals
- `actions.setSwitch(i, v)`, `actions.toggleSwitch(i)`, `actions.setButton(i, v)` — write to sim inputs
- `meta.swNodeIds[0..15]`, `meta.ldNodeIds[0..15]`, `meta.btnNodeIds[0..4]` — node ID strings or `null`

Label matching uses regex: `SW_RE = /^SW(\d+)$/i`, `LD_RE = /^LD(\d+)$/i`, `BTN_RE = /^BTN([A-Z]+)$/i`. Button ordering constant: `BTN_LABELS = ['BTNC', 'BTNU', 'BTND', 'BTNL', 'BTNR']`.

### FPGA Bridge Endpoints

The surface does not call the bridge directly — that is the responsibility of the runtime/project layer. The known bridge API surface is:

| Endpoint | Purpose |
|---|---|
| `GET /devices` | Enumerate connected FPGA boards |
| `POST /program` | Flash bitstream to board |
| `POST /run` | Start execution on board |
| `GET /stream` | SSE stream of live signal values |
| `POST /stop` | Halt board execution |

Do not add bridge calls inside `HardwareSurface` or `useIoBus`. Bridge integration belongs in `projectRuntime.ts` or a dedicated bridge service layer.

### BoardProfile Type

Defined in `packages/rb-board-profiles/src/types.ts`:

```ts
interface BoardProfile {
  schemaVersion: string;   // Must be "1.0"
  id: string;              // e.g. "basys3"
  name: string;            // e.g. "Digilent Basys 3"
  vendor: string;          // e.g. "Xilinx"
  fpga: string;            // e.g. "Artix-7 XC7A35T"
  components: {
    leds:     BoardComponent[];  // 16 entries for Basys 3
    switches: BoardComponent[];  // 16 entries for Basys 3
    buttons:  BoardComponent[];  // 5 entries for Basys 3
  };
}

interface BoardComponent {
  id: string;              // e.g. "LED0", "SW3", "BTNC"
  pin: string;             // Physical FPGA pin e.g. "U16"
  type: 'input' | 'output';
  label?: string;          // Human label, optional (buttons use it: "Center", "Up", etc.)
}
```

Profiles are JSON files in `packages/rb-board-profiles/profiles/`. Load them with `loadBoardProfile(id: string)` from `packages/rb-board-profiles/src/loadBoardProfile.ts`. Adding a new board requires only a JSON file — no code changes. Schema version must be `"1.0"` or validation throws.

### HardwareSurfaceProps Interface

```ts
interface HardwareSurfaceProps {
  projectName: string;
  expectedBehavior: string;
  mappingRows: HardwareMappingRow[];       // Pin mapping table rows
  expectedIoRows: Array<{
    signal: string;   // e.g. "LD0", "LD[3]"
    tick: number;
    expected: string; // "0" or "1"
  }>;
  vectorsCount: number;
  health: ProjectHealth;
  runtimeSim?: RuntimeSimState;
  onSimSetInput?: (nodeId: string, v: 0 | 1) => void;
  onGenerateBringUpVectors: () => void;
  onOpenExport: () => void;
  onOpenVerify: () => void;
  onGoToDesign?: () => void;
}
```

### HardwareMappingRow Interface

```ts
interface HardwareMappingRow {
  id: string;
  nodeId?: string;      // Undefined if not yet linked to a design node
  label: string;        // Signal label — matched against SW/LD/BTN patterns
  direction: 'in' | 'out';
  pin: string;          // Physical pin name; empty string means unmapped
  required: boolean;
}
```

### Confidence Score (Proof Mode)

Five boolean checks, each worth 20 points:

1. Clock mapped (label matches `/clk|clock|clk100mhz/i` with a non-empty pin)
2. Outputs mapped (any `direction === 'out'` row with a non-empty pin)
3. Vectors generated (`vectorsCount > 0`)
4. All assertions pass (`hasAssertionData && assertionFailCount === 0`)
5. Verify passed (`health.lastVerify?.status === 'pass'`)

Score = `Math.round((passCount / 5) * 100)`.

### Assertion Engine

`hardwareAssertions` cross-references `expectedIoRows` against `sim.trace`. For each row:
- Parses `ld[N]` or `ldN` signal names
- Looks up `ioBus.meta.ldNodeIds[N]` to get the node ID
- Finds the trace sample at `.tick`
- Checks `signals[nodeId]`, `signals[nodeId + '.out']`, `signals[nodeId + '.in']`
- Marks `hasData: false` if no trace sample exists at that tick

Assertions with `hasData: false` are excluded from pass/fail counts (`assertionsWithData`).

Signal change feed (`signalChangeFeed`) scans `sim.trace` for value transitions on mapped IO nodes and returns the last 30 events reversed (most recent first).

---

## Sprint 4 Additions

These items were added in Sprint 4 and are the most recently modified parts of the surface:

1. **`Lab3DScene` import** — `import { Lab3DScene } from '@redbyte/rb-logic-3d'` at line 2
2. **`show3D` state** — `const [show3D, setShow3D] = useState(false)` at line 80
3. **3D toggle button** — the "3D Board" `IdeButton` in the mode toggle bar (after the divider), `testId="ide-hw-mode-btn-3d"`, tone is `'primary'` when `show3D` is true
4. **Bitmask memos** — `ledsBitmask`, `switchesBitmask`, `buttonsBitmask` at lines 123-129
5. **`mappedPinNames` memo** — filters `mappingRows` to non-empty pins and extracts labels, passed as `mappedPins` to `Lab3DScene`
6. **3D interaction callbacks** — `handle3dSwitchToggle`, `handle3dButtonPress`, `handle3dButtonRelease` wrapping `ioBus.actions`
7. **`ide-hw-3d-wrap` container** — conditionally rendered above the 2D board wrap when `show3D` is true

---

## CSS Classes

All hardware surface classes use the `ide-hw-` prefix. Classes in active use:

| Class | Element |
|---|---|
| `ide-hw-callout` | Top info strip (project name, pin count, verify status) |
| `ide-hw-callout-label` | "Simulating:" label |
| `ide-hw-callout-name` | Project name span |
| `ide-hw-callout-sep` | Middle-dot separator |
| `ide-hw-callout-pass` | Green verify status |
| `ide-hw-callout-fail` | Red verify status |
| `ide-hw-mode-toggle` | Mode tab bar container |
| `ide-hw-mode-divider` | Visual separator before 3D button |
| `ide-hw-tick-badge` | Tick counter badge (shown when `sim.tick > 0`) |
| `ide-hw-3d-wrap` | Container for `Lab3DScene` |
| `ide-hw-board-wrap` | Container for 2D board + proof verdict; gains `is-proof` modifier |
| `ide-hw-board-inner` | Inner wrapper for `HardwareBoard2D` |
| `ide-hw-live-design-link` | "Open in Design" button container |
| `ide-hw-bringup-step` | Bring-up step panel |
| `ide-hw-step-header` | Step counter + tick row |
| `ide-hw-step-counter` | "Step N of M" text |
| `ide-hw-step-tick` | `t{tick}` code element |
| `ide-hw-step-instruction` | SW=value instruction text |
| `ide-hw-step-nav` | Prev/Next navigation row |
| `ide-hw-assert-summary` | Assertion pass/fail summary bar |
| `ide-hw-assert-fail-count` | Red fail count text |
| `ide-hw-assert-pass-count` | Green pass count text |
| `ide-hw-assert-log` | Scrollable assertion log container |
| `ide-hw-assert-formal-row` | Row in the assertion log |
| `ide-hw-assert-formal` | `<code>` for a single assertion; modifiers: `is-pass`, `is-fail`, `is-nodata` |
| `ide-hw-proof-assert-ok` | Green proof-valid assertion code |
| `ide-hw-proof-assert-fail-note` | Red failure note paragraph |
| `ide-hw-confidence-list` | Confidence check list container |
| `ide-hw-confidence-row` | Single confidence check row; modifiers: `is-pass`, `is-pending` |
| `ide-hw-confidence-icon` | Check/circle icon span |
| `ide-hw-confidence-label` | Check label span |
| `ide-hw-cert-slab` | Certificate key-value block (proof dock) |
| `ide-hw-cert-row` | Single cert row |
| `ide-hw-cert-key` | Uppercase key label |
| `ide-hw-cert-val` | Code value |
| `ide-hw-proof-verdict` | Big verdict overlay; modifiers: `is-pending`, `is-valid`, `is-invalid` |
| `ide-hw-proof-verdict-label` | "PROOF VALID" / "PROOF INVALID" / "PROOF PENDING" text |
| `ide-hw-proof-verdict-meta` | KV rows below verdict label |
| `ide-hw-proof-verdict-row` | Single meta row in verdict |
| `ide-hw-event-log` | Signal change feed container |
| `ide-hw-event-row` | Single change event row |
| `ide-hw-event-tick` | `t{N}` tick code |
| `ide-hw-event-dir` | Direction arrow; modifiers: `is-input`, `is-output` |
| `ide-hw-event-label` | Signal label code |
| `ide-hw-event-change` | `0→1` value change span |

CSS is in `packages/rb-apps/src/apps/ide/ide-root.css`.

---

## Do / Don't Rules

### Determinism Constraints

- **Do** keep all memos pure: `ledsBitmask`, `switchesBitmask`, `buttonsBitmask`, and `mappedPinNames` are derived entirely from `ioBus.state` and `mappingRows`. No side effects inside memo callbacks.
- **Do not** read `Date.now()`, `Math.random()`, or any non-deterministic source inside a memo or render path.
- **Do not** store derived signal state in `useState` — derive it with `useMemo` from sim state.

### Toolchain / Bridge Separation

- **Do not** call FPGA bridge endpoints (`/devices`, `/program`, `/run`, `/stream`, `/stop`) directly from `HardwareSurface` or `useIoBus`. These calls belong in `projectRuntime.ts` or a dedicated bridge service.
- **Do** pass bridge-derived state downward via `runtimeSim?: RuntimeSimState` and callbacks like `onSimSetInput`.
- **Do** pass action triggers upward via `onGenerateBringUpVectors`, `onOpenExport`, `onOpenVerify` — the surface does not own those operations.

### Build-Time vs Run-Time Logic

- **Do not** mix Vivado/synthesis toolchain logic (XDC constraint generation, bitstream programming) with runtime simulation logic (trace evaluation, assertion checking) inside this surface.
- Board profiles (`BoardProfile`) are static data — they describe physical pin constraints. They are build-time artifacts. Do not use a `BoardProfile` to drive runtime signal evaluation.
- `ioBus` is a runtime concern — it reads from `RuntimeSimState.signals` and `RuntimeSimState.inputs`. Keep it runtime-only.

### Component Isolation

- **Do not** add network requests, file I/O, or async operations inside `HardwareSurface` or `useIoBus`.
- `HardwareBoard2D` renders the 2D board. `Lab3DScene` renders the 3D board. Do not duplicate board rendering logic between them.
- `show3D` and `hwMode` are independent state variables. Do not conflate them — a future sprint may need 3D view within a specific mode.

### BoardProfile Rules

- Board profiles must use `schemaVersion: "1.0"`. `validateBoardProfile` will throw on any other version.
- Component `id` values must be unique within each category (`leds`, `switches`, `buttons`). The validator enforces this.
- Add new boards by adding a JSON file to `packages/rb-board-profiles/profiles/` and registering it in `BUILT_IN_PROFILES` in `loadBoardProfile.ts`. No TypeScript constant definitions needed.

### CSS Conventions

- All new classes for this surface must use the `ide-hw-` prefix.
- State modifier classes use the `is-` prefix (e.g., `is-pass`, `is-fail`, `is-pending`, `is-proof`).
- Do not add inline styles to `HardwareSurface` — use CSS classes in `ide-root.css`.

### Testing

- `data-testid` attributes follow the pattern `ide-hw-{descriptor}`. New interactive elements must include a `testId` prop or `data-testid` attribute.
- `HARDWARE_EMPTY_SIM` is the fallback when `runtimeSim` is undefined — tests that do not exercise live sim should rely on this default's known shape (`tick: 0, running: false`, empty `inputs`/`signals`/`trace`).
