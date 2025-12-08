# Genesis Specification — Immutable API Contract

**Version:** 1.0.0
**Status:** Immutable
**Last Updated:** 2025-12-08

> This document defines the permanent, immutable API contract for RedByte OS Genesis v1.
> Once published, this specification SHALL NOT be modified. All future versions must create new spec documents.

---

## 1. Core Philosophy

RedByte OS Genesis is a **logic circuit simulator** and **visual programming environment** designed to:

1. **Teach digital logic** from first principles (wires → gates → flip-flops → CPUs)
2. **Enable tinkering** with immediate visual feedback
3. **Scale complexity** from lamp circuits to simple CPUs

### Design Principles

- **Immediate feedback**: Visual circuit state updates in real-time
- **Progressive disclosure**: Start simple (Switch + Lamp), build up to complexity (4-bit Counter, CPU)
- **Shareable by default**: Circuits encode to URL-safe strings
- **Zero install friction**: Runs in browser, boots in <3 seconds

---

## 2. Package Architecture

### 2.1 Monorepo Structure

```
/packages
  /rb-logic-core      — Pure logic engine (no UI, no frameworks)
  /rb-logic-view      — 2D canvas renderer for circuits
  /rb-logic-3d        — 3D visualization layer
  /rb-logic-adapter   — View/Engine adapter utilities
  /rb-shell           — OS shell, windowing, desktop
  /rb-apps            — Built-in applications
  /rb-windowing       — Window management state
  /rb-utils           — Shared utilities (settings, storage)
  /rb-theme           — Theming system
  /rb-tokens          — Design tokens (colors, spacing)
  /rb-primitives      — Base UI components
  /rb-icons           — Icon library
/apps
  /playground         — Main entry point (Vite app)
```

### 2.2 Package Boundaries

**IMMUTABLE RULE**: Packages MUST NOT import from `/apps` or peer packages outside their declared dependencies.

**Dependency Flow**:
```
rb-apps → rb-shell → rb-windowing → rb-primitives → rb-tokens
rb-apps → rb-logic-view → rb-logic-core
rb-apps → rb-logic-3d → rb-logic-core
```

---

## 3. Logic Engine API (`@redbyte/rb-logic-core`)

### 3.1 Core Classes

#### `NodeRegistry`
Singleton registry for node types (gates, switches, lamps).

```typescript
class NodeRegistry {
  static register(type: string, behavior: NodeBehavior): void;
  static get(type: string): NodeBehavior | undefined;
}
```

#### `CircuitEngine`
Evaluates circuit logic.

```typescript
class CircuitEngine {
  constructor(circuit: Circuit);
  setCircuit(circuit: Circuit): void;
  getCircuit(): Circuit;
  tick(): void; // Single logic step
}
```

#### `TickEngine`
Controls simulation speed.

```typescript
class TickEngine {
  constructor(engine: CircuitEngine, hz: number);
  start(): void;
  pause(): void;
  stepOnce(): void;
  setTickRate(hz: number): void;
}
```

### 3.2 Data Schema (v1)

**Circuit**:
```typescript
interface Circuit {
  nodes: Node[];
  connections: Connection[];
}

interface Node {
  id: string;
  type: string;
  position: { x: number; y: number };
  state?: Record<string, any>;
}

interface Connection {
  from: string; // "nodeId:outputPin"
  to: string;   // "nodeId:inputPin"
}
```

**Serialization**:
```typescript
interface SerializedCircuitV1 {
  version: '1';
  nodes: Node[];
  connections: Connection[];
}

function serialize(circuit: Circuit): SerializedCircuitV1;
function deserialize(data: SerializedCircuitV1): Circuit;
```

### 3.3 Built-in Node Types

| Type         | Inputs | Outputs | Description                |
|--------------|--------|---------|----------------------------|
| PowerSource  | 0      | 1       | Always ON                  |
| Switch       | 0      | 1       | Manual toggle (ON/OFF)     |
| Lamp         | 1      | 0       | Visual output              |
| Wire         | 1      | 1       | Pass-through               |
| AND          | 2      | 1       | Logical AND gate           |
| OR           | 2      | 1       | Logical OR gate            |
| NOT          | 1      | 1       | Logical NOT gate           |
| NAND         | 2      | 1       | Logical NAND gate          |
| XOR          | 2      | 1       | Logical XOR gate           |
| Clock        | 0      | 1       | Oscillating signal         |
| Delay        | 1      | 1       | 1-tick delay               |

### 3.4 Composite Node Types

| Type         | Description                          |
|--------------|--------------------------------------|
| RSLatch      | Set-Reset latch (SR flip-flop)       |
| DFlipFlop    | Data flip-flop (edge-triggered)      |
| JKFlipFlop   | JK flip-flop (universal flip-flop)   |
| FullAdder    | 1-bit full adder                     |
| Counter4Bit  | 4-bit binary counter                 |

---

## 4. Circuit Sharing API

### 4.1 URL Encoding

Circuits are shared via URL-safe base64 encoding.

```typescript
interface Circuit {
  gates: any[];
  wires: any[];
  inputs: any[];
  outputs: any[];
  metadata?: Record<string, any>;
}

function encodeCircuit(circuit: Circuit): string;
function decodeCircuit(encoded: string): Circuit;
```

**URL Format**:
```
https://redbyte-os.dev/?circuit={base64-encoded-circuit}
```

**Encoding Rules**:
- JSON → base64 → URL-safe (`+` → `-`, `/` → `_`, remove `=`)
- Future: Compression with pako (gzip) for smaller URLs

### 4.2 Share Flow

1. User clicks "Share" button
2. Circuit serialized to JSON
3. Encoded to URL-safe base64
4. URL copied to clipboard
5. Toast confirms: "Share link copied to clipboard!"

### 4.3 Load from URL Flow

1. URL parameter `?circuit={encoded}` detected on page load
2. Decoded to Circuit object
3. Loaded into engine
4. URL parameter cleared from browser history
5. Toast confirms: "Loaded shared circuit"

---

## 5. Tutorial System API

### 5.1 Tutorial State

```typescript
interface TutorialStep {
  id: number;
  title: string;
  description: string;
  exampleCircuit?: string; // Example ID to load
  docsLink?: string;
}

interface TutorialState {
  step: number;
  active: boolean;
  start(): void;
  next(): void;
  prev(): void;
  stop(): void;
  goToStep(step: number): void;
}
```

### 5.2 Tutorial Steps (v1)

1. **Build a Lamp Circuit** — Wire + Switch + Lamp
2. **Add an AND Gate** — Two inputs, one output
3. **Build a Counter** — 4-bit binary counter
4. **Load a Simple CPU** — Basic CPU architecture

### 5.3 Tutorial UI

- **Overlay**: Positioned card (top-right) with step info
- **Progress Bar**: Gradient indicator (Step X of N)
- **Coach Marks**: Contextual hints ("Click inputs to toggle them")
- **Navigation**: Back, Next, Skip Tutorial buttons

---

## 6. First-Run Experience

### 6.1 Welcome Window

Shown on first visit (localStorage: `rb-os:v1:welcomeSeen`).

**Contents**:
- Welcome message
- Two action buttons:
  - "Explore Studio" → Close window
  - "Open Logic Playground" → Launch app
- "Don't show again" checkbox

**Persistence**:
- Checkbox state saved to `localStorage`
- Window is a standard app (uses windowing system)

---

## 7. Toast Notification API

### 7.1 Toast Store

```typescript
interface Toast {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast(message: string, type?: Toast['type'], duration?: number): void;
  removeToast(id: string): void;
}
```

### 7.2 Toast Behavior

- **Auto-dismiss**: Default 3000ms
- **Click to dismiss**: Click toast to remove
- **Positioning**: Fixed top-right
- **Animation**: Slide-in from right
- **Colors**:
  - Info: Blue (`rgba(59, 130, 246, 0.95)`)
  - Success: Green (`rgba(34, 197, 94, 0.95)`)
  - Warning: Orange (`rgba(251, 146, 60, 0.95)`)
  - Error: Red (`rgba(239, 68, 68, 0.95)`)

---

## 8. Windowing System API

### 8.1 Window State

```typescript
interface WindowState {
  id: string;
  title: string;
  contentId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  focused: boolean;
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
}

interface WindowStore {
  createWindow(props: Partial<WindowState>): WindowState;
  closeWindow(id: string): void;
  focusWindow(id: string): void;
  moveWindow(id: string, x: number, y: number): void;
  resizeWindow(id: string, width: number, height: number): void;
  toggleMinimize(id: string): void;
  toggleMaximize(id: string): void;
  restoreWindow(id: string): void;
  getZOrderedWindows(): WindowState[];
}
```

### 8.2 App Manifest

```typescript
interface RedByteApp {
  manifest: {
    id: string;
    name: string;
    iconId?: string;
    category?: string;
    singleton?: boolean;
    defaultSize?: { width: number; height: number };
    minSize?: { width: number; height: number };
  };
  component: React.ComponentType<any>;
}
```

---

## 9. Theme System API

### 9.1 Theme Variants

- `dark` — Neon Circuit wallpaper (default)
- `light` — Frost Grid wallpaper

### 9.2 Color Tokens

**Primary Palette**:
- Neon Red: `#FF0000` (primary-500)
- Electric Blue: `#0087FF` (primary-600)
- Cyber Purple: `#8B00FF` (primary-700)

**Neutral Palette**:
- Gray 50–950 (TailwindCSS extended)

**Semantic Colors**:
- Success: Green 500
- Warning: Amber 500
- Error: Orange-Red 600

### 9.3 Typography

- **Font**: System font stack (San Francisco, Segoe UI, Inter)
- **Headings**: Bold, gradient text for primary headers
- **Body**: 15px (0.9375rem), line-height 1.5

---

## 10. File Storage API

### 10.1 Logic File Store

```typescript
interface LogicFile {
  id: string;
  name: string;
  circuit: SerializedCircuitV1;
  createdAt: number;
  updatedAt: number;
}

function createFile(name: string, circuit: SerializedCircuitV1): LogicFile;
function getFile(id: string): LogicFile | null;
function updateFile(id: string, circuit: SerializedCircuitV1): void;
function deleteFile(id: string): void;
function listFiles(): LogicFile[];
```

**Persistence**: LocalStorage (`rb-os:v1:files`)

---

## 11. Example Circuits

### 11.1 Built-in Examples

| ID              | Name                  | Description                        |
|-----------------|-----------------------|------------------------------------|
| 01_wire-lamp    | Wire + Lamp           | Basic connectivity                 |
| 02_and-gate     | AND Gate              | Two-input logic gate               |
| 03_sr-latch     | SR Latch              | Set-Reset memory cell              |
| 04_4bit-counter | 4-Bit Counter         | Binary counting circuit            |
| 05_simple-cpu   | Simple CPU            | Basic CPU with instruction memory  |

**Example Loading**:
```typescript
type ExampleId = '01_wire-lamp' | '02_and-gate' | '03_sr-latch' | '04_4bit-counter' | '05_simple-cpu';

function loadExample(id: ExampleId): Promise<SerializedCircuitV1>;
function listExamples(): { id: ExampleId; name: string; description: string; }[];
```

---

## 12. Deployment & Distribution

### 12.1 NPM Packages

All `@redbyte/*` packages are published to npm with:

```json
{
  "publishConfig": { "access": "public" },
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  }
}
```

**Externalized Dependencies**:
- React MUST be externalized (peerDependency)
- No bundled React in any package

### 12.2 Cloudflare Pages

Documentation deployed to Cloudflare Pages:
- **URL**: `https://redbyte-docs.pages.dev`
- **Trigger**: Push to `main` branch
- **Build**: `pnpm build` → deploy `/docs`

### 12.3 GitHub Pages

Playground app deployed to GitHub Pages:
- **URL**: `https://swaggyp52.github.io/redbyte-ui`
- **Trigger**: Push to `main` branch
- **Build**: `pnpm build` → deploy `/apps/playground/dist`

---

## 13. Browser Compatibility

### 13.1 Supported Browsers

| Browser         | Minimum Version |
|-----------------|-----------------|
| Chrome          | 90+             |
| Firefox         | 88+             |
| Safari          | 14+             |
| Edge            | 90+             |

### 13.2 Required APIs

- ES2020 features (BigInt, optional chaining, nullish coalescing)
- Canvas 2D API (for circuit rendering)
- LocalStorage (for persistence)
- Clipboard API (for share links)
- URL API (for circuit loading)

---

## 14. Performance Guarantees

### 14.1 Boot Time

- **Target**: <3 seconds from URL load to interactive shell
- **Measured**: Time from DOMContentLoaded to shell ready

### 14.2 Simulation Performance

- **Target**: 60 Hz simulation for circuits with <100 nodes
- **Degradation**: Graceful slowdown for complex circuits (1000+ nodes)

### 14.3 Bundle Size

| Package        | Max Size (gzip) |
|----------------|-----------------|
| rb-logic-core  | 5 KB            |
| rb-shell       | 400 KB          |
| rb-apps        | 400 KB          |
| playground app | 500 KB          |

---

## 15. Versioning Policy

### 15.1 Semantic Versioning

All packages follow SemVer 2.0.0:

- **MAJOR**: Breaking API changes
- **MINOR**: New features (backward-compatible)
- **PATCH**: Bug fixes

### 15.2 API Stability

**Immutable APIs** (MUST NOT break in v1.x):
- Circuit serialization format (SerializedCircuitV1)
- Node types and behaviors
- Built-in composite nodes
- Share URL encoding

**Evolvable APIs** (MAY extend in v1.x):
- New node types (backward-compatible)
- New tutorial steps
- New example circuits
- UI components (non-breaking CSS changes)

---

## 16. Extension Points

### 16.1 Custom Node Types

Users can register custom node behaviors:

```typescript
class CustomGateBehavior implements NodeBehavior {
  type = 'CustomGate';
  inputs = ['in0', 'in1'];
  outputs = ['out'];
  evaluate(node: Node, inputs: Map<string, boolean>): Map<string, boolean> {
    const out = /* custom logic */;
    return new Map([['out', out]]);
  }
}

NodeRegistry.register('CustomGate', CustomGateBehavior);
```

### 16.2 Custom Apps

Users can create apps using the `RedByteApp` interface:

```typescript
const MyApp: RedByteApp = {
  manifest: {
    id: 'my-app',
    name: 'My Custom App',
    defaultSize: { width: 600, height: 400 },
  },
  component: MyAppComponent,
};
```

---

## 17. Security Considerations

### 17.1 XSS Protection

- All user input (file names, circuit names) is sanitized
- No `eval()` or dynamic code execution
- No inline scripts in index.html

### 17.2 Data Privacy

- All data stored in LocalStorage (client-side only)
- No analytics tracking in v1
- No server-side data collection

### 17.3 URL Injection

- Circuit URLs are validated before deserialization
- Malformed URLs fail gracefully with error toast
- No sensitive data in URL parameters

---

## 18. Accessibility (WCAG 2.1 AA)

### 18.1 Keyboard Navigation

- All interactive elements are keyboard-accessible
- Tab order follows visual flow
- Focus indicators visible on all controls

### 18.2 Screen Readers

- All images have `alt` attributes
- Buttons have descriptive `aria-label` where needed
- Toast notifications are announced (role="status")

### 18.3 Color Contrast

- All text meets WCAG AA contrast ratios
- Error states use both color + icon

---

## 19. Testing Requirements

### 19.1 Unit Tests

- Core logic engine: 90%+ coverage
- State stores: 80%+ coverage
- Pure functions: 100% coverage

### 19.2 E2E Tests

- First-run welcome flow
- Tutorial navigation (all 4 steps)
- Circuit share and load via URL
- File save/load persistence

### 19.3 Visual Regression

- Playwright screenshot capture for:
  - Desktop wallpapers (dark + light)
  - Logic Playground UI
  - Tutorial overlay
  - Toast notifications

---

## 20. License & Attribution

### 20.1 License

MIT License — See `LICENSE` file in root.

### 20.2 Attribution

All commits co-authored by:
- **Claude Sonnet 4.5** `<noreply@anthropic.com>`

Footer on all documentation pages:
> 🤖 Generated with [Claude Code](https://claude.com/claude-code)

---

## Appendix A: Breaking Changes (Future v2)

If a v2 is needed, the following changes would require a MAJOR version bump:

- Changing `SerializedCircuitV1` schema
- Removing built-in node types
- Changing `Circuit` interface structure
- Breaking `NodeBehavior` contract
- Removing `encodeCircuit` / `decodeCircuit` functions

---

**END OF GENESIS SPECIFICATION v1.0.0**

This document is immutable. Future changes require a new spec version (genesis-v2.md).
