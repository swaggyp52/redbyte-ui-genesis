export type IdeMode =
  | 'project'
  | 'design'
  | 'verify'
  | 'hardware'
  | 'export'
  | 'import';

export type IdeWorkflowStageMode = Exclude<IdeMode, 'import'>;
export type IdeWorkflowRouteMode = Exclude<IdeWorkflowStageMode, 'project'>;

export interface IdeModeDefinition {
  id: IdeMode;
  label: string;
  shortLabel: string;
}

export interface IdeWorkflowStage {
  id: IdeWorkflowStageMode;
  label: string;
  step: number;
  hint: string;
}

export interface IdeWorkflowRouteStep extends IdeWorkflowStage {
  id: IdeWorkflowRouteMode;
}

export const PROJECT_STAGE_LABEL = 'Project';
export const DESIGN_STAGE_LABEL = 'Design';
export const VERIFY_STAGE_LABEL = 'Simulate';
export const BOARD_CONSTRAINTS_STAGE_LABEL = 'Board & Constraints';
/** @deprecated Internal routes may still be named hardware; use the board workspace label in UI. */
export const MAP_PINS_STAGE_LABEL = BOARD_CONSTRAINTS_STAGE_LABEL;
export const EXPORT_STAGE_LABEL = 'Build & Export';
export const PROGRAM_STAGE_LABEL = 'Program';

export const STUDENT_WORKFLOW_STAGES: readonly IdeWorkflowStage[] = [
  { id: 'project', label: PROJECT_STAGE_LABEL, step: 1, hint: 'Understand your project' },
  { id: 'design', label: DESIGN_STAGE_LABEL, step: 2, hint: 'Build the circuit' },
  { id: 'verify', label: VERIFY_STAGE_LABEL, step: 3, hint: 'Develop and run scenarios' },
  { id: 'hardware', label: BOARD_CONSTRAINTS_STAGE_LABEL, step: 4, hint: 'Plan board I/O and constraints' },
  { id: 'export', label: EXPORT_STAGE_LABEL, step: 5, hint: 'Inspect the Vivado handoff' },
] as const;

export const STUDENT_WORKFLOW_SPINE = STUDENT_WORKFLOW_STAGES.map((stage) => stage.label);
export const STUDENT_WORKFLOW_SUMMARY = STUDENT_WORKFLOW_SPINE.join(' → ');

export const IDE_MODE_LABELS: Record<IdeMode, string> = {
  project: PROJECT_STAGE_LABEL,
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
];

export const IDE_WORKFLOW_ROUTE_STEPS: readonly IdeWorkflowRouteStep[] = STUDENT_WORKFLOW_STAGES
  .filter((stage): stage is IdeWorkflowRouteStep => stage.id !== 'project');

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
