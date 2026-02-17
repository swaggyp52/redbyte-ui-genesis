# RedByte IDE v1 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform RedByte from an unstructured logic sandbox into a VHDL-first FPGA learning IDE that students can actually use for Lab 4 (ALU) without confusion.

**Architecture:** The existing Shell/AppRegistry system is kept intact. We add a LabLauncher as the default boot app, route all student traffic through it, add a VHDL generator alongside the existing Verilog one, and embed a Vivado handoff guide in the Export flow. No packages are added. No new apps are registered beyond the launcher.

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind CSS, existing `rb-apps`, `rb-logic-core`, `rb-shell` packages. All new files go in `packages/rb-apps/src/`.

**Contract Reference:** `docs/plans/RED_BYTE_IDE_CONTRACT.md` — every task must satisfy the violation conditions in Section 8.

---

## PRIORITY ORDER

These 5 deliverables must ship in strict order. Do not start a later deliverable until the earlier one passes its acceptance check.

| # | Deliverable | Acceptance gate |
|---|-------------|----------------|
| 1 | Lab Launcher as default entry point | Fresh load → sees 8 lab cards, no wizard |
| 2 | Lab 4 integration template | Open Lab 4 → pre-built blocks, tasks panel |
| 3 | VHDL generator | Export → readable `top.vhd` that compiles in Vivado |
| 4 | VHDL export bundle | ZIP contains `top.vhd`, `top.xdc`, `README.txt` |
| 5 | Vivado handoff (inline + printable) | 5-step guide visible after export |

---

## Task 1: Lab Launcher Component

**Goal:** A full-screen launcher showing all 8 labs as visual cards. This is the first thing every student sees.

**Files:**
- Create: `packages/rb-apps/src/components/LabLauncher.tsx`
- Create: `packages/rb-apps/src/apps/LabLauncherApp.tsx`

---

### Step 1 — Create the LabLauncher component

Create `packages/rb-apps/src/components/LabLauncher.tsx`:

```tsx
import React from 'react';
import { LAB_DEFINITIONS } from '../labs/labDefinitions';

type LabStatus = 'completed' | 'active' | 'upcoming';

interface LabCardProps {
  lab: (typeof LAB_DEFINITIONS)[number];
  status: LabStatus;
  onOpen: (labId: string) => void;
}

const STATUS_CONFIG: Record<LabStatus, { label: string; className: string; dot: string }> = {
  completed: {
    label: 'COMPLETED',
    className: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
    dot: 'bg-emerald-400',
  },
  active: {
    label: 'ACTIVE',
    className: 'text-red-400 border-red-400/30 bg-red-400/10 animate-pulse',
    dot: 'bg-red-400 animate-pulse',
  },
  upcoming: {
    label: 'UPCOMING',
    className: 'text-zinc-500 border-zinc-700 bg-zinc-800/50',
    dot: 'bg-zinc-600',
  },
};

const LabCard: React.FC<LabCardProps> = ({ lab, status, onOpen }) => {
  const cfg = STATUS_CONFIG[status];
  return (
    <div
      className={[
        'group relative flex flex-col gap-3 rounded-xl border p-5 transition-all duration-200 cursor-pointer',
        status === 'upcoming'
          ? 'border-zinc-800 bg-zinc-900/60 opacity-70 hover:opacity-90'
          : 'border-zinc-700 bg-zinc-900 hover:border-red-500/50 hover:shadow-[0_0_24px_rgba(255,45,45,0.12)]',
      ].join(' ')}
      onClick={() => onOpen(lab.id)}
    >
      {/* Lab number */}
      <span className="text-xs font-mono text-zinc-600 tracking-widest uppercase">
        Lab {lab.id.replace('lab', '')}
      </span>

      {/* Title */}
      <h3 className="text-base font-semibold text-zinc-100 leading-tight">{lab.title}</h3>

      {/* Description */}
      <p className="text-sm text-zinc-400 leading-snug flex-1">{lab.learningGoal}</p>

      {/* Footer row */}
      <div className="flex items-center justify-between mt-1">
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider px-2 py-0.5 rounded border ${cfg.className}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
        <span className="text-xs text-zinc-600">{lab.timeEstimate}</span>
      </div>

      {/* Hover CTA */}
      <button
        className={[
          'absolute inset-x-5 bottom-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150',
          'opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0',
          status === 'upcoming'
            ? 'bg-zinc-800 text-zinc-400'
            : 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_12px_rgba(255,45,45,0.4)]',
        ].join(' ')}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(lab.id);
        }}
      >
        Open Lab →
      </button>
    </div>
  );
};

export interface LabLauncherProps {
  /** Map of labId → status. Defaults to 'upcoming' for unlisted labs. */
  labStatuses?: Partial<Record<string, LabStatus>>;
  onOpenLab: (labId: string) => void;
}

export const LabLauncher: React.FC<LabLauncherProps> = ({ labStatuses = {}, onOpenLab }) => {
  return (
    <div
      className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col"
      style={{
        backgroundImage: `radial-gradient(circle at 50% 0%, rgba(255,45,45,0.06) 0%, transparent 60%),
          linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
        backgroundSize: '100% 100%, 40px 40px, 40px 40px',
      }}
    >
      {/* Header */}
      <header className="flex flex-col items-center pt-16 pb-10 px-8 gap-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-md bg-red-600 flex items-center justify-center shadow-[0_0_16px_rgba(255,45,45,0.6)]">
            <span className="text-white font-bold text-sm">RB</span>
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">RedByte</span>
        </div>
        <p className="text-zinc-400 text-sm tracking-wide">
          ECE348 / GECE598 — Digital Logic &amp; FPGA Design
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-600">
          <span className="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900">
            Basys3
          </span>
          <span className="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900">
            VHDL
          </span>
          <span className="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900">
            Labs 1–8
          </span>
        </div>
      </header>

      {/* Lab grid */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-8 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {LAB_DEFINITIONS.filter((l) => l.id !== 'freeplay').map((lab) => (
            <LabCard
              key={lab.id}
              lab={lab}
              status={labStatuses[lab.id] ?? 'upcoming'}
              onOpen={onOpenLab}
            />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center pb-8 text-xs text-zinc-700">
        redbyteapps.dev — select a lab to begin
      </footer>
    </div>
  );
};
```

### Step 2 — Create the LabLauncherApp wrapper

Create `packages/rb-apps/src/apps/LabLauncherApp.tsx`:

```tsx
import React from 'react';
import { LabLauncher } from '../components/LabLauncher';
import type { RedByteApp } from '../AppRegistry';

// labId → status mapping — update each week as labs progress.
// 'completed' = done, 'active' = current lab, 'upcoming' = not yet.
const CURRENT_LAB_STATUSES: Record<string, 'completed' | 'active' | 'upcoming'> = {
  lab1: 'completed',
  lab2: 'completed',
  lab3: 'completed',
  lab4: 'active',
  lab5: 'upcoming',
  lab6: 'upcoming',
  lab7: 'upcoming',
  lab8: 'upcoming',
};

export const LabLauncherApp: React.FC<{ windowId: string }> = ({ windowId }) => {
  const handleOpenLab = (labId: string) => {
    // Dispatch an event to open the lab workspace app
    window.dispatchEvent(
      new CustomEvent('rb:open-app', {
        detail: { appId: 'lab-workspace', props: { labId } },
      })
    );
  };

  return (
    <LabLauncher
      labStatuses={CURRENT_LAB_STATUSES}
      onOpenLab={handleOpenLab}
    />
  );
};

export const labLauncherAppManifest: RedByteApp['manifest'] = {
  id: 'lab-launcher',
  title: 'Labs',
  icon: '🧪',
  defaultWidth: 1200,
  defaultHeight: 800,
};
```

### Step 3 — Register LabLauncherApp in registerAllApps

**File to modify:** `packages/rb-apps/src/index.ts`

Find the `registerAllApps` function. In the `'e2e-boot'` block (and `'full'` block), add registration for `lab-launcher`:

```typescript
// Near top of file, add import:
import { LabLauncherApp, labLauncherAppManifest } from './apps/LabLauncherApp';

// Inside registerAllApps, in ALL mode branches (e2e-boot, e2e-lite, full):
registerApp({
  manifest: labLauncherAppManifest,
  Component: LabLauncherApp,
});
```

### Step 4 — Make launcher the boot default

**File to modify:** `packages/rb-shell/src/Shell.tsx`

Find where the shell decides which app to open at startup (look for `resolveFirstRunTargetApp` or similar routing logic). Replace the default target with `'lab-launcher'`:

```typescript
// Replace whatever the default boot app is with:
const defaultBootApp = 'lab-launcher';
```

Also ensure `shouldGateStudioEntry` can never block students — confirm it returns `false` in all paths. If it has any conditional that could gate entry, remove the condition.

### Step 5 — Verify: Open browser → see launcher

Run: `pnpm --filter playground dev`

Expected:
- Browser opens to a dark full-screen launcher
- 8 lab cards visible in a grid
- Lab 4 shows "ACTIVE" badge with red pulse
- Labs 1–3 show "COMPLETED" in green
- Labs 5–8 show "UPCOMING" in grey
- No wizard. No hardware gate. No OS desktop.

### Step 6 — Commit

```bash
git add packages/rb-apps/src/components/LabLauncher.tsx \
        packages/rb-apps/src/apps/LabLauncherApp.tsx \
        packages/rb-apps/src/index.ts \
        packages/rb-shell/src/Shell.tsx
git commit -m "feat(launcher): add Lab Launcher as default student entry point"
```

---

## Task 2: Lab 4 Integration Template

**Goal:** Opening Lab 4 shows a pre-wired scaffold with verified sub-components (adder, mux, decoder) already placed. Students wire them together — they don't build from scratch.

**Files:**
- Modify: `packages/rb-apps/src/labs/labDefinitions.ts` (Lab 4 build steps)
- Verify/create: `packages/rb-apps/src/examples/` (Lab 4 example with pre-built blocks)
- Modify: `packages/rb-apps/src/starterKits/labStarterKits.ts` if needed

---

### Step 1 — Read the current Lab 4 definition

Open `packages/rb-apps/src/labs/labDefinitions.ts` lines 167–205. Read the `buildSteps`, `whatToDo`, and `starterId` fields.

Check `packages/rb-apps/src/examples/` for a file named with `alu` in it (e.g., `13.ts`, `14.ts`). Read it to see what the example circuit contains.

### Step 2 — Update Lab 4 `whatToDo` and `buildSteps`

In `labDefinitions.ts`, find the Lab 4 entry and update:

```typescript
{
  id: 'lab4',
  title: 'ALU with Opcode Control',
  whatToDo: `Wire the pre-built adder, mux, and decoder to build a working ALU.
You are NOT designing arithmetic from scratch — the building blocks are already verified.
Your job: connect the datapath, route the opcode lines, map inputs/outputs to Basys3 pins,
verify all 4 operations pass, then export VHDL for Vivado.`,

  buildSteps: [
    'Find the pre-placed Adder4 block — its inputs are A[3:0] and B[3:0]',
    'Find the pre-placed Mux4 block — connect the adder output and logic outputs to its inputs',
    'Connect opcode switches SW[2:0] (BTN on Basys3) to the decoder/mux select lines',
    'Route the result output to LED[3:0]',
    'Route carry-out flag to LED[4]',
    'Verify: set opcode=000 (AND), confirm LEDs match SW[3:0] AND SW[7:4]',
    'Verify: set opcode=100 (ADD), confirm LEDs show the sum',
    'Run full test suite in Verify tab — all rows must pass',
    'Export for Basys3 and import into Vivado',
  ],
  // ... keep all other fields as-is
}
```

### Step 3 — Verify the example fixture has pre-placed blocks

Open the ALU example in `packages/rb-apps/src/examples/`. If it has a blank starting canvas (just IO pins), that's correct for a starter. If it has a fully solved ALU, that violates the contract.

The starter must have:
- ✅ Switch input nodes labeled SW0–SW7 (for A and B operands)
- ✅ Button input nodes labeled BTN0–BTN2 (for opcode)
- ✅ LED output nodes labeled LED0–LED4
- ✅ An `Adder4` chip block placed but NOT wired
- ✅ A `MUX4` chip block placed but NOT wired
- ✅ A `Decoder3to8` chip block placed but NOT wired
- ❌ No wires connecting the blocks (students do this)

If the example is fully solved, create a new example that is the unsolved version.

### Step 4 — Commit

```bash
git add packages/rb-apps/src/labs/labDefinitions.ts
git commit -m "feat(lab4): reframe as system integration lab with pre-built blocks"
```

---

## Task 3: VHDL Generator

**Goal:** Generate readable, synthesizable VHDL from the circuit netlist. Output is `top.vhd` with real signal names — not `n1`, `n2`.

**Files:**
- Create: `packages/rb-apps/src/export/vhdlExport.ts`
- Test: `packages/rb-apps/src/export/__tests__/vhdlExport.test.ts`

---

### Step 1 — Write a failing test first

Create `packages/rb-apps/src/export/__tests__/vhdlExport.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { vhdlFromNetlist } from '../vhdlExport';
import type { Netlist } from '../netlistExport';

describe('vhdlFromNetlist', () => {
  it('generates a valid entity/architecture for a simple AND circuit', () => {
    const netlist: Netlist = {
      inputs: [
        { id: 'sw0', label: 'SW0', portName: 'SW(0)' },
        { id: 'sw1', label: 'SW1', portName: 'SW(1)' },
      ],
      outputs: [
        { id: 'led0', label: 'LED0', portName: 'LED(0)' },
      ],
      nodes: [
        { id: 'and1', type: 'AND', inputs: ['sw0', 'sw1'], outputs: ['led0'] },
      ],
      connections: [
        { from: { nodeId: 'sw0', port: 'out' }, to: { nodeId: 'and1', port: 'a' } },
        { from: { nodeId: 'sw1', port: 'out' }, to: { nodeId: 'and1', port: 'b' } },
        { from: { nodeId: 'and1', port: 'out' }, to: { nodeId: 'led0', port: 'in' } },
      ],
    };

    const result = vhdlFromNetlist(netlist, { entityName: 'top' });

    expect(result.vhd).toContain('entity top is');
    expect(result.vhd).toContain('architecture rtl of top');
    expect(result.vhd).toContain('SW : in');
    expect(result.vhd).toContain('LED : out');
    expect(result.vhd).toContain('end entity top');
    expect(result.vhd).toContain('end architecture rtl');
    // Signal names must be meaningful — not auto-numbered
    expect(result.vhd).not.toMatch(/\bsig_\d{5,}/);
  });

  it('handles vector ports correctly', () => {
    const netlist: Netlist = {
      inputs: [{ id: 'sw', label: 'SW', portName: 'SW', width: 4 }],
      outputs: [{ id: 'led', label: 'LED', portName: 'LED', width: 4 }],
      nodes: [],
      connections: [],
    };

    const result = vhdlFromNetlist(netlist, { entityName: 'top' });
    expect(result.vhd).toContain('STD_LOGIC_VECTOR(3 downto 0)');
  });
});
```

Run: `pnpm --filter rb-apps test export/__tests__/vhdlExport.test.ts`
Expected: FAIL with "Cannot find module '../vhdlExport'"

### Step 2 — Implement the VHDL generator

Create `packages/rb-apps/src/export/vhdlExport.ts`:

```typescript
/**
 * VHDL generator for RedByte circuits.
 *
 * Produces clean, readable VHDL (entity/architecture) from a circuit netlist.
 * Output is VHDL-2008 compatible and synthesizable in Vivado.
 *
 * VHDL is the NON-NEGOTIABLE student-facing HDL for this project.
 * See: docs/plans/RED_BYTE_IDE_CONTRACT.md
 */

import type { Netlist, NetlistInput, NetlistOutput } from './netlistExport';

export interface VhdlExportOptions {
  entityName?: string;
  architecture?: string;
  includeFileHeader?: boolean;
  labTitle?: string;
}

export interface VhdlExportResult {
  vhd: string;
  entityName: string;
  inputPorts: string[];
  outputPorts: string[];
  warnings: string[];
}

// Maps RedByte gate types to VHDL operator/component names
const GATE_TO_VHDL_OP: Record<string, string> = {
  AND: 'and',
  OR: 'or',
  NOT: 'not',
  NAND: 'nand',
  NOR: 'nor',
  XOR: 'xor',
  XNOR: 'xnor',
};

function portDeclaration(name: string, direction: 'in' | 'out', width?: number): string {
  const type =
    width && width > 1
      ? `STD_LOGIC_VECTOR(${width - 1} downto 0)`
      : 'STD_LOGIC';
  return `    ${name.padEnd(12)}: ${direction.padEnd(4)} ${type}`;
}

function sanitizeName(raw: string): string {
  // Make a valid VHDL identifier: lowercase, underscores, no leading digits
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^(\d)/, 's_$1')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'sig';
}

function signalName(nodeId: string, label?: string): string {
  if (label && label.trim()) return sanitizeName(label);
  return `sig_${nodeId.slice(0, 8)}`;
}

export function vhdlFromNetlist(
  netlist: Netlist,
  options: VhdlExportOptions = {}
): VhdlExportResult {
  const entityName = options.entityName ?? 'top';
  const archName = options.architecture ?? 'rtl';
  const warnings: string[] = [];

  const inputs = netlist.inputs ?? [];
  const outputs = netlist.outputs ?? [];
  const nodes = netlist.nodes ?? [];
  const connections = netlist.connections ?? [];

  // Build port lists
  const inputPorts = inputs.map((p) => portDeclaration(p.portName ?? p.label, 'in', p.width));
  const outputPorts = outputs.map((p) => portDeclaration(p.portName ?? p.label, 'out', p.width));

  // Build internal signal declarations
  const signalDecls: string[] = [];
  const signalMap = new Map<string, string>(); // nodeId → vhdl signal name

  // Map input/output port names
  for (const inp of inputs) {
    signalMap.set(inp.id, sanitizeName(inp.portName ?? inp.label));
  }
  for (const out of outputs) {
    signalMap.set(out.id, sanitizeName(out.portName ?? out.label));
  }

  // Internal wires for gate outputs
  for (const node of nodes) {
    if (GATE_TO_VHDL_OP[node.type]) {
      const name = signalName(node.id, node.label);
      signalMap.set(node.id, name);
      signalDecls.push(`  signal ${name.padEnd(16)}: STD_LOGIC;`);
    } else {
      warnings.push(`Unsupported node type: ${node.type} (id: ${node.id}) — skipped`);
    }
  }

  // Build concurrent signal assignment statements
  const statements: string[] = [];
  for (const node of nodes) {
    const op = GATE_TO_VHDL_OP[node.type];
    if (!op) continue;

    const outSig = signalMap.get(node.id) ?? `sig_${node.id.slice(0, 8)}`;

    // Find input connections for this node
    const inConns = connections.filter((c) => c.to.nodeId === node.id);
    const inSignals = inConns.map(
      (c) => signalMap.get(c.from.nodeId) ?? `open`
    );

    if (node.type === 'NOT') {
      statements.push(`  ${outSig} <= not ${inSignals[0] ?? 'open'};`);
    } else if (inSignals.length >= 2) {
      statements.push(`  ${outSig} <= ${inSignals.join(` ${op} `)};`);
    } else {
      warnings.push(`Node ${node.id} (${node.type}) has fewer than 2 inputs — skipped`);
    }
  }

  // Connect output ports
  for (const out of outputs) {
    const inConn = connections.find((c) => c.to.nodeId === out.id);
    if (inConn) {
      const srcSig = signalMap.get(inConn.from.nodeId) ?? 'open';
      const outSig = sanitizeName(out.portName ?? out.label);
      statements.push(`  ${outSig} <= ${srcSig};`);
    } else {
      warnings.push(`Output ${out.label} is unconnected`);
    }
  }

  // Assemble VHDL
  const fileHeader = options.includeFileHeader
    ? [
        `-- RedByte Generated VHDL`,
        `-- ${options.labTitle ?? entityName}`,
        `-- Board: Basys3 (Artix-7 XC7A35T)`,
        `-- Generated by RedByte IDE — redbyteapps.dev`,
        `--`,
        `-- This file is synthesizable in Vivado. Import top.vhd + top.xdc`,
        `-- to create a new project. See the included README.txt for steps.`,
        ``,
      ].join('\n')
    : '';

  const allPorts = [...inputPorts, ...outputPorts];
  const portBlock =
    allPorts.length > 0
      ? `  Port (\n${allPorts.join(';\n')}\n  );`
      : '';

  const vhd = [
    fileHeader,
    `library IEEE;`,
    `use IEEE.STD_LOGIC_1164.ALL;`,
    `use IEEE.NUMERIC_STD.ALL;`,
    ``,
    `entity ${entityName} is`,
    portBlock,
    `end entity ${entityName};`,
    ``,
    `architecture ${archName} of ${entityName} is`,
    ...(signalDecls.length > 0 ? signalDecls : []),
    `begin`,
    ``,
    ...(statements.length > 0 ? statements : [`  -- TODO: add logic`]),
    ``,
    `end architecture ${archName};`,
  ]
    .filter((line) => line !== undefined)
    .join('\n');

  return {
    vhd,
    entityName,
    inputPorts: inputs.map((p) => p.portName ?? p.label),
    outputPorts: outputs.map((p) => p.portName ?? p.label),
    warnings,
  };
}
```

### Step 3 — Run the test

Run: `pnpm --filter rb-apps test export/__tests__/vhdlExport.test.ts`
Expected: PASS

If there are type errors around `Netlist` — read `packages/rb-apps/src/export/netlistExport.ts` and adjust the type imports to match the actual exported types.

### Step 4 — Commit

```bash
git add packages/rb-apps/src/export/vhdlExport.ts \
        packages/rb-apps/src/export/__tests__/vhdlExport.test.ts
git commit -m "feat(export): add VHDL generator with readable entity/architecture output"
```

---

## Task 4: VHDL Export Bundle (ZIP)

**Goal:** The "Export for Basys3" button produces a ZIP with `top.vhd`, `top.xdc`, and `README.txt`. Not Verilog. VHDL.

**Files:**
- Modify: `packages/rb-apps/src/fpga/boards/basys3/basys3Bundle.ts`
- Modify (or create wrapper): wherever "Export for Basys3" button triggers export

---

### Step 1 — Read the existing basys3Bundle.ts

Open `packages/rb-apps/src/fpga/boards/basys3/basys3Bundle.ts`. Understand the current `Basys3BundleResult` interface and the `topV` field.

### Step 2 — Add VHDL output to bundle

In `basys3Bundle.ts`, add a `topVhd` field to the result interface and generate it:

```typescript
// Add to Basys3BundleResult interface:
export interface Basys3BundleResult {
  topV: string;       // Verilog — keep for internal use only
  topVhd: string;     // VHDL — this is the student-facing output
  topXdc: string;
  readme: string;
  warnings: string[];
  valid: boolean;
}

// In the bundle generation function, after generating topV, add:
import { vhdlFromNetlist } from '../../../export/vhdlExport';

const vhdlResult = vhdlFromNetlist(netlist, {
  entityName: 'top',
  includeFileHeader: true,
  labTitle: labTitle ?? 'Lab Export',
});

// Then include in the returned bundle:
return {
  topV,           // internal only
  topVhd: vhdlResult.vhd,   // student-facing
  topXdc,
  readme: generateReadme(labTitle),
  warnings: [...warnings, ...vhdlResult.warnings],
  valid: vhdlResult.warnings.length === 0,
};
```

### Step 3 — Generate a student-readable README

In `basys3Bundle.ts`, add a `generateReadme` function:

```typescript
function generateReadme(labTitle?: string): string {
  return `RedByte Export — ${labTitle ?? 'Lab'}
Board: Digilent Basys3 (Artix-7 XC7A35T-1CPG236C)
Language: VHDL-2008
Generated by RedByte IDE — redbyteapps.dev

FILES IN THIS PACKAGE
  top.vhd         — Main VHDL entity/architecture (synthesizable)
  top.xdc         — Basys3 pin constraints (Xilinx Design Constraints)
  README.txt      — This file

HOW TO IMPORT INTO VIVADO (5 steps)
  1. Open Vivado → Create Project → RTL Project → Next
  2. Add Sources → Add Files → select top.vhd → Next
  3. Add Constraints → Add Files → select top.xdc → Next
  4. Select part: xc7a35tcpg236-1 → Finish
  5. Flow Navigator → Generate Bitstream → Program Device

SIGNAL MAPPING (Lab ${labTitle ?? ''})
  SW[3:0]  — Input A (4-bit operand)
  SW[7:4]  — Input B (4-bit operand)
  BTN[2:0] — Opcode select (see lab handout for opcode table)
  LED[3:0] — ALU result output
  LED[4]   — Carry-out flag

If synthesis fails, check that all ports in top.vhd match top.xdc exactly.
Contact your TA if Vivado reports "port not found in design."
`.trim();
}
```

### Step 4 — Update the Export button to use VHDL

Find where the export ZIP is assembled (search for `rb-lab.zip` or `deterministicZip` usage in the export flow). Change the file added to the ZIP from `topV` to `topVhd`, and rename the file in the ZIP to `top.vhd` instead of `top.v`:

```typescript
// In the ZIP assembly:
// BEFORE:
zipFiles.push({ name: 'top.v', content: bundle.topV });
// AFTER:
zipFiles.push({ name: 'top.vhd', content: bundle.topVhd });
zipFiles.push({ name: 'top.xdc', content: bundle.topXdc });
zipFiles.push({ name: 'README.txt', content: bundle.readme });
```

### Step 5 — Verify manually

Build and run the playground. Open Lab 4. Design something (even just IO pins connected). Click Export. Open the downloaded ZIP. Confirm:
- `top.vhd` exists and contains `entity top is` and `architecture rtl`
- `top.xdc` exists and has `set_property` lines for Basys3 pins
- `README.txt` exists with the 5-step Vivado guide

### Step 6 — Commit

```bash
git add packages/rb-apps/src/fpga/boards/basys3/basys3Bundle.ts
git commit -m "feat(export): add VHDL-first bundle — top.vhd as primary student output"
```

---

## Task 5: Vivado Handoff (Inline + Printable)

**Goal:** After a student exports, they see a clear 5-step Vivado guide directly in the Export mode UI — no separate link, no hunting.

**Files:**
- Create: `packages/rb-apps/src/components/VivadoHandoffPanel.tsx`
- Modify: wherever the Export mode UI is rendered (find the Export button area)

---

### Step 1 — Create the handoff panel component

Create `packages/rb-apps/src/components/VivadoHandoffPanel.tsx`:

```tsx
import React from 'react';

const STEPS = [
  {
    n: 1,
    title: 'Create Vivado Project',
    body: 'Open Vivado → Create Project → Name it → RTL Project → Next (leave "do not add sources" unchecked)',
  },
  {
    n: 2,
    title: 'Add top.vhd',
    body: 'Add Sources → Add Files → select top.vhd from your downloaded ZIP → set as top module → Next',
  },
  {
    n: 3,
    title: 'Add top.xdc',
    body: 'Add Constraints → Add Files → select top.xdc from your ZIP → Next → Finish',
  },
  {
    n: 4,
    title: 'Generate Bitstream',
    body: 'Flow Navigator (left sidebar) → Generate Bitstream → click OK through any dialogs → wait ~2 min',
  },
  {
    n: 5,
    title: 'Program the Basys3',
    body: 'Open Hardware Manager (bottom of Flow Navigator) → Open Target → Auto Connect → Program Device → select .bit file → Program',
  },
];

interface Props {
  labTitle?: string;
  onPrint?: () => void;
}

export const VivadoHandoffPanel: React.FC<Props> = ({ labTitle, onPrint }) => {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Vivado Handoff Guide</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {labTitle ?? 'Lab'} — 5 steps to program your Basys3
          </p>
        </div>
        {onPrint && (
          <button
            onClick={onPrint}
            className="text-xs px-3 py-1.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            Print / Save PDF
          </button>
        )}
      </div>

      {/* Steps */}
      <ol className="space-y-3">
        {STEPS.map((step) => (
          <li key={step.n} className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-bold flex items-center justify-center mt-0.5">
              {step.n}
            </span>
            <div>
              <p className="text-sm font-medium text-zinc-200">{step.title}</p>
              <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* Board target */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
        <p className="text-xs text-zinc-500">
          Target part:{' '}
          <code className="text-zinc-300 font-mono">xc7a35tcpg236-1</code>
          {' '}(Basys3 / Artix-7)
        </p>
      </div>
    </div>
  );
};
```

### Step 2 — Embed in the Export mode UI

Find the Export mode component (search for where the "Export for Basys3" button is rendered — likely in `DeployMode.tsx` or a similar component in `packages/rb-apps/src/components/`). After the export success state renders, render `<VivadoHandoffPanel>`:

```tsx
import { VivadoHandoffPanel } from './VivadoHandoffPanel';

// After the export success panel (where the file listing and SHA appear):
{exportResult && (
  <div className="mt-6">
    <VivadoHandoffPanel
      labTitle={currentLab?.title}
      onPrint={() => window.print()}
    />
  </div>
)}
```

### Step 3 — Verify

Export from Lab 4. After the ZIP downloads, the Vivado handoff guide appears inline on the same screen. The "Print / Save PDF" button opens the browser print dialog.

### Step 4 — Commit

```bash
git add packages/rb-apps/src/components/VivadoHandoffPanel.tsx
git commit -m "feat(export): add inline Vivado handoff guide after export success"
```

---

## Final Acceptance Checklist

Before calling this complete, verify ALL of the following (per the contract's Section 8 violation conditions):

- [ ] Fresh browser → `redbyteapps.dev/os` → **no wizard**, no hardware gate, **sees Lab Launcher**
- [ ] All 8 lab cards visible, Lab 4 shows ACTIVE
- [ ] Click Lab 4 → sees pre-built blocks (adder, mux, decoder), tasks panel with wiring steps
- [ ] Student cannot reach lab3-webapp or any legacy app from the launcher
- [ ] Click Export → downloads ZIP → ZIP contains `top.vhd` (VHDL), `top.xdc`, `README.txt`
- [ ] Open `top.vhd` — contains `entity top is`, real signal names (not `n_12345`), `architecture rtl`
- [ ] Paste `top.vhd` into Vivado — synthesizes without manual edits
- [ ] Vivado handoff panel visible after export without navigating away
- [ ] Every UI surface looks finished (dark theme, red accents, no placeholder divs)

---

## Out of Scope for v1

Do NOT implement these — they violate YAGNI and will slip the deadline:

- Canvas snap/grid constraints (Design mode) — complex, non-blocking for Lab 4
- Multi-board support
- Verilog shown to students
- Collaborative editing
- Bitstream generation inside RedByte
- Any new CI gates
