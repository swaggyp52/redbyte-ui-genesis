# Lab 3 Web Application Plan
## Transform redbyteapps.dev into a Dedicated Seven-Segment Display Learning Tool

**Document Version:** 1.0  
**Target Deployment:** redbyteapps.dev  
**Timeline:** 6 weeks  
**Status:** Planning Phase

---

## 1. Executive Summary

### Vision
Create a focused, reliable web application at redbyteapps.dev that enables students to complete Lab 3 (Seven-Segment Display Driver) without the complexity or instability of the full RedByte OS. Students work hand-in-hand with Vivado: they design in the web tool, verify logic, then implement in Vivado for hardware deployment.

### Key Principles
- **Single Purpose:** Only Lab 3 functionality—no OS shell, no file system, no hardware bridge
- **Reliability First:** Apply lessons from RedByte OS root cause analysis to avoid crashes
- **Student-Focused:** Guided workflow matching the lab manual step-by-step
- **Zero Setup:** Works in any modern browser, no installation required
- **Vivado Companion:** Import/export compatible with student Verilog code

### Success Criteria
1. Students can complete entire Lab 3 workflow without errors
2. Truth table editor supports all 16 rows (0-15) with don't-care states
3. Karnaugh map visualizer groups adjacent 1s and generates simplified expressions
4. Circuit designer simulates 4-bit to 7-segment conversion correctly
5. Export includes truth table, K-maps, logic expressions, and circuit screenshots
6. Page loads in <2 seconds, interactions respond in <100ms
7. Works on laptop (Chrome/Edge/Firefox) and tablet (Safari/Chrome mobile)

---

## 2. Technical Architecture

### 2.1 Technology Stack

**Frontend:**
- React 19.2.1 (hooks-only, no class components)
- TypeScript 5.x (strict mode)
- Vite 7.x (fast builds, no webpack complexity)
- TailwindCSS 3.x (utility-first styling)
- Zustand 4.x (single global store—lessons learned)

**Simulation:**
- Port `CircuitEngine.ts` and `TickEngine.ts` from `packages/rb-logic-core`
- Include fixes: `setCircuit()` calls `tick()`, validateCircuitShape()
- No socket.io, no hardware bridge protocol

**Testing:**
- Vitest for unit tests (truth table logic, K-map grouping, circuit validation)
- Playwright for E2E (golden path: complete Lab 3 end-to-end)
- Visual regression: Percy or Chromatic for UI snapshots

**Deployment:**
- Cloudflare Pages (current hosting for redbyteapps.dev)
- GitHub Actions CI/CD
- Branch previews for testing before production

### 2.2 Data Model

```typescript
// Single source of truth for Lab 3 state
interface Lab3State {
  meta: {
    studentName?: string;
    timestamp: string;
    version: '1.0';
  };
  
  truthTable: TruthTableRow[];  // 16 rows: inputs B3-B0, outputs seg[6:0]
  
  kMaps: {
    [segmentName: string]: {  // 'a', 'b', 'c', 'd', 'e', 'f', 'g'
      grid: number[][];       // 4x4 grid (0/1/X for don't-care)
      groups: Group[];        // User-drawn rectangles
      expression: string;     // Simplified SOP/POS
    };
  };
  
  circuit: {
    nodes: CircuitNode[];      // Gates, inputs, outputs
    connections: Connection[]; // Wires between ports
  };
  
  simulation: {
    currentInput: number;      // 0-15 (B3-B0)
    expectedOutput: number;    // 7 bits (seg[6:0])
    actualOutput: number;
    errors: ValidationError[];
  };
  
  report: {
    screenshots: { [step: string]: string };  // Base64 images
    notes: string;
  };
}

interface TruthTableRow {
  input: number;         // 0-15
  b3: 0 | 1;
  b2: 0 | 1;
  b1: 0 | 1;
  b0: 0 | 1;
  seg: [0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1];  // [a, b, c, d, e, f, g]
  isDontCare: boolean;   // True for inputs 10-15
}

interface CircuitNode {
  id: string;
  type: 'INPUT' | 'OUTPUT' | 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR' | 'XNOR';
  position: { x: number; y: number };
  label?: string;        // e.g., 'B3', 'seg_a'
}

interface Connection {
  from: { nodeId: string; port: string };
  to: { nodeId: string; port: string };
}

interface Group {
  cells: [number, number][];  // [(row, col), ...]
  color: string;              // Visual indicator
  simplified: string;         // e.g., "B3·B2 + B1·B0'"
}
```

### 2.3 Component Hierarchy

```
<Lab3App>
  ├── <Header>  // Title, progress indicator, help button
  ├── <WorkflowStepper>  // Step 1-6 navigation
  ├── <StepView>
  │   ├── Step1: <IntroductionPanel>
  │   │   └── Board diagram, segment naming, active-low explanation
  │   ├── Step2: <TruthTableEditor>
  │   │   ├── <TableGrid>  // Editable cells, don't-care toggle
  │   │   └── <SevenSegmentPreview>  // Live display of current row
  │   ├── Step3: <KarnaughMapView>
  │   │   ├── <SegmentSelector>  // Tabs: a, b, c, d, e, f, g
  │   │   ├── <KMapGrid>  // 4x4, clickable grouping
  │   │   └── <SimplifiedExpression>  // Auto-generated SOP
  │   ├── Step4: <CircuitDesigner>
  │   │   ├── <GatePalette>  // Drag gates onto canvas
  │   │   ├── <CircuitCanvas>  // SVG rendering, wire routing
  │   │   └── <VerilogImportModal>  // Paste case statement
  │   ├── Step5: <Simulator>
  │   │   ├── <InputControls>  // 4 toggle switches B3-B0
  │   │   ├── <SevenSegmentDisplay>  // Animated output
  │   │   └── <ValidationPanel>  // Pass/fail per input
  │   └── Step6: <ReportExporter>
  │       ├── <ReportPreview>  // PDF layout preview
  │       └── <DownloadButtons>  // JSON, PDF, Verilog snippet
  └── <Footer>  // Save/Load workspace, reset button
```

### 2.4 State Management (Zustand Store)

```typescript
// Single global store—no duplicated state, no sync issues
interface Lab3Store {
  // State
  state: Lab3State;
  currentStep: 1 | 2 | 3 | 4 | 5 | 6;
  isDirty: boolean;
  
  // Truth Table Actions
  setTableRow: (index: number, row: Partial<TruthTableRow>) => void;
  toggleDontCare: (index: number) => void;
  resetTable: () => void;
  
  // K-Map Actions
  setKMapCell: (segment: string, row: number, col: number, value: 0 | 1 | 'X') => void;
  addGroup: (segment: string, cells: [number, number][]) => void;
  removeGroup: (segment: string, groupIndex: number) => void;
  autoGenerateGroups: (segment: string) => void;  // Quine-McCluskey
  
  // Circuit Actions
  addNode: (type: string, position: { x: number; y: number }) => void;
  moveNode: (nodeId: string, position: { x: number; y: number }) => void;
  deleteNode: (nodeId: string) => void;
  addConnection: (from: PortRef, to: PortRef) => void;
  deleteConnection: (connectionId: string) => void;
  
  // Simulation Actions
  setInput: (value: number) => void;  // 0-15
  runSimulation: () => void;
  validateAllInputs: () => ValidationResult[];
  
  // Report Actions
  captureScreenshot: (step: string) => void;
  setNotes: (notes: string) => void;
  
  // Persistence
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => void;
  exportToJSON: () => string;
  importFromJSON: (json: string) => void;
  reset: () => void;
  
  // Navigation
  goToStep: (step: number) => void;
  canProceed: (currentStep: number) => boolean;  // Validate before advancing
}
```

### 2.5 Simulation Engine Integration

Port from RedByte OS with critical fixes applied:

```typescript
// lab3-engine.ts
import { CircuitEngine } from './CircuitEngine';  // Fixed version

export class Lab3Engine {
  private engine: CircuitEngine;
  
  constructor() {
    this.engine = new CircuitEngine({ debug: false });
  }
  
  // Load circuit from state
  loadCircuit(nodes: CircuitNode[], connections: Connection[]) {
    const circuit = convertToEngineFormat(nodes, connections);
    this.engine.setCircuit(circuit);  // Calls tick() internally—signals ready immediately
  }
  
  // Simulate 4-bit input -> 7-bit output
  simulate(input: number): number {
    // Set input nodes B3-B0
    this.setInputs(input);
    
    // Step once
    this.engine.tick();
    
    // Read output nodes seg[6:0]
    return this.readOutputs();
  }
  
  private setInputs(value: number) {
    const b3 = (value >> 3) & 1;
    const b2 = (value >> 2) & 1;
    const b1 = (value >> 1) & 1;
    const b0 = value & 1;
    
    this.engine.setNodeState('input-b3', { isOn: b3 });
    this.engine.setNodeState('input-b2', { isOn: b2 });
    this.engine.setNodeState('input-b1', { isOn: b1 });
    this.engine.setNodeState('input-b0', { isOn: b0 });
  }
  
  private readOutputs(): number {
    const signals = this.engine.getAllSignals();
    let result = 0;
    
    // Read seg_a through seg_g (active-low: 0 = lit)
    for (let i = 0; i < 7; i++) {
      const signal = signals.get(`output-seg${i}.in`) ?? 0;
      result |= (signal << i);
    }
    
    return result;
  }
}
```

---

## 3. Implementation Phases

### Phase 1: Project Setup & Foundation (Week 1)
**Goal:** Establish clean architecture and CI/CD pipeline

**Tasks:**
1. Create new repository `lab3-webapp` (separate from redbyte-ui)
2. Initialize Vite + React + TypeScript + TailwindCSS
3. Set up ESLint, Prettier, Vitest, Playwright
4. Configure Cloudflare Pages deployment (staging + production)
5. Implement basic Zustand store with Lab3State model
6. Add localStorage persistence (save/load/reset)
7. Create `<WorkflowStepper>` component with 6 steps

**Deliverables:**
- Empty app with 6 step placeholders
- CI/CD pipeline: push to main = deploy to redbyteapps.dev
- Unit test for store persistence

**Success Gate:**
- `npm run dev` starts app in <5 seconds
- Playwright smoke test navigates all 6 steps without errors

---

### Phase 2: Truth Table & Seven-Segment Display (Week 2)
**Goal:** Students can enter truth table and see live segment preview

**Tasks:**
1. Implement `<TruthTableEditor>`:
   - 16-row grid (inputs 0-15)
   - Editable seg[6:0] cells (click to toggle 0/1)
   - Don't-care checkbox for rows 10-15
   - Auto-compute missing rows from K-map later
2. Implement `<SevenSegmentDisplay>`:
   - SVG rendering of 7 segments (ABCDEFG standard layout)
   - Active-low logic: 0 = lit (green), 1 = dim (dark gray)
   - Animate transitions when input changes
3. Connect table to display: selecting a row shows its pattern
4. Add "Fill Standard Digits" button (auto-fill 0-9 with correct patterns)

**Deliverables:**
- Truth table editor with live preview
- Seven-segment display widget (reusable component)
- Unit tests for digit patterns (0-9 correctness)

**Success Gate:**
- Filling row 0 with seg=[0,0,1,0,0,0,0] displays digit "0" correctly
- Don't-care rows (10-15) render blank display with dashed outline

---

### Phase 3: Karnaugh Map Generator (Week 3)
**Goal:** Auto-generate K-maps from truth table and allow grouping

**Tasks:**
1. Implement `<KarnaughMapView>`:
   - 7 tabs (one per segment: a, b, c, d, e, f, g)
   - 4×4 grid with Gray code labels (B3B2 / B1B0)
   - Auto-populate from truth table (1 = must light, X = don't-care)
2. Implement grouping interaction:
   - Click-and-drag to select rectangular groups
   - Show colored overlays for each group
   - Validate groups (must be powers of 2, adjacent cells only)
3. Auto-generate simplified expressions:
   - Use Quine-McCluskey algorithm (or library: `boolean-algebra` npm)
   - Display Sum-of-Products (SOP) form
   - Show Verilog assignment: `assign seg_a = ...;`
4. Add "Auto-Group" button (find optimal groups algorithmically)

**Deliverables:**
- K-map visualizer for all 7 segments
- Grouping UI with validation
- Simplified boolean expressions (SOP form)

**Success Gate:**
- K-map for segment 'a' matches lab manual example
- Auto-grouping produces minimal SOP (e.g., `B3·B2 + B1'·B0`)
- Expressions update live when table changes

---

### Phase 4: Circuit Designer (Week 4)
**Goal:** Students design logic circuit using gates

**Tasks:**
1. Port `CircuitEngine.ts` and `TickEngine.ts` from RedByte OS:
   - Apply fixes: `setCircuit()` calls `tick()`, `validateCircuitShape()`
   - Remove hardware bridge dependencies
   - Add Lab 3 node types: INPUT (B3-B0), OUTPUT (seg[6:0]), AND, OR, NOT, NAND, NOR, XOR, XNOR
2. Implement `<CircuitCanvas>`:
   - SVG-based rendering (infinite canvas with pan/zoom)
   - Drag gates from `<GatePalette>` onto canvas
   - Click ports to start wire, click another port to complete wire
   - Wire routing: orthogonal (Manhattan) or curved paths
   - Stable keys for all SVG elements (prevent React reconciliation crashes)
3. Implement `<GatePalette>`:
   - Icons for each gate type
   - Drag-and-drop onto canvas
   - Search/filter gates
4. Connect circuit to simulation engine:
   - Serialize canvas graph to `Circuit` format
   - Call `Lab3Engine.loadCircuit()` on every change
   - Validate: must have exactly 4 INPUT nodes, 7 OUTPUT nodes

**Deliverables:**
- Working circuit designer with gate placement and wiring
- Simulation engine integration
- Validation: detect missing inputs/outputs, unconnected ports

**Success Gate:**
- Drag AND gate, connect two INPUTs to its inputs, connect output to OUTPUT node
- Simulation reflects logic: INPUT=1,1 → OUTPUT=1
- No React crashes (stable SVG reconciliation)

---

### Phase 5: Simulation & Validation (Week 5)
**Goal:** Run circuit against truth table and highlight errors

**Tasks:**
1. Implement `<Simulator>`:
   - 4 toggle switches for B3-B0 input
   - Large seven-segment display showing actual output
   - Side-by-side comparison: expected vs actual
2. Implement validation logic:
   - For each input 0-15:
     - Simulate circuit with Lab3Engine
     - Compare actual output to truth table row
     - Flag mismatches (highlight in red)
   - Display summary: "15/16 inputs correct" or "All correct!"
3. Add debugging tools:
   - Hover over wire to see signal value (0/1)
   - Click gate to inspect inputs/outputs
   - Highlight propagation path (flash wires in sequence)
4. Add Verilog import:
   - Modal to paste `case (B)` statement
   - Parse into truth table rows
   - Warn if imported values differ from K-map derivation

**Deliverables:**
- Simulation UI with live feedback
- Validation report showing pass/fail per input
- Verilog import parser

**Success Gate:**
- Circuit designed in Step 4 simulates correctly for all 16 inputs
- Verilog case statement import populates truth table accurately
- Validation catches intentional errors (e.g., swapped segments)

---

### Phase 6: Report Export & Polish (Week 6)
**Goal:** Export complete lab report and finalize UI

**Tasks:**
1. Implement `<ReportExporter>`:
   - Generate PDF with:
     - Student name and timestamp
     - Truth table (formatted table)
     - K-maps (7 images with groups highlighted)
     - Simplified expressions (typeset equations)
     - Circuit diagram (SVG export)
     - Validation results (pass/fail summary)
   - Use `jsPDF` or `react-pdf` for generation
2. Add JSON export/import:
   - Download entire Lab3State as JSON
   - Upload JSON to restore work later
   - Versioning: reject incompatible schema versions
3. Polish UI/UX:
   - Add tooltips to all buttons
   - Keyboard shortcuts (Ctrl+Z undo, Ctrl+S save)
   - Loading states for heavy operations (K-map generation, PDF export)
   - Error boundaries with student-friendly messages
4. Accessibility audit:
   - Keyboard navigation for all interactive elements
   - ARIA labels for screen readers
   - High-contrast mode toggle
   - Test with axe DevTools

**Deliverables:**
- PDF report generation
- JSON save/load with versioning
- Polished UI with accessibility compliance

**Success Gate:**
- Export PDF includes all required sections
- Re-import JSON restores state exactly
- wcag2aa accessibility score >90%

---

## 4. Testing Strategy

### 4.1 Unit Tests (Vitest)
**Coverage target:** >80% for logic modules

**Test suites:**
- `truth-table.test.ts`: Validate digit patterns 0-9, don't-care handling
- `kmap.test.ts`: Gray code indexing, grouping validation, Quine-McCluskey
- `circuit-engine.test.ts`: Node creation, connection validation, signal propagation
- `simulation.test.ts`: Input/output mapping, error detection
- `store.test.ts`: State mutations, persistence, undo/redo

### 4.2 Integration Tests (Playwright)
**Golden path test:** Complete Lab 3 workflow end-to-end

```typescript
// e2e/lab3-golden-path.spec.ts
test('Complete Lab 3 workflow', async ({ page }) => {
  await page.goto('/');
  
  // Step 1: Introduction
  await page.click('[data-step="1"]');
  await expect(page.locator('h1')).toContainText('Seven-Segment Display');
  
  // Step 2: Truth Table
  await page.click('[data-step="2"]');
  await page.click('button:has-text("Fill Standard Digits")');
  await page.click('[data-row="0"]');  // Select digit 0
  const display = page.locator('[data-testid="seven-segment-display"]');
  await expect(display).toHaveAttribute('data-pattern', '0001000');  // Active-low
  
  // Step 3: K-Maps
  await page.click('[data-step="3"]');
  await page.click('[data-segment="a"]');  // Select segment A
  await page.click('button:has-text("Auto-Group")');
  await expect(page.locator('[data-testid="kmap-groups"]')).toContainText('2 groups');
  
  // Step 4: Circuit Design
  await page.click('[data-step="4"]');
  await page.dragAndDrop('[data-gate="AND"]', '[data-canvas]', { targetPosition: { x: 100, y: 100 } });
  await page.dragAndDrop('[data-gate="INPUT"]', '[data-canvas]', { targetPosition: { x: 50, y: 80 } });
  // ... wire inputs to gates to outputs ...
  
  // Step 5: Simulate
  await page.click('[data-step="5"]');
  await page.click('[data-input="b0"]');  // Toggle B0 switch
  await expect(page.locator('[data-testid="validation-status"]')).toContainText('16/16 correct');
  
  // Step 6: Export
  await page.click('[data-step="6"]');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button:has-text("Download PDF")')
  ]);
  expect(download.suggestedFilename()).toMatch(/lab3-report-.+\.pdf/);
});
```

**Additional E2E tests:**
- Import Verilog case statement and verify truth table population
- Save to JSON, refresh page, load from JSON (state persistence)
- Intentional circuit error → validation catches it

### 4.3 Visual Regression Tests
Use Percy or Chromatic to snapshot each step:
- Truth table with digits 0-9 filled
- K-map with auto-generated groups
- Circuit with 3-4 gates and wires
- Validation panel showing pass/fail

### 4.4 Performance Tests
**Metrics:**
- Initial page load: <2 seconds (3G throttling)
- Circuit simulation (16 inputs): <500ms total
- K-map generation: <100ms per segment
- PDF export: <3 seconds

**Tools:**
- Lighthouse CI in GitHub Actions
- Custom Playwright performance timing

---

## 5. Deployment Plan

### 5.1 Infrastructure
**Hosting:** Cloudflare Pages (current redbyteapps.dev setup)

**Branch strategy:**
- `main` → production (redbyteapps.dev)
- `staging` → preview (staging.redbyteapps.dev)
- Feature branches → ephemeral previews

**CI/CD (GitHub Actions):**
```yaml
# .github/workflows/deploy.yml
name: Deploy Lab3 App

on:
  push:
    branches: [main, staging]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test:unit
      - run: npx playwright install chromium
      - run: npm run test:e2e
  
  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: lab3-webapp
          directory: dist
          branch: ${{ github.ref_name }}
```

### 5.2 Rollout Plan
1. **Week 1-5:** Build in private repo, deploy to staging.redbyteapps.dev
2. **Week 6 (before class):**
   - Deploy to production redbyteapps.dev
   - Run full E2E suite against production
   - Instructor walkthrough and signoff
3. **Day of Lab 3:**
   - Monitor Cloudflare Analytics for errors
   - Have staging.redbyteapps.dev as fallback if production issues arise

---

## 6. Student-Facing Features

### 6.1 Guided Workflow
**Step-by-step instructions embedded in UI:**

**Step 1: Introduction**
- Show Basys 3 board diagram (highlight seven-segment displays)
- Explain segment naming (A-G) and active-low logic
- Provide example: input 0000 should light segments to display "0"

**Step 2: Truth Table**
- Pre-filled table skeleton (16 rows, all segments initialized to 1 = off)
- "Fill Standard Digits" button auto-completes rows 0-9
- Students manually set rows 10-15 as don't-care or blank
- Live preview: click row → see seven-segment display

**Step 3: Karnaugh Maps**
- Auto-generate 7 K-maps from truth table
- Tutorial: "Click adjacent 1s to form groups. Larger groups = simpler logic."
- Show simplified expression below each map
- Export expressions as Verilog `assign` statements

**Step 4: Circuit Design**
- Palette with gates (AND, OR, NOT, etc.)
- Instructions: "Build logic for each segment. Use expressions from Step 3."
- Validation: "Your circuit must have 4 inputs (B3-B0) and 7 outputs (seg[6:0])."

**Step 5: Simulation**
- 4 toggle switches for input
- Large seven-segment display
- Traffic light indicator: green = all correct, red = errors
- Click "Show Errors" to highlight which inputs fail

**Step 6: Export Report**
- Preview report before download
- Checkbox: "Include Verilog code for Vivado?"
- Downloads: PDF report + JSON workspace backup

### 6.2 Help System
**Inline tooltips:**
- Hover over any button for description
- "?" icon next to each step opens detailed help modal

**Common questions panel:**
- "What is active-low?" → Explanation with diagram
- "How do I group K-map cells?" → Animated GIF tutorial
- "My circuit fails validation. What do I check?" → Troubleshooting checklist

**Instructor contact:**
- "Stuck? Ask your instructor" button (no backend—just reminder)

---

## 7. Vivado Integration Points

### 7.1 Verilog Export
**From truth table (Step 2):**
```verilog
// Export button generates:
module seven_seg_decoder(
  input [3:0] B,
  output reg [6:0] seg
);
  always @(*) begin
    case (B)
      4'b0000: seg = 7'b0001000;  // Display "0"
      4'b0001: seg = 7'b1111001;  // Display "1"
      // ... rows 2-9 ...
      default: seg = 7'b1111111;  // Blank for 10-15
    endcase
  end
endmodule
```

**From K-maps (Step 3):**
```verilog
// Continuous assignment form:
assign seg[0] = (B[3] & B[2]) | (~B[1] & B[0]);  // Segment A
// ... repeat for segments B-G ...
```

**From circuit (Step 4):**
```verilog
// Structural description:
wire and1_out;
and (and1_out, B[3], B[2]);  // AND gate instance
// ... more gates ...
assign seg[0] = and1_out | ...;
```

### 7.2 Verilog Import
**Parse case statement:**
```typescript
function parseVerilogCase(code: string): TruthTableRow[] {
  const rows: TruthTableRow[] = [];
  
  // Regex: 4'b0000: seg = 7'b0001000;
  const regex = /4'b([01]{4}):\s*seg\s*=\s*7'b([01]{7});/g;
  
  let match;
  while (match = regex.exec(code)) {
    const input = parseInt(match[1], 2);
    const seg = match[2].split('').map(s => parseInt(s) as 0 | 1);
    rows.push({ input, seg, isDontCare: false, ...toBits(input) });
  }
  
  return rows;
}
```

**Validation:**
- Compare imported truth table to K-map-derived table
- Warn if differences: "Your Verilog differs from K-map simplification. Double-check!"

---

## 8. Accessibility & Internationalization

### 8.1 Accessibility (WCAG 2.1 Level AA)
**Keyboard navigation:**
- Tab order follows logical workflow (step 1 → 2 → 3 → ...)
- Enter/Space activate buttons
- Arrow keys navigate K-map grid cells
- Esc closes modals

**Screen reader support:**
- ARIA labels on all interactive elements
- Live regions announce validation results
- Table headers clearly labeled

**Visual:**
- High-contrast mode toggle (black/white/yellow theme)
- Minimum font size 14px (scalable)
- Color never sole indicator (icons + text for pass/fail)

### 8.2 Internationalization (Future)
**Currently:** English only (matches lab manual)

**Phase 2 (if needed):**
- Extract all strings to `i18n/en.json`
- Support Spanish (common in US engineering programs)
- Add language selector in footer

---

## 9. Migration from Current RedByte OS

### 9.1 What to Keep
**Simulation engine core:**
- `packages/rb-logic-core/src/CircuitEngine.ts` (with fixes)
- `packages/rb-logic-core/src/TickEngine.ts`
- `packages/rb-logic-core/src/builtins.ts` (gate behaviors)
- `packages/rb-logic-core/src/NodeRegistry.ts`

**Coordinate math:**
- `packages/rb-viewport/src/transforms.ts` (screenToWorld/worldToScreen)

**Type definitions:**
- `Circuit`, `Node`, `Connection` interfaces

### 9.2 What to Leave Behind
**Do NOT port:**
- Shell.tsx, Window management, File system
- Hardware bridge (sockets, serial protocol)
- Full OS chrome (taskbar, notifications, settings app)
- Project persistence system (too complex—use simple JSON)
- Lab apps beyond Lab 3 (ECELabApp, InstructorApp, etc.)
- 3D view, schematic view (out of scope)

**Reasoning:**
These caused the triple-source-of-truth bugs, recursion issues, and React reconciliation crashes. Lab 3 app is clean slate—only proven components.

### 9.3 Code Reuse Strategy
1. Copy `rb-logic-core` package into `lab3-webapp/src/engine/`
2. Apply all fixes from overhaul plan:
   - CircuitEngine.setCircuit() calls tick()
   - Remove hardware bridge hooks
   - Simplify to combinational logic only (no clocks, no async)
3. Write adapter layer if needed (e.g., `Lab3Engine` wrapper)

---

## 10. Risk Management

### 10.1 Technical Risks

**Risk: Simulation engine bugs**
- **Likelihood:** Medium (ported from broken OS)
- **Impact:** High (students can't validate designs)
- **Mitigation:**
  - Extensive unit tests for all gate types
  - E2E tests for all 16 input combinations
  - Manual verification against Vivado simulation

**Risk: React reconciliation crashes**
- **Likelihood:** Medium (happened in RedByte OS)
- **Impact:** High (unusable app)
- **Mitigation:**
  - Stable keys for all SVG children
  - No conditional rendering without wrapper groups
  - No manual DOM manipulation
  - Playwright test for circuit with 20+ gates

**Risk: Browser compatibility issues**
- **Likelihood:** Low (using standard React/SVG)
- **Impact:** Medium (some students can't access)
- **Mitigation:**
  - Test on Chrome, Edge, Firefox, Safari
  - Polyfills for older browsers (if needed)
  - Cloudflare analytics to detect browser errors

### 10.2 Schedule Risks

**Risk: K-map algorithm complexity**
- **Likelihood:** Medium (Quine-McCluskey is non-trivial)
- **Impact:** Medium (manual grouping still works)
- **Mitigation:**
  - Use existing library (e.g., `logic-solver`)
  - Fallback: manual grouping only (no auto-generate)

**Risk: PDF generation performance**
- **Likelihood:** Low
- **Impact:** Low (students wait 5 seconds vs 2 seconds)
- **Mitigation:**
  - Generate PDF server-side if client-side too slow
  - Cache generated images

### 10.3 Operational Risks

**Risk: Cloudflare outage during lab**
- **Likelihood:** Very Low
- **Impact:** Critical (entire class blocked)
- **Mitigation:**
  - Deploy static backup to GitHub Pages (lab3-backup.github.io)
  - Provide downloadable offline version (single HTML file)
  - Announce backup URLs before lab starts

**Risk: Students lose work (browser crash, tab close)**
- **Likelihood:** Medium
- **Impact:** High (frustration, time loss)
- **Mitigation:**
  - Auto-save to localStorage every 30 seconds
  - "Restore Previous Session" prompt on page load
  - Prominent "Download JSON Backup" button

---

## 11. Success Metrics

### 11.1 Technical Metrics
- **Page Load Time:** <2s (Lighthouse score >90)
- **Interaction Latency:** <100ms (button click → response)
- **Simulation Speed:** <50ms per input (all 16 inputs in <1s)
- **Crash Rate:** 0 uncaught exceptions in E2E tests
- **Test Coverage:** >80% unit, 100% critical paths E2E

### 11.2 User Metrics (Post-Lab Survey)
- **Task Completion:** >95% of students complete all 6 steps
- **Ease of Use:** Average rating >4.0/5.0
- **Usefulness:** >80% agree "Tool helped me understand seven-segment logic"
- **Would Recommend:** >85% would recommend to peer

### 11.3 Educational Outcomes
- **Correctness:** >90% of student circuits pass validation (all 16 inputs)
- **Efficiency:** Average time to complete Steps 2-5: <45 minutes
- **Transfer to Vivado:** >80% of students successfully synthesize in Vivado without errors

---

## 12. Post-Launch Plan

### 12.1 Immediate (Week 7)
- Monitor Cloudflare logs for errors
- Collect student feedback via embedded form
- Fix critical bugs within 24 hours

### 12.2 Short-term (Weeks 8-10)
- Address usability issues from student feedback
- Add "Example Solutions" gallery (instructor-created designs)
- Performance optimizations based on analytics

### 12.3 Long-term (Next Semester)
**Potential expansions (only if Lab 3 tool proves successful):**
- Lab 4 tool: FSM designer (state diagrams, state tables, circuit generation)
- Lab 5 tool: Datapath simulator (registers, ALU, memory)
- Integration with LMS (Canvas, Blackboard) for grade submission
- Multiplayer mode: students collaborate on same circuit

**NOT in scope:**
- Full RedByte OS rebuild (that's separate effort)
- Hardware bridge (keep Vivado for synthesis/programming)

---

## 13. Appendices

### Appendix A: Digit Patterns Reference
**Active-low seven-segment encoding (0 = lit, 1 = off):**

| Digit | seg_g | seg_f | seg_e | seg_d | seg_c | seg_b | seg_a | Hex   |
|-------|-------|-------|-------|-------|-------|-------|-------|-------|
| 0     | 1     | 0     | 0     | 0     | 0     | 0     | 0     | 0x40  |
| 1     | 1     | 1     | 1     | 1     | 0     | 0     | 1     | 0x79  |
| 2     | 0     | 1     | 0     | 0     | 1     | 0     | 0     | 0x24  |
| 3     | 0     | 1     | 1     | 0     | 0     | 0     | 0     | 0x30  |
| 4     | 0     | 0     | 1     | 1     | 0     | 0     | 1     | 0x19  |
| 5     | 0     | 0     | 1     | 0     | 0     | 1     | 0     | 0x12  |
| 6     | 0     | 0     | 0     | 0     | 0     | 1     | 0     | 0x02  |
| 7     | 1     | 1     | 1     | 1     | 0     | 0     | 0     | 0x78  |
| 8     | 0     | 0     | 0     | 0     | 0     | 0     | 0     | 0x00  |
| 9     | 0     | 0     | 1     | 0     | 0     | 0     | 0     | 0x10  |

### Appendix B: Development Environment
**Required tools:**
- Node.js 20.x LTS
- npm or pnpm (prefer pnpm for speed)
- VS Code with extensions: ESLint, Prettier, Playwright Test
- Git for version control

**Quick start:**
```bash
git clone https://github.com/your-org/lab3-webapp
cd lab3-webapp
pnpm install
pnpm dev  # Start dev server on http://localhost:5173
```

### Appendix C: Glossary
- **Active-low:** Logic level where 0 (LOW) = active/on, 1 (HIGH) = inactive/off
- **Don't-care:** Input combination with undefined output (can be 0 or 1)
- **Karnaugh map:** Visual tool for simplifying boolean expressions
- **SOP:** Sum of Products (OR of AND terms)
- **Seven-segment display:** LED display with 7 segments arranged to show digits 0-9

---

## Document History
| Version | Date       | Author | Changes                  |
|---------|------------|--------|--------------------------|
| 1.0     | 2026-02-09 | Agent  | Initial comprehensive plan |

**Review Status:** ✅ Ready for implementation
