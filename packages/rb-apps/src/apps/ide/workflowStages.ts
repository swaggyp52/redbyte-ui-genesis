export type IdeMode =
  | 'project'
  | 'design'
  | 'verify'
  | 'hardware'
  | 'export'
  | 'import';

export type IdeWorkflowRouteMode = 'design' | 'verify' | 'hardware' | 'export';

export interface IdeModeDefinition {
  id: IdeMode;
  label: string;
  shortLabel: string;
}

export interface IdeWorkflowRouteStep {
  id: IdeWorkflowRouteMode;
  label: string;
  step: number;
}

export const DESIGN_STAGE_LABEL = 'Design';
export const VERIFY_STAGE_LABEL = 'Verify';
export const MAP_PINS_STAGE_LABEL = 'Map Pins';
export const EXPORT_STAGE_LABEL = 'Export';
export const PROGRAM_STAGE_LABEL = 'Program';

export const STUDENT_WORKFLOW_SPINE = [
  DESIGN_STAGE_LABEL,
  VERIFY_STAGE_LABEL,
  MAP_PINS_STAGE_LABEL,
  EXPORT_STAGE_LABEL,
  PROGRAM_STAGE_LABEL,
] as const;

export const STUDENT_WORKFLOW_SUMMARY = STUDENT_WORKFLOW_SPINE.join(' → ');

export const IDE_MODE_LABELS: Record<IdeMode, string> = {
  project: 'Project',
  design: DESIGN_STAGE_LABEL,
  verify: VERIFY_STAGE_LABEL,
  hardware: MAP_PINS_STAGE_LABEL,
  export: EXPORT_STAGE_LABEL,
  import: 'Import',
};

export const IDE_MODE_DEFINITIONS: IdeModeDefinition[] = [
  { id: 'project', label: IDE_MODE_LABELS.project, shortLabel: 'P' },
  { id: 'design', label: IDE_MODE_LABELS.design, shortLabel: 'D' },
  { id: 'verify', label: IDE_MODE_LABELS.verify, shortLabel: 'V' },
  { id: 'hardware', label: IDE_MODE_LABELS.hardware, shortLabel: 'M' },
  { id: 'export', label: IDE_MODE_LABELS.export, shortLabel: 'E' },
  { id: 'import', label: IDE_MODE_LABELS.import, shortLabel: 'I' },
];

export const IDE_WORKFLOW_ROUTE_STEPS: IdeWorkflowRouteStep[] = [
  { id: 'design', label: DESIGN_STAGE_LABEL, step: 1 },
  { id: 'verify', label: VERIFY_STAGE_LABEL, step: 2 },
  { id: 'hardware', label: MAP_PINS_STAGE_LABEL, step: 3 },
  { id: 'export', label: EXPORT_STAGE_LABEL, step: 4 },
];

export function getIdeModeLabel(mode: IdeMode): string {
  return IDE_MODE_LABELS[mode];
}

export function getWorkflowCtaLabel(mode: IdeMode, code?: string | null): string {
  if (mode === 'hardware') {
    return code === 'RBP4000' ? PROGRAM_STAGE_LABEL : MAP_PINS_STAGE_LABEL;
  }
  return getIdeModeLabel(mode);
}

export function getOpenStageActionLabel(mode: IdeMode): string {
  return `Open ${getIdeModeLabel(mode)}`;
}
