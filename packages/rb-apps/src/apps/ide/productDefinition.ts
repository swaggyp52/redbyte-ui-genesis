import type { IdeSurfaceMode } from './components/IdeWorkbenchShell';

export type ProductSpinePageKey = IdeSurfaceMode;

export interface ProductSpinePageDefinition {
  key: ProductSpinePageKey;
  order: number;
  label: string;
  shortLabel: string;
  job: string;
  nextAction: string;
  doneCondition: string;
  blockedState: string;
  recovery: string;
  proofBoundary: string;
}

export const PRODUCT_SPINE_ORDER: readonly ProductSpinePageKey[] = [
  'project',
  'design',
  'verify',
  'hardware',
  'export',
  'import',
] as const;

export const PRODUCT_SPINE_DEFINITIONS: Record<ProductSpinePageKey, ProductSpinePageDefinition> = {
  project: {
    key: 'project',
    order: 1,
    label: 'Project',
    shortLabel: 'Project',
    job: 'Choose the active lab, blank design, saved project, starter, or recovery path.',
    nextAction: 'What do I do next? Start a lab, build fresh, recover/import, or continue the loaded project.',
    doneCondition: 'A circuit is loaded and the next surface is obvious.',
    blockedState: 'No circuit loaded yet.',
    recovery: 'Use Import / Recover or Open Recent without replacing current work by surprise.',
    proofBoundary: 'Project chooses work. It does not prove behavior, pins, export, Vivado, or hardware.',
  },
  design: {
    key: 'design',
    order: 2,
    label: 'Design',
    shortLabel: 'Design',
    job: 'Build and repair the circuit graph with visible parts, wires, labels, and diagnostics.',
    nextAction: 'What do I do next? Place parts, wire signals, resolve circuit issues, then open Verify.',
    doneCondition: 'The circuit graph matches the assignment and has the required inputs and outputs.',
    blockedState: 'Circuit is empty, disconnected, or has authoring diagnostics.',
    recovery: 'Select a part, inspect the issue, undo, delete, swap the gate, or return from Verify with failure context.',
    proofBoundary: 'Design can show graph health and live propagation. Compare proof belongs in Verify.',
  },
  verify: {
    key: 'verify',
    order: 3,
    label: 'Verify',
    shortLabel: 'Verify',
    job: 'Author stimulus, expected outputs, observed outputs, Compare results, and repair evidence.',
    nextAction: 'What do I do next? Run Compare, inspect the first mismatch, repair checks or design, then rerun.',
    doneCondition: 'Compare PASS is current for the saved design and testbench.',
    blockedState: 'No circuit, no stimulus, stale evidence, or Compare FAIL.',
    recovery: 'Use observed values only when the testbench is wrong; inspect Design when the circuit is wrong.',
    proofBoundary: 'Verify proves browser E0 behavior only. It does not prove Vivado or board behavior.',
  },
  hardware: {
    key: 'hardware',
    order: 4,
    label: 'Hardware / Map Pins',
    shortLabel: 'Map Pins',
    job: 'Map required pins by binding project signals to Basys3 board resources, package pins, and XDC consequences.',
    nextAction: 'What do I do next? Map required pins, fix conflicts, review clock/reset roles, then export.',
    doneCondition: 'Required signals have coherent Basys3 resource and package pin assignments.',
    blockedState: 'Required pins are missing, conflicting, or not clock-capable where needed.',
    recovery: 'Select a row, choose a known Basys3 resource, or return to Design when the IO boundary is wrong.',
    proofBoundary: 'Hardware maps browser package intent. E1, bitstream, and board observation stay external.',
  },
  export: {
    key: 'export',
    order: 5,
    label: 'Export',
    shortLabel: 'Export',
    job: 'Inspect and download the current RedByte/Vivado handoff package.',
    nextAction: 'What do I do next? Build the current package or fix Verify, Map Pins, or Design blockers first.',
    doneCondition: 'The generated package is current, inspectable, and browser E0 ready.',
    blockedState: 'Design, Compare, mapping, or package artifacts are stale or blocked.',
    recovery: 'Follow the blocker owner back to Design, Verify, or Map Pins, then rebuild the package.',
    proofBoundary: 'Export creates a Vivado handoff. Vivado build, bitstream, and board proof are not claimed.',
  },
  import: {
    key: 'import',
    order: 6,
    label: 'Import / Recovery',
    shortLabel: 'Import',
    job: 'Review external RedByte, Vivado, HDL, and XDC sources before replacing the active project.',
    nextAction: 'What do I do next? Upload or paste, parse, map ports, review schematic, then confirm apply.',
    doneCondition: 'The candidate is reviewed and explicitly applied, or safely canceled.',
    blockedState: 'Parser warnings, unsupported HDL, unmapped ports, or apply confirmation pending.',
    recovery: 'Cancel keeps the current project. Start fresh in Design when migration fidelity is too weak.',
    proofBoundary: 'Import is recovery, not broad HDL migration proof, Vivado proof, or hardware proof.',
  },
};

export function getProductSpineDefinition(page: ProductSpinePageKey): ProductSpinePageDefinition {
  return PRODUCT_SPINE_DEFINITIONS[page];
}

export function getProductSpineProgress(page: ProductSpinePageKey): string {
  const current = PRODUCT_SPINE_DEFINITIONS[page];
  return `${current.order}/${PRODUCT_SPINE_ORDER.length}`;
}
