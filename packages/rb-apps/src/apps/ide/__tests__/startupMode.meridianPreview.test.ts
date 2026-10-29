import { describe, expect, it } from 'vitest';
import { ideModeForMeridianStage, meridianPreviewSearch, meridianStageForIdeMode } from '../startupMode';

/** Meridian Preview opens the open project at the matching stage and returns to the matching mode. */
describe('workbench mode and Meridian stage', () => {
  it('maps each stage both ways', () => {
    expect(meridianStageForIdeMode('design')).toBe('design');
    expect(meridianStageForIdeMode('verify')).toBe('simulate');
    expect(meridianStageForIdeMode('hardware')).toBe('board');
    expect(ideModeForMeridianStage('design')).toBe('design');
    expect(ideModeForMeridianStage('simulate')).toBe('verify');
    expect(ideModeForMeridianStage('board')).toBe('hardware');
  });

  it('sends modes Meridian has no stage for to Design, and back again to Design', () => {
    for (const mode of ['project', 'export', 'import'] as const) expect(meridianStageForIdeMode(mode)).toBe('design');
    expect(ideModeForMeridianStage(null)).toBe('design');
    expect(ideModeForMeridianStage('somewhere')).toBe('design');
  });

  it('opens the open project, never an example that would replace it', () => {
    expect(meridianPreviewSearch('verify')).toBe('?studio=meridian&stage=simulate');
    expect(meridianPreviewSearch('design')).not.toMatch(/example|mode=/);
  });
});
