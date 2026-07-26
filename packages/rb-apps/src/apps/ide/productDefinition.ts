import type { IdeSurfaceMode } from './components/IdeWorkbenchShell';

export type ProductSpinePageKey = IdeSurfaceMode;
export type ProductWorkflowStageKey = Exclude<ProductSpinePageKey, 'import'>;
export type ProductSurfaceKind = 'workflow-stage' | 'utility';

export interface ProductSpinePageDefinition {
  key: ProductSpinePageKey;
  kind: ProductSurfaceKind;
  order: number | null;
  label: string;
  shortLabel: string;
  job: string;
  primaryObject: string;
  stableRegions: readonly string[];
  keyStates: readonly string[];
  primaryAction: string;
  secondaryActions: readonly string[];
  emptyState: string;
  nextAction: string;
  doneCondition: string;
  blockedState: string;
  recovery: string;
  owns: readonly string[];
  reads: readonly string[];
  excludes: readonly string[];
  proofBoundary: string;
}

export interface UnifiedWorkbenchShellContract {
  topProductBar: readonly string[];
  stageNavigation: readonly ProductWorkflowStageKey[];
  pageHeader: readonly string[];
  workspace: string;
  forbiddenCorePatterns: readonly string[];
}

/** The student journey. Import is deliberately not a sixth workflow stage. */
export const PRODUCT_WORKFLOW_ORDER: readonly ProductWorkflowStageKey[] = [
  'project',
  'design',
  'verify',
  'hardware',
  'export',
] as const;

export const PRODUCT_UTILITY_ORDER = ['import'] as const;

/** All primary IDE surfaces, including utilities. */
export const PRODUCT_SURFACE_ORDER: readonly ProductSpinePageKey[] = [
  ...PRODUCT_WORKFLOW_ORDER,
  ...PRODUCT_UTILITY_ORDER,
] as const;

/** @deprecated Use PRODUCT_WORKFLOW_ORDER or PRODUCT_SURFACE_ORDER explicitly. */
export const PRODUCT_SPINE_ORDER = PRODUCT_WORKFLOW_ORDER;

/** Shared page grammar for Unified Workbench v3. */
export const UNIFIED_WORKBENCH_V3_SHELL_CONTRACT: UnifiedWorkbenchShellContract = {
  topProductBar: ['RedByte identity', 'Project name', 'Board target', 'Save state', 'Import utility', 'Help'],
  stageNavigation: PRODUCT_WORKFLOW_ORDER,
  pageHeader: ['Page title', 'One-sentence job', 'Current semantic status', 'One primary action', 'At most one recovery action'],
  workspace: 'The primary work object receives all remaining space inside one stable page frame.',
  forbiddenCorePatterns: [
    'Permanent workflow side rail',
    'Floating edge rail toggles',
    'Core workflow hidden in details or summary disclosures',
    'Manual hide or show controls for stable work regions',
    'Duplicate page command strips',
    'Passive pill clouds',
    'Permanent footer status strip',
  ],
};

export const PRODUCT_SPINE_DEFINITIONS: Record<ProductSpinePageKey, ProductSpinePageDefinition> = {
  project: {
    key: 'project',
    kind: 'workflow-stage',
    order: 1,
    label: 'Project',
    shortLabel: 'Project',
    job: 'Understand the active project, its readiness, and the next useful step.',
    primaryObject: 'Project overview',
    stableRegions: ['Project identity', 'Engineering summary', 'Next action', 'Project alternatives'],
    keyStates: ['No project', 'Ready to design', 'Blocked', 'Ready for next stage'],
    primaryAction: 'Continue the next incomplete stage',
    secondaryActions: ['Start Lab', 'Build Fresh', 'Open Starter', 'Import', 'Open Existing'],
    emptyState: 'Start a Lab is primary; blank, starter, import, and existing-project paths remain visibly secondary.',
    nextAction: 'What do I do next? Continue the next incomplete stage or choose different work.',
    doneCondition: 'A project is loaded and its next incomplete stage is clear.',
    blockedState: 'No project is loaded, or the current project has no usable design boundary.',
    recovery: 'Choose a recent project, starter, blank design, or reviewed import candidate.',
    owns: ['Project identity', 'Project selection', 'Workflow overview'],
    reads: ['Design readiness', 'Verification freshness', 'Mapping readiness', 'Export readiness'],
    excludes: ['Pin editors', 'Waveform controls', 'Generated-file diagnostics', 'Floating workflow orientation'],
    proofBoundary: 'Project summarizes current evidence. It does not edit mappings or prove circuit behavior.',
  },
  design: {
    key: 'design',
    kind: 'workflow-stage',
    order: 2,
    label: 'Design',
    shortLabel: 'Design',
    job: 'Build and repair the logical circuit on a canvas-first workspace.',
    primaryObject: 'Circuit canvas',
    stableRegions: ['Component library', 'Circuit canvas', 'Inspector', 'Direct authoring toolbar'],
    keyStates: ['Empty', 'Editing', 'Structurally blocked', 'Ready to verify'],
    primaryAction: 'Edit the circuit',
    secondaryActions: ['Open Verify', 'Open Diagnostics'],
    emptyState: 'The stable library, empty canvas, and circuit overview remain visible with a direct first placement path.',
    nextAction: 'What do I do next? Build the circuit, resolve structural diagnostics, then open Verify.',
    doneCondition: 'The logical IO boundary exists and no blocking structural diagnostic remains.',
    blockedState: 'The circuit is empty, disconnected, or has a blocking structural diagnostic.',
    recovery: 'Inspect the selected object or diagnostic, then repair, undo, replace, or delete it.',
    owns: ['Logical graph', 'Circuit IO boundary', 'Design-time diagnostics'],
    reads: ['Project identity', 'Verification failure context'],
    excludes: ['Workflow rail toggles', 'Irrelevant board lessons for internal gates', 'Compare proof controls'],
    proofBoundary: 'Design reports structural readiness and live propagation only. Compare proof belongs in Verify.',
  },
  verify: {
    key: 'verify',
    kind: 'workflow-stage',
    order: 3,
    label: 'Verify',
    shortLabel: 'Verify',
    job: 'Develop a named testbench and compare expected behavior with observed circuit behavior.',
    primaryObject: 'Simulation Studio',
    stableRegions: ['Testbench tabs and editor', 'Run controls', 'Waveform and results'],
    keyStates: ['No cases', 'Draft', 'Current PASS', 'Stale', 'FAIL'],
    primaryAction: 'Run Compare',
    secondaryActions: ['Run Observe', 'Repair expected output', 'Inspect circuit'],
    emptyState: 'A quiet waveform workspace explains how to author and run the first testbench without hiding the editor.',
    nextAction: 'What do I do next? Add cases, run Compare, inspect the first mismatch, repair, and rerun.',
    doneCondition: 'Compare PASS is current for the saved design and testbench.',
    blockedState: 'There are no runnable cases, evidence is stale, or Compare reports a mismatch.',
    recovery: 'Repair expected values or stimulus when the testbench is wrong; open Design when the circuit is wrong.',
    owns: ['Testbench cases', 'Stimulus', 'Expected values', 'Observed values', 'Compare evidence'],
    reads: ['Logical circuit', 'Project signal boundary'],
    excludes: ['Mapping controls', 'Multiple competing run authorities', 'Nested essential disclosures', 'Quiz-style detached status fragments'],
    proofBoundary: 'Verify proves browser E0 behavior only. It does not prove Vivado or board behavior.',
  },
  hardware: {
    key: 'hardware',
    kind: 'workflow-stage',
    order: 4,
    label: 'Map Pins',
    shortLabel: 'Map Pins',
    job: 'Bind project signals to valid Basys3 resources and package pins.',
    primaryObject: 'Pin mapping table',
    stableRegions: ['Progress header', 'Mapping table', 'Selected-signal editor', 'Board reference'],
    keyStates: ['Unmapped', 'Partially mapped', 'Conflicted', 'Ready to export'],
    primaryAction: 'Assign the selected signal',
    secondaryActions: ['Clear assignment', 'Open Design for IO repair'],
    emptyState: 'Explain that Design must expose project signals before mapping; do not render an error-report wall.',
    nextAction: 'What do I do next? Assign required signals, resolve conflicts, then open Export.',
    doneCondition: 'Every required signal has one coherent Basys3 resource and package-pin assignment.',
    blockedState: 'A required signal is unmapped, conflicting, or assigned to an invalid resource.',
    recovery: 'Select the affected row and choose a valid board resource, or repair the IO boundary in Design.',
    owns: ['Board resource assignment', 'Package pin assignment', 'Mapping conflicts'],
    reads: ['Project signal boundary', 'Board resource catalog'],
    excludes: ['Verify repair controls', 'After-mapping disclosures', 'Dominant board artwork', 'Hidden conflict diagnostics'],
    proofBoundary: 'Map Pins records browser package intent. Vivado and board proof remain external.',
  },
  export: {
    key: 'export',
    kind: 'workflow-stage',
    order: 5,
    label: 'Export',
    shortLabel: 'Export',
    job: 'Review readiness, inspect generated artifacts, and download the current handoff package.',
    primaryObject: 'Export package',
    stableRegions: ['Readiness decision', 'Package contents', 'Selected-file preview', 'Submission guidance'],
    keyStates: ['Blocked', 'Ready to build', 'Current package', 'Stale package'],
    primaryAction: 'Build or download the package',
    secondaryActions: ['Download Draft when policy permits', 'Open Technical evidence'],
    emptyState: 'Name the owning prerequisite and route to one repair action without presenting unusable files.',
    nextAction: 'What do I do next? Resolve the named owner-stage blocker, or build and download the package.',
    doneCondition: 'The generated package is current, inspectable, and ready for browser E0 handoff.',
    blockedState: 'Design, Compare, mapping, or generated artifacts are stale or blocked.',
    recovery: 'Follow the named blocker to Design, Verify, or Map Pins, then return and rebuild.',
    owns: ['Package generation', 'Artifact preview', 'Package download'],
    reads: ['Design readiness', 'Current Compare evidence', 'Pin mapping readiness'],
    excludes: ['Pin editors', 'Dominant proof-debug panels', 'Repeated E0 labels', 'Core file trees hidden in disclosures'],
    proofBoundary: 'Export creates a Vivado handoff. Vivado build, bitstream, and board proof are not claimed.',
  },
  import: {
    key: 'import',
    kind: 'utility',
    order: null,
    label: 'Import / Recovery',
    shortLabel: 'Import',
    job: 'Create a reviewable project candidate from supported external files without replacing current work.',
    primaryObject: 'Import candidate',
    stableRegions: ['Horizontal Upload / Review / Apply stepper', 'Active step workspace', 'Candidate safety boundary'],
    keyStates: ['Upload', 'Review', 'Ready to apply', 'Blocked', 'Applied'],
    primaryAction: 'Upload, review, then apply',
    secondaryActions: ['Paste HDL', 'Use structural sample', 'Cancel and keep current work'],
    emptyState: 'Show one ZIP chooser with Paste HDL and sample paths as secondary options.',
    nextAction: 'What do I do next? Upload source, review the candidate and warnings, then explicitly apply or cancel.',
    doneCondition: 'The reviewed candidate is explicitly applied, or safely canceled.',
    blockedState: 'Source is unsupported, parsing failed, ports are unresolved, or review is incomplete.',
    recovery: 'Cancel keeps the current project. Fix the source or start fresh when migration fidelity is too weak.',
    owns: ['Candidate parsing', 'Candidate review', 'Explicit apply or cancel'],
    reads: ['External source files', 'Current project identity'],
    excludes: ['Internal vertical workflow rail', 'Competing source-mode navigation', 'Apply before review', 'Workflow-stage status'],
    proofBoundary: 'Import is a recovery utility, not a workflow stage or proof of broad HDL migration.',
  },
};

export function getProductSpineDefinition(page: ProductSpinePageKey): ProductSpinePageDefinition {
  return PRODUCT_SPINE_DEFINITIONS[page];
}

export function getProductSpineProgress(page: ProductSpinePageKey): string {
  const current = PRODUCT_SPINE_DEFINITIONS[page];
  return current.kind === 'utility' ? 'Utility' : `${current.order}/${PRODUCT_WORKFLOW_ORDER.length}`;
}
