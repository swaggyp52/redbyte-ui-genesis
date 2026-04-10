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

export const DEFAULT_DESIGN_SPLIT_RATIO = 0.44;

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
    leftDockMode: 'collapsed',
    rightDockMode: 'collapsed',
    consoleMode: 'collapsed',
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
