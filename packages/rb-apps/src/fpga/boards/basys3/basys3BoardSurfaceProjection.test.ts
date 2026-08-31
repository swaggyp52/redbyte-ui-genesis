import { describe, expect, it } from 'vitest';
import { BASYS3_BOARD_PROFILE } from './basys3Pins';
import {
  listBasys3CompatibleBoardAliases,
  listBasys3DesignBoardResourceInventory,
} from './basys3BoardSurfaceProjection';

describe('Basys3 board surface projection', () => {
  it('preserves the Design inventory order while deriving physical entries from the versioned profile', () => {
    const inventory = listBasys3DesignBoardResourceInventory({
      includeSyntheticReset: true,
    });

    expect(inventory.filter((item) => item.direction === 'in').map((item) => item.alias)).toEqual([
      ...Array.from({ length: 16 }, (_, index) => `SW${index}`),
      'BTNC',
      'BTNU',
      'BTNL',
      'BTNR',
      'BTND',
      'CLK100MHZ',
      'RST',
    ]);
    expect(inventory.filter((item) => item.direction === 'out').map((item) => item.alias)).toEqual([
      ...Array.from({ length: 16 }, (_, index) => `LD${index}`),
      ...Array.from({ length: 7 }, (_, index) => `SEG${index}`),
      ...Array.from({ length: 4 }, (_, index) => `AN${index}`),
      'DP',
    ]);

    for (const item of inventory.filter((candidate) => candidate.source.kind === 'board-profile')) {
      expect(item.source).toMatchObject({
        profileId: BASYS3_BOARD_PROFILE.id,
        profileVersion: BASYS3_BOARD_PROFILE.version,
      });
      expect(
        BASYS3_BOARD_PROFILE.resources.some(
          (resource) => resource.id === item.source.resourceId && resource.alias === item.boardAlias
        )
      ).toBe(true);
    }

    expect(inventory.find((item) => item.alias === 'SEG0')).toMatchObject({
      boardAlias: 'CA',
      source: { kind: 'board-profile', resourceId: 'seven-seg-ca' },
    });
  });

  it('keeps reset explicitly synthetic and out of physical Hardware compatibility groups', () => {
    const withReset = listBasys3DesignBoardResourceInventory({
      includeSyntheticReset: true,
    });
    const profileOnly = listBasys3DesignBoardResourceInventory({
      includeSyntheticReset: false,
    });
    const reset = withReset.find((item) => item.alias === 'RST');

    expect(reset).toMatchObject({
      boardAlias: null,
      direction: 'in',
      kind: 'reset',
      source: { kind: 'synthetic-non-board' },
    });
    expect(profileOnly.some((item) => item.alias === 'RST')).toBe(false);
    expect(BASYS3_BOARD_PROFILE.resources.some((resource) => resource.alias === 'RST')).toBe(false);
    expect(listBasys3CompatibleBoardAliases({ direction: 'in' })).not.toContain('RST');
  });

  it('derives semantic Hardware compatibility groups from the versioned profile', () => {
    expect(new Set(listBasys3CompatibleBoardAliases({ direction: 'in' }))).toEqual(
      new Set([
        ...Array.from({ length: 16 }, (_, index) => `SW${index}`),
        'BTNC',
        'BTNU',
        'BTNL',
        'BTNR',
        'BTND',
      ])
    );
    expect(new Set(listBasys3CompatibleBoardAliases({ direction: 'out' }))).toEqual(
      new Set([
        ...Array.from({ length: 16 }, (_, index) => `LD${index}`),
        'CA',
        'CB',
        'CC',
        'CD',
        'CE',
        'CF',
        'CG',
        'DP',
        'AN0',
        'AN1',
        'AN2',
        'AN3',
      ])
    );
    expect(listBasys3CompatibleBoardAliases({
      direction: 'in',
      timingRole: 'clock',
      boardResourceType: 'clock_pin',
    })).toEqual(['CLK100MHZ']);
    expect(new Set(listBasys3CompatibleBoardAliases({
      direction: 'in',
      timingRole: 'reset',
    }))).toEqual(new Set([
      ...Array.from({ length: 16 }, (_, index) => `SW${index}`),
      'BTNC',
      'BTNU',
      'BTNL',
      'BTNR',
      'BTND',
    ]));
    expect(new Set(listBasys3CompatibleBoardAliases({
      direction: 'out',
      boardResourceType: 'led',
    }))).toEqual(new Set(Array.from({ length: 16 }, (_, index) => `LD${index}`)));
  });
});
