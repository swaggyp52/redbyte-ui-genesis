# 🚀 RedByte OS Genesis - Development Roadmap

**Status:** Production v1.0.0 LIVE at `redbyteapps.dev`
**Development Branch:** `development`
**Protection:** `main` branch protected - deploys to production ONLY

---

## 🎯 **LONG-TERM VISION**

Build a **Universal Logic Design Platform** where you can:
- Design circuits in 2D visual editor
- View in 3D workspace (CAD-like)
- See oscilloscope/waveform representations
- Export to Minecraft worlds with redstone
- Generate PCB layouts and manufacturing files
- Play with circuits in-game OR manufacture them IRL

**Philosophy:** ONE unified circuit model → INFINITE representations

---

## 🛡️ **DEVELOPMENT WORKFLOW**

### **Branch Strategy**
```
main (production) ─────────> redbyteapps.dev (PROTECTED)
  │
  └── development ──────────> Preview only, never auto-deploys
        │
        ├── feature/vfs
        ├── feature/window-snap
        └── feature/3d-workspace
```

### **Rules for Claude/Codex AI Development**
1. ✅ **ALWAYS** work on `development` branch
2. ❌ **NEVER** commit directly to `main`
3. ✅ Create feature branches from `development` for big changes
4. ✅ Test locally before pushing: `pnpm --filter @redbyte/playground dev`
5. ✅ Run quality checks: `pnpm test && pnpm lint && pnpm typecheck`
6. ✅ When ready for production: Create PR `development` → `main` for manual review

### **Cloudflare Deployment**
- **Production:** Deploys from `main` branch ONLY
- **Preview:** Can enable preview deployments for `development` branch (optional)
- **Result:** Production stays stable while development continues

---

## 📋 **DEVELOPMENT PHASES**

## **PHASE 1: Stabilize Core OS Framework**
**Timeline:** 2-3 weeks
**Goal:** Make the OS shell production-grade before adding complex features

### **Stage 1A: Window Manager Upgrades** ⏳
**Why First:** Foundation for everything - must be rock solid

**Tasks:**
- [ ] Window snapping (left/right/top/quadrants)
  - Drag window to edge → snap to 50% width
  - Drag to corner → snap to 25% quadrant
  - Visual snap zones on hover

- [ ] Smooth window animations
  - Minimize animates to taskbar icon
  - Maximize/restore with scale animation
  - Window open/close fade + scale

- [ ] Better z-index management
  - Active window always on top
  - Click any window → brings to front
  - Fix any z-fighting issues

- [ ] Multi-window keyboard shortcuts
  - Alt+Tab: Cycle windows
  - Alt+F4: Close active window
  - Win+Arrow: Snap windows

- [ ] Window state persistence
  - Remember position/size across sessions
  - Restore minimized windows on reload
  - Save per-app preferences

**Files to Modify:**
- `packages/rb-windowing/src/windowStore.ts`
- `packages/rb-shell/src/ShellWindow.tsx`
- `packages/rb-shell/src/Shell.tsx`

**Testing:**
- Open 5+ windows simultaneously
- Drag/resize/minimize/maximize all windows
- Refresh page - windows restore correctly
- No visual glitches or z-index bugs

---

### **Stage 1B: App System Overhaul** ⏳
**Why:** Need dynamic app loading for future extensibility

**Current Structure:**
```
packages/rb-apps/src/apps/
  ├── LogicPlaygroundApp.tsx
  ├── SettingsApp.tsx
  ├── TerminalApp.tsx
  └── FilesApp.tsx
```

**Target Structure:**
```
apps/
  ├── playground/          (main OS shell)
  ├── logic-editor/        (standalone app)
  ├── settings/            (standalone app)
  ├── terminal/            (standalone app)
  ├── files/               (standalone app)
  └── workspace-3d/        (future app)
```

**Tasks:**
- [ ] Create app manifest schema
  ```typescript
  interface AppManifest {
    id: string;
    name: string;
    version: string;
    icon: string;
    entrypoint: string;
    permissions: string[];
    defaultSize: { width: number; height: number };
    singleton: boolean;
  }
  ```

- [ ] Build dynamic app loader
  - Apps are lazy-loaded on demand
  - Hot-reload during development
  - Apps can be installed/uninstalled

- [ ] App Store UI (future)
  - Browse available apps
  - One-click install
  - Version management

**Files to Create:**
- `packages/rb-shell/src/appLoader.ts`
- `packages/rb-shell/src/appRegistry.ts`

---

### **Stage 1C: Virtual File System (VFS)** ⏳
**Why:** Foundation for saving circuits, exporting files, project management

**Architecture:**
```typescript
interface VFSNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  parent: string | null;
  created: Date;
  modified: Date;
  content?: Uint8Array;  // For files
  metadata?: Record<string, any>;
}

interface VFSStore {
  nodes: Map<string, VFSNode>;
  getPath(nodeId: string): string;
  createFile(path: string, content: Uint8Array): VFSNode;
  createDirectory(path: string): VFSNode;
  readFile(path: string): Uint8Array | null;
  writeFile(path: string, content: Uint8Array): void;
  deleteNode(path: string): void;
  listDirectory(path: string): VFSNode[];
}
```

**Default Directory Structure:**
```
/
├── Documents/
│   └── README.txt
├── Projects/
│   ├── circuits/
│   └── designs/
├── Exports/
│   ├── schematics/
│   ├── minecraft/
│   └── cad/
└── Wallpapers/
```

**Storage Backend:**
- Phase 1: `localStorage` (5MB limit - good for MVP)
- Phase 2: `IndexedDB` (unlimited - for large files)
- Phase 3: Cloud sync (optional future)

**Tasks:**
- [ ] Implement VFS core (in-memory + persistence)
- [ ] Build Files app UI (file browser)
- [ ] Add file operations (create, read, update, delete, rename)
- [ ] Implement drag-and-drop (desktop to files)
- [ ] Add context menus (right-click file/folder)

**Files to Create:**
- `packages/rb-vfs/src/vfs.ts`
- `packages/rb-vfs/src/storage/localStorage.ts`
- `packages/rb-vfs/src/storage/indexedDB.ts`

---

## **PHASE 2: Logic Engine Enhancement**
**Timeline:** 3-4 weeks
**Goal:** Strengthen 2D circuit model before adding 3D/export features

### **Stage 2A: Core Logic Improvements** ⏳

**Tasks:**
- [ ] Compound components (sub-circuits)
  - Create reusable circuit blocks
  - Encapsulate complex logic
  - Parameterizable components

- [ ] Wire styling modes
  - Orthogonal (right-angle) wires
  - Bezier curves
  - Direct lines
  - Auto-routing algorithm

- [ ] Component library UI
  - Search/filter components
  - Drag-and-drop onto canvas
  - Custom component colors
  - Component groups/categories

- [ ] Error detection
  - Detect infinite loops
  - Warn on unconnected inputs
  - Highlight conflicting signals
  - Validation before simulation

**Files to Modify:**
- `packages/rb-logic-core/src/CircuitEngine.ts`
- `packages/rb-logic-view/src/CircuitCanvas.tsx`
- `packages/rb-apps/src/apps/LogicPlaygroundApp.tsx`

---

### **Stage 2B: Signal Inspector / Debug Tools** ⏳
**Why:** Foundation for oscilloscope/waveform views

**Features:**
- Real-time signal monitoring
- Pause/resume simulation
- Breakpoints on gates
- Frame-by-frame stepping
- Signal history (last N ticks)
- Export waveform data

**UI Mock:**
```
┌────────────────────────────────────┐
│ Signal Inspector                   │
├────────────────────────────────────┤
│ Gate A (Output) ━━━┓              │
│                    ┗━━━━━━━━━━━━  │
│                                    │
│ Gate B (Output) ━┓  ┏━┓  ┏━━━━━  │
│                 ┗━━┛ ┗━━┛         │
│                                    │
│ [◀] [▶] [⏸] [⏹]  Frame: 24/100   │
└────────────────────────────────────┘
```

**Tasks:**
- [ ] Add signal history tracking to engine
- [ ] Build waveform visualization component
- [ ] Add timeline scrubber
- [ ] Export waveform to CSV/JSON
- [ ] Add probe tool (click gate to monitor)

**Files to Create:**
- `packages/rb-logic-debug/src/SignalInspector.tsx`
- `packages/rb-logic-debug/src/WaveformView.tsx`

---

## **PHASE 3: Universal Representation Layer**
**Timeline:** 4-5 weeks
**Goal:** ONE circuit → MANY outputs

### **Stage 3A: Unified Circuit Schema** ⏳

**Design Goals:**
- Domain-agnostic (works for 2D, 3D, PCB, Minecraft)
- Extensible metadata
- Supports annotations
- Version-controlled format

**Schema (v2):**
```typescript
interface UnifiedCircuit {
  version: 2;
  metadata: {
    name: string;
    author: string;
    created: Date;
    modified: Date;
    tags: string[];
  };

  components: Array<{
    id: string;
    type: string;  // "AND", "OR", "NAND", etc.
    position2D: { x: number; y: number };
    position3D?: { x: number; y: number; z: number };
    rotation2D: number;
    rotation3D?: { x: number; y: number; z: number };
    config: Record<string, any>;
    metadata: {
      color?: string;
      label?: string;
      description?: string;
      minecraft?: { blockType: string };
      pcb?: { footprint: string };
    };
  }>;

  connections: Array<{
    id: string;
    from: { componentId: string; port: string };
    to: { componentId: string; port: string };
    style?: 'orthogonal' | 'bezier' | 'direct';
    waypoints?: Array<{ x: number; y: number }>;
  }>;

  annotations: Array<{
    type: 'text' | 'arrow' | 'box';
    position: { x: number; y: number };
    content: string;
    style: Record<string, any>;
  }>;
}
```

**Tasks:**
- [ ] Design schema (get feedback from AI + community)
- [ ] Implement schema validation (Zod/Yup)
- [ ] Create migration tool (v1 → v2)
- [ ] Update serialization/deserialization
- [ ] Add schema versioning support

**Files to Create:**
- `packages/rb-logic-core/src/schema/v2.ts`
- `packages/rb-logic-core/src/schema/validator.ts`
- `packages/rb-logic-core/src/schema/migrator.ts`

---

### **Stage 3B: Exporter System** ⏳

**Architecture:**
```typescript
interface Exporter {
  name: string;
  format: string;  // "minecraft", "pcb", "svg", etc.
  export(circuit: UnifiedCircuit, options?: any): Promise<ExportResult>;
}

interface ExportResult {
  files: Array<{
    name: string;
    content: Uint8Array | string;
    mimeType: string;
  }>;
  metadata?: Record<string, any>;
}
```

**Exporters to Build:**

1. **SVG/PNG Schematic Exporter** (Easy - Start Here)
   - Renders circuit as publication-ready diagram
   - Configurable colors, line widths, labels

2. **Oscilloscope Data Exporter** (Medium)
   - Exports waveform as CSV, JSON, or VCD format
   - Compatible with GTKWave, WaveDrom

3. **Minecraft Exporter** (Medium - HIGH IMPACT)
   - Maps gates → redstone contraptions
   - Outputs `.schematic` or `.litematic` file
   - User imports into Minecraft world

4. **PCB Layout Exporter** (Hard - Future)
   - Generates KiCad or Eagle files
   - Auto-routing traces

5. **STEP/IGES 3D Model Exporter** (Hard - Future)
   - Exports 3D representation for CAD software

**Tasks:**
- [ ] Create exporter plugin system
- [ ] Build SVG exporter (start simple)
- [ ] Build Minecraft exporter (COOLEST FEATURE)
- [ ] Add export UI to Files app
- [ ] Support batch export (export all projects)

**Files to Create:**
- `packages/rb-exporters/src/ExporterRegistry.ts`
- `packages/rb-exporters/src/svg/SvgExporter.ts`
- `packages/rb-exporters/src/minecraft/MinecraftExporter.ts`

---

## **PHASE 4: 3D Workspace**
**Timeline:** 5-6 weeks
**Goal:** Visual 3D circuit design

### **Stage 4A: 3D Canvas App** ⏳

**Tech Stack:**
- Three.js for rendering
- React Three Fiber for React integration
- Drei for helpers (OrbitControls, Grid, etc.)

**Features (MVP):**
- 3D grid floor
- Orbit camera controls
- Draggable component blocks (cubes/spheres)
- Wire rendering (lines connecting blocks)
- Sync with 2D canvas (place in 2D → appears in 3D)

**UI:**
```
┌──────────────────────────────────────┐
│  3D Workspace               [2D] [3D]│
├──────────────────────────────────────┤
│                                      │
│        ╔═══╗                         │
│        ║AND║──────┐                  │
│        ╚═══╝      │                  │
│                   │    ╔═══╗         │
│                   └────║ OR║         │
│                        ╚═══╝         │
│                                      │
│ [Orbit] [Pan] [Zoom] [Reset View]   │
└──────────────────────────────────────┘
```

**Tasks:**
- [ ] Set up Three.js + React Three Fiber
- [ ] Create 3D scene with grid and lighting
- [ ] Render components as 3D blocks
- [ ] Add orbit camera controls
- [ ] Sync 2D ↔ 3D positions
- [ ] Add component selection (click to select)
- [ ] Add 3D wire rendering

**Files to Create:**
- `packages/rb-workspace-3d/src/Workspace3D.tsx`
- `packages/rb-workspace-3d/src/Component3D.tsx`
- `packages/rb-workspace-3d/src/Wire3D.tsx`

---

## **PHASE 5: Minecraft Integration**
**Timeline:** 2-3 weeks
**Goal:** DESIGN → PLAY IN MINECRAFT

### **Stage 5A: Gate → Redstone Mapping** ⏳

**Mapping Table:**
```typescript
const GATE_TO_REDSTONE: Record<string, RedstonePattern> = {
  'AND': {
    blocks: [
      { type: 'redstone_torch', offset: [0, 0, 0] },
      { type: 'redstone_wire', offset: [1, 0, 0] },
      // ... full AND gate pattern
    ],
    inputs: [[0, 0, 1], [0, 0, -1]],
    output: [2, 0, 0],
  },
  'OR': { /* ... */ },
  'NOT': { /* ... */ },
  'XOR': { /* ... */ },
  // ... all gate types
};
```

**Tasks:**
- [ ] Research optimal redstone gate designs
- [ ] Create mapping for all gate types
- [ ] Implement circuit → redstone converter
- [ ] Add spacing/routing algorithm
- [ ] Generate `.schematic` file format
- [ ] Test import in Minecraft

**Tools:**
- Use `nbt.js` library for `.schematic` files
- Use `litematica-tools` for `.litematic` files

---

### **Stage 5B: Export UI** ⏳

**Workflow:**
1. Design circuit in 2D/3D
2. Click "Export → Minecraft World"
3. Configure options (size, block palette, etc.)
4. Download `.schematic` file
5. Import into Minecraft using WorldEdit or Litematica mod

**UI:**
```
┌────────────────────────────────────┐
│ Export to Minecraft                │
├────────────────────────────────────┤
│ Block Palette:     [Classic]  ▼    │
│ Spacing:           [Normal]   ▼    │
│ Add Signs:         [✓]             │
│ Add Debug Labels:  [✓]             │
│                                    │
│ Estimated Size: 64x32x128 blocks   │
│                                    │
│         [Cancel]  [Export]         │
└────────────────────────────────────┘
```

---

## **PHASE 6: Manufacturing Pipeline**
**Timeline:** Future (3-6 months)
**Goal:** Circuit → Real Hardware

### **Stage 6A: PCB Export**
- Generate KiCad files
- Auto-routing traces
- Component placement optimization

### **Stage 6B: 3D CAD Export**
- Export STEP files for mechanical design
- Generate enclosure models
- BOM (Bill of Materials) generation

### **Stage 6C: Manufacturing Files**
- Gerber files for PCB fabrication
- Pick-and-place files for assembly
- Test plan generation

---

## 🛠️ **DEVELOPMENT BEST PRACTICES**

### **Before Starting Any Task:**
1. Pull latest `development`: `git pull origin development`
2. Create feature branch: `git checkout -b feature/task-name`
3. Run local dev: `pnpm --filter @redbyte/playground dev`

### **During Development:**
1. Test frequently in browser
2. Run tests: `pnpm test`
3. Check TypeScript: `pnpm typecheck`
4. Lint code: `pnpm lint`

### **After Completing Task:**
1. Commit with clear message:
   ```
   git add .
   git commit -m "feat(windowing): Add window snapping to edges"
   git push origin feature/task-name
   ```
2. Create PR: `feature/task-name` → `development`
3. Review locally: `git checkout development && git merge feature/task-name`
4. Test merged code
5. Delete feature branch: `git branch -d feature/task-name`

### **When Ready for Production:**
1. Create PR: `development` → `main`
2. **MANUAL REVIEW REQUIRED**
3. Merge to `main` → Auto-deploys to `redbyteapps.dev`

---

## 📊 **PROGRESS TRACKING**

Use this section to track completion:

- [ ] Phase 1A: Window Manager (0/5 tasks)
- [ ] Phase 1B: App System (0/3 tasks)
- [ ] Phase 1C: VFS (0/5 tasks)
- [ ] Phase 2A: Logic Improvements (0/4 tasks)
- [ ] Phase 2B: Signal Inspector (0/5 tasks)
- [ ] Phase 3A: Unified Schema (0/5 tasks)
- [ ] Phase 3B: Exporters (0/5 tasks)
- [ ] Phase 4A: 3D Workspace (0/7 tasks)
- [ ] Phase 5A: Minecraft Mapping (0/6 tasks)
- [ ] Phase 5B: Minecraft Export UI (0/1 task)

---

## 🎯 **IMMEDIATE NEXT STEPS (This Week)**

**Priority 1:** Stage 1A - Window Snapping
**Why:** Most visible improvement, users will love it
**Estimated Time:** 3-4 days

**Priority 2:** Stage 1C - VFS (Basic Implementation)
**Why:** Needed for file saving/loading, high utility
**Estimated Time:** 4-5 days

**Priority 3:** Stage 2A - Compound Components
**Why:** Makes circuit design much more powerful
**Estimated Time:** 5-7 days

---

## 🚀 **LAUNCH TARGETS**

**v1.1.0** - OS Improvements (Phase 1 complete)
**v1.2.0** - Logic Enhancements (Phase 2 complete)
**v1.3.0** - Universal Schema + Exporters (Phase 3 complete)
**v1.4.0** - 3D Workspace (Phase 4 complete)
**v1.5.0** - Minecraft Integration (Phase 5 complete) 🎮
**v2.0.0** - Manufacturing Pipeline (Phase 6 complete) 🏭

---

**Last Updated:** 2025-12-08
**Current Version:** v1.0.0 Genesis
**Active Branch:** `development`
**Production Status:** ✅ STABLE
