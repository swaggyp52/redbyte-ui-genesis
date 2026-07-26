import { describe, expect, it } from 'vitest';
import type { IdeChromeContract } from '../chromeContract';
import { CHROME_CONTRACT as PROJECT_CHROME_CONTRACT } from '../surfaces/ProjectSurface';
import { CHROME_CONTRACT as DESIGN_CHROME_CONTRACT } from '../surfaces/DesignSurface';
import { CHROME_CONTRACT as VERIFY_CHROME_CONTRACT } from '../surfaces/VerifySurface';
import { CHROME_CONTRACT as HARDWARE_CHROME_CONTRACT } from '../surfaces/HardwareSurface';
import { CHROME_CONTRACT as EXPORT_CHROME_CONTRACT } from '../surfaces/ExportSurface';
import { CHROME_CONTRACT as IMPORT_CHROME_CONTRACT } from '../surfaces/ImportSurface';

const SURFACE_CONTRACTS: readonly IdeChromeContract[] = [
  PROJECT_CHROME_CONTRACT,
  DESIGN_CHROME_CONTRACT,
  VERIFY_CHROME_CONTRACT,
  HARDWARE_CHROME_CONTRACT,
  EXPORT_CHROME_CONTRACT,
  IMPORT_CHROME_CONTRACT,
];

describe('IDE chrome contracts', () => {
  it('exports one typed CHROME_CONTRACT for every IDE surface', () => {
    expect(SURFACE_CONTRACTS.map((contract) => contract.surfaceId).sort()).toEqual([
      'design',
      'export',
      'hardware',
      'import',
      'project',
      'verify',
    ]);

    for (const contract of SURFACE_CONTRACTS) {
      expect(contract.topStripSlots.length).toBeGreaterThan(0);
      expect(contract.leftDockPolicy).toMatch(/^(always|collapsed-default|hidden)$/);
      expect(contract.rightDockPolicy).toMatch(/^(always|collapsed-default|contextual|hidden)$/);
    }
  });

  it('keeps the top-strip contract within the single-row discipline', () => {
    for (const contract of SURFACE_CONTRACTS) {
      expect(contract.topStripSlots.length).toBeLessThanOrEqual(3);
    }
  });

  it('declares the Hardware sub-mode exit paths covered by the N4 Back affordance', () => {
    expect(HARDWARE_CHROME_CONTRACT.exitPaths).toHaveLength(3);
    expect(HARDWARE_CHROME_CONTRACT.exitPaths.map((path) => path.fromMode).sort()).toEqual([
      'bringup',
      'live',
      'proof',
    ]);

    for (const path of HARDWARE_CHROME_CONTRACT.exitPaths) {
      expect(path.label.trim().length).toBeGreaterThan(0);
      expect(path.testId).toBe('ide-hw-mode-exit-back');
    }
  });

  it('keeps non-sub-mode surfaces exit-path free', () => {
    for (const contract of SURFACE_CONTRACTS) {
      if (contract.surfaceId === 'hardware') continue;
      expect(contract.exitPaths).toHaveLength(0);
    }
  });
});
