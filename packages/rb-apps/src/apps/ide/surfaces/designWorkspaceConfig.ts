import type {
  ConsoleMode,
  LeftDockMode,
  RightDockMode,
  WorkbenchShellDensity,
  WorkbenchSurfaceFrame,
} from '../components/IdeWorkbenchShell';

export type DesignWorkspaceMode = 'canvas' | 'hdl' | 'split';
export type DesignWorkspaceBodyMode = DesignWorkspaceMode | 'stacked';
export type DesignArtifact = 'vhdl' | 'verilog';

export interface DesignArtifactDescriptor {
  id: DesignArtifact;
  label: string;
  fileName: string;
  editable: boolean;
}

export interface DesignWorkspacePreset {
  mode: DesignWorkspaceMode;
  effectiveMode: DesignWorkspaceBodyMode;
  leftDockMode: LeftDockMode;
  rightDockMode: RightDockMode;
  consoleMode: ConsoleMode;
  shellDensity: WorkbenchShellDensity;
  surfaceFrame: WorkbenchSurfaceFrame;
  showCanvasPane: boolean;
  showCodePane: boolean;
  showCanvasTools: boolean;
  showCodeContext: boolean;
  showFullAuthoringStatus: boolean;
  showCompactAuthoringStatus: boolean;
  showSimulationStrip: boolean;
}

// Keep code slightly favored while giving the circuit enough useful area at
// the 1366px classroom baseline. This also leaves both panes above their
// minimum interaction widths before the layout intentionally stacks.
export const DEFAULT_DESIGN_SPLIT_RATIO = 0.45;

export const DESIGN_ARTIFACT_DESCRIPTORS: Record<DesignArtifact, DesignArtifactDescriptor> = {
  vhdl: {
    id: 'vhdl',
    label: 'VHDL',
    fileName: 'top.vhd',
    editable: false,
  },
  verilog: {
    id: 'verilog',
    label: 'Verilog',
    fileName: 'top.v',
    editable: false,
  },
};

export function resolveDesignWorkspacePreset(input: {
  mode: DesignWorkspaceMode;
  effectiveMode: DesignWorkspaceBodyMode;
}): DesignWorkspacePreset {
  const isCanvas = input.mode === 'canvas';
  const isCode = input.mode === 'hdl';
  const isSplit = input.mode === 'split';

  return {
    mode: input.mode,
    effectiveMode: input.effectiveMode,
    // Unified Workbench v3 keeps the component library and inspector stable.
    // Changing the center artifact must never make students manage page geometry.
    leftDockMode: 'visible',
    rightDockMode: 'visible',
    consoleMode: 'hidden',
    shellDensity: 'immersive',
    surfaceFrame: 'edge-to-edge',
    showCanvasPane: !isCode,
    showCodePane: !isCanvas,
    showCanvasTools: !isCode,
    showCodeContext: isCode,
    showFullAuthoringStatus: isCanvas,
    showCompactAuthoringStatus: isSplit,
    showSimulationStrip: isCanvas,
  };
}
