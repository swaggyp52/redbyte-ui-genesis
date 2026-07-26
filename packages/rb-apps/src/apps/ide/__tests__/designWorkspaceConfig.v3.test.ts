import { describe, expect, it } from 'vitest';
import {
  resolveDesignWorkspacePreset,
  type DesignWorkspaceBodyMode,
  type DesignWorkspaceMode,
} from '../surfaces/designWorkspaceConfig';

describe('Design workspace v3 geometry', () => {
  it.each<[DesignWorkspaceMode, DesignWorkspaceBodyMode]>([
    ['canvas', 'canvas'],
    ['hdl', 'hdl'],
    ['split', 'split'],
    ['split', 'stacked'],
  ])('keeps support regions stable in %s / %s', (mode, effectiveMode) => {
    const preset = resolveDesignWorkspacePreset({ mode, effectiveMode });

    expect(preset.leftDockMode).toBe('visible');
    expect(preset.rightDockMode).toBe('visible');
    expect(preset.consoleMode).toBe('hidden');
    expect(preset.shellDensity).toBe('immersive');
    expect(preset.surfaceFrame).toBe('edge-to-edge');
  });
});
