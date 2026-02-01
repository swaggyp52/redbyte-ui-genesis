# Copilot: Your Next Steps (Action Plan)

**Context:** You're taking over a RedByte lab-ready implementation. Core infrastructure is done. Now you need to integrate it and build examples.

---

## Step 1: Environment Setup (5 minutes)

```powershell
# Verify you're in the right place
cd c:\Users\conno\redbyte-ui

# Check what's already installed
pnpm list --depth=0

# Verify project structure
ls packages/app-lab-electron/src/project/
```

**Expected files:**
- `projectTypes.ts` ✅
- `projectSerialize.ts` ✅
- `projectZip.ts` ✅
- `projectMigrations.ts` ✅
- `projectStore.ts` ✅
- `projectAdapters.ts` ✅
- `projectExamples.ts` ✅

---

## Step 2: Add Export Button to UI (30-60 min)

### 2.1 Find Evidence Bar Component

```powershell
# Search for Evidence Bar
grep -r "EvidenceBar" packages/app-lab-electron/src/ --include="*.tsx"
```

### 2.2 Add Export Button

Look for the component that renders the evidence/proof bar (likely in `packages/app-lab-electron/src/components/evidence/` or `packages/app-lab-electron/src/components/lab/`).

Add a button that calls:

```typescript
import { exportProject } from '../services/exportService';

const handleExport = async () => {
  const project = useLabEngineStore.getState().toRbProject();
  const filename = `${project.metadata.name || 'project'}.rbx.zip`;
  await exportProject(project, filename);
};
```

### 2.3 Test Export

1. Open RedByte
2. Create a simple circuit
3. Click "Export Project"
4. Verify `.rbx.zip` file is created
5. Unzip it and check structure:
   - `project.json` exists
   - `README.md` is generated
   - `manifest.json` has checksums

---

## Step 3: Add Import Command (30-60 min)

### 3.1 Create Import Handler

Create `packages/app-lab-electron/src/project/projectImport.ts`:

```typescript
import { readProjectFromZip } from './projectZip';
import { migrateProject } from './projectMigrations';
import { useProjectStore } from './projectStore';

export async function importProject(filePath: string): Promise<void> {
  // Read zip
  const project = await readProjectFromZip(filePath);
  
  // Migrate if needed
  const migrated = migrateProject(project);
  
  // Load into store
  useProjectStore.getState().loadProject(migrated);
  
  console.log(`✅ Imported project: ${migrated.metadata.name}`);
}
```

### 3.2 Add Import to File Menu

Find the main menu registration (likely in `packages/app-lab-electron/src/` main process or `menu.ts`).

Add menu item:
```
File > Import Project...
```

Wire it to open a file picker (`.rbx.zip` filter) and call `importProject()`.

### 3.3 Test Import

1. Export a project (from Step 2)
2. Close RedByte
3. Open RedByte
4. File > Import Project
5. Select the `.rbx.zip`
6. Verify circuit loads correctly

---

## Step 4: Wire ProjectStore to Apps (2-4 hours)

This is the most critical integration step.

### 4.1 Update Logic Playground

Find: `packages/app-lab-electron/src/components/logic/`

Current state management likely uses local state or a different store.

**Replace with:**
```typescript
import { useProjectStore } from '../../project/projectStore';
import { toLogicPlaygroundModel } from '../../project/projectAdapters';

function LogicPlayground() {
  const project = useProjectStore(state => state.currentProject);
  const circuit = project ? toLogicPlaygroundModel(project) : null;
  
  // Use circuit for rendering
  // ...
}
```

### 4.2 Update Lab (2D View)

Find: `packages/app-lab-electron/src/components/lab/`

Same pattern:
```typescript
import { toLab2DModel } from '../../project/projectAdapters';

const labModel = project ? toLab2DModel(project) : null;
```

### 4.3 Update Virtual Lab (3D View)

Find: `packages/app-lab-electron/src/components/lab3d/`

Same pattern:
```typescript
import { toVirtualLabModel } from '../../project/projectAdapters';

const virtualLabModel = project ? toVirtualLabModel(project) : null;
```

### 4.4 Test Cross-App Sync

1. Open Logic Playground
2. Add a gate
3. Switch to Lab view → should see the gate
4. Switch to Virtual Lab → should see mapped IO
5. No export/import needed!

---

## Step 5: Create Universal IO Panel (3-5 hours)

### 5.1 Design Component

Create: `packages/app-lab-electron/src/components/lab/BoardIOPanel.tsx`

```typescript
interface BoardIOPanelProps {
  ioMapping: RbIoMapping;
  onInputChange: (pinId: string, value: boolean) => void;
}

export function BoardIOPanel({ ioMapping, onInputChange }: BoardIOPanelProps) {
  return (
    <div className="board-io-panel">
      <h3>Board I/O</h3>
      
      {/* Switches */}
      <div className="switches">
        {ioMapping.inputs.map(input => (
          <Switch 
            key={input.pinId}
            label={input.label}
            onChange={(val) => onInputChange(input.pinId, val)}
          />
        ))}
      </div>
      
      {/* LEDs */}
      <div className="leds">
        {ioMapping.outputs.map(output => (
          <LED 
            key={output.pinId}
            label={output.label}
            value={/* read from circuit state */}
          />
        ))}
      </div>
    </div>
  );
}
```

### 5.2 Wire to ProjectStore

```typescript
const ioMapping = useProjectStore(state => state.currentProject?.ioMapping);
```

### 5.3 Sync with Virtual Lab

When user toggles switch in 2D panel:
1. Update circuit state in ProjectStore
2. Virtual Lab subscribes to same state
3. 3D LED lights up automatically

Test: Toggle 2D switch → 3D LED responds.

---

## Step 6: Build Example Projects (6-8 hours)

This is the content creation phase.

### 6.1 Half Adder Example

**In Logic Playground:**
1. Create circuit with:
   - 2 inputs: A, B
   - 2 outputs: Sum, Carry
   - Gates: XOR (for Sum), AND (for Carry)
2. Add IO mapping:
   - A → SW0
   - B → SW1
   - Sum → LED0
   - Carry → LED1
3. Add probes on Sum, Carry
4. Run simulation with test vectors:
   - 00 → 00
   - 01 → 10
   - 10 → 10
   - 11 → 01
5. Record the run
6. Export as `half_adder.rbx.zip`
7. Move to `/examples/`

### 6.2 Full Adder Example

Similar process, but 3 inputs (A, B, Cin) and 2 outputs (Sum, Cout).

### 6.3 4-Bit Counter Example (Most Important!)

This is the acceptance test example.

**Circuit:**
- 4 D flip-flops
- Clock input (button with debounce)
- Reset input
- 4 LED outputs

**IO Mapping:**
- Clock → BTN0
- Reset → BTN1
- Count[0:3] → LED[0:3]

**Recording:**
- Press clock 16 times
- Show count from 0000 to 1111

**This must work cross-machine.**

### 6.4 Update Registry

Edit `packages/app-lab-electron/src/project/projectExamples.ts`:

```typescript
export const BUILT_IN_EXAMPLES: ExampleMetadata[] = [
  {
    id: 'half-adder',
    name: 'Half Adder',
    description: 'Basic 1-bit adder using XOR and AND gates',
    category: 'Combinational Logic',
    difficulty: 'Beginner',
    thumbnailPath: 'assets/examples/half-adder.png',
    filepath: 'examples/half_adder.rbx.zip',
    tags: ['gates', 'arithmetic', 'adder'],
  },
  // ... add all examples
];
```

---

## Step 7: Add "Open Example" UI (2-3 hours)

### 7.1 Find Home Dashboard

Search for: `packages/app-lab-electron/src/components/home/` or `Dashboard.tsx`

### 7.2 Add Examples Section

```typescript
import { BUILT_IN_EXAMPLES } from '../../project/projectExamples';
import { importProject } from '../../project/projectImport';

function ExamplesSection() {
  return (
    <div className="examples-grid">
      {BUILT_IN_EXAMPLES.map(example => (
        <ExampleCard
          key={example.id}
          example={example}
          onClick={() => importProject(example.filepath)}
        />
      ))}
    </div>
  );
}
```

### 7.3 Test

1. Open RedByte
2. See "Examples" section on home
3. Click "Half Adder"
4. Should load circuit, IO, and 3D view immediately

---

## Step 8: Reproducibility Check (3-4 hours)

### 8.1 Create Verification Command

Create: `packages/app-lab-electron/src/project/projectVerify.ts`

```typescript
export async function verifyReproducibility(project: RbProjectV1): Promise<VerificationReport> {
  const report: VerificationReport = {
    passed: true,
    checks: [],
  };
  
  // 1. Schema validation
  report.checks.push(validateSchema(project));
  
  // 2. Recording replay
  if (project.recordings?.length > 0) {
    report.checks.push(await verifyRecordings(project));
  }
  
  // 3. Proof pack verification
  if (project.proofPacks?.length > 0) {
    report.checks.push(await verifyProofPacks(project));
  }
  
  // 4. IO mapping sanity
  report.checks.push(validateIoMapping(project));
  
  report.passed = report.checks.every(c => c.passed);
  return report;
}
```

### 8.2 Add Command to Menu

```
Project > Verify Reproducibility
```

### 8.3 Show Modal with Results

Display pass/fail for each check with details.

---

## Step 9: Final Acceptance Test (30 min)

**Machine A (your current machine):**

```powershell
# 1. Open RedByte
# 2. Open Example "4-bit counter"
# 3. Toggle switches in 2D IO
# 4. Observe LEDs in 3D board
# 5. Run simulation
# 6. Export
```

**Simulated Machine B (same machine, fresh import):**

```powershell
# 1. Close RedByte completely
# 2. Delete any cached state
# 3. Open RedByte
# 4. Import counter.rbx.zip
# 5. Run "Verify Reproducibility"
# 6. Should pass ✅
# 7. Toggle switches → should work identically
```

If this works, **you're done.**

---

## Common Issues & Solutions

### Issue: Export creates invalid zip
**Solution:** Check `projectZip.ts` - ensure JSZip is configured correctly

### Issue: Import doesn't load circuit
**Solution:** Check adapter in `projectAdapters.ts` - verify circuit JSON structure matches

### Issue: 2D and 3D don't sync
**Solution:** Both must subscribe to same ProjectStore state slice

### Issue: Examples don't open
**Solution:** Check file paths - examples must be in `/examples/` folder at repo root

---

## Validation Commands

```powershell
# Check project structure
ls packages/app-lab-electron/src/project/

# Search for TODOs
grep -r "TODO" packages/app-lab-electron/src/project/

# Run type check
pnpm --filter app-lab-electron run typecheck

# Test export/import locally
pnpm --filter app-lab-electron run dev
```

---

## Deliverables Checklist

- [ ] Export button in Evidence Bar
- [ ] Import command in File menu
- [ ] ProjectStore wired to all apps
- [ ] Universal IO panel in 2D Lab
- [ ] At least 5 example projects in `/examples/`
- [ ] "Open Example" UI in Home
- [ ] "Verify Reproducibility" command
- [ ] Project Summary panel (optional but recommended)
- [ ] Acceptance test passes

---

## Update AI_STATE.md

When you complete each phase, add to the Change Log:

```markdown
## Change Log

### 2026-02-01 - Lab-Ready Project System (Phase 1 Complete)
- Implemented portable project container (`.rbx.zip` format)
- Added export with auto-generated README
- Created unified ProjectStore
- Wired Logic Playground, Lab, and Virtual Lab to shared state
```

---

**You have everything you need. The infrastructure is built. Now integrate it and ship examples.** 

**Questions? Check `LAB_READY_HANDOFF.md` for technical details.**

**Start with Step 2 (Export Button) and work sequentially.** 🚀
