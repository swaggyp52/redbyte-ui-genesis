import { describe, expect, it } from 'vitest';
import { buildPinPlannerRows } from '../pinPlannerProjection';
import type { HardwareMappingRow } from '../../HardwareSurface';
import {
  BASYS3_BOARD_PROFILE,
  resolveBasys3PackagePin,
} from '../../../../../fpga/boards/basys3/basys3Pins';
import type { Basys3SemanticMappingProjection } from '../../../../../fpga/boards/basys3/basys3ExportContract';

function row(overrides: Partial<HardwareMappingRow> & { id: string }): HardwareMappingRow {
  return {
    label: overrides.id.toUpperCase(),
    direction: 'in',
    pin: '',
    required: true,
    ...overrides,
  };
}

function projection(
  overrides: Partial<Basys3SemanticMappingProjection> & { logicalSignalId: string }
): Basys3SemanticMappingProjection {
  return {
    logicalLabel: overrides.logicalSignalId.toUpperCase(),
    direction: 'in',
    artifactPortName: overrides.logicalSignalId,
    boardResourceId: null,
    boardResourceLabel: null,
    packagePin: null,
    ioStandard: 'LVCMOS33',
    exactXdcLine: '',
    required: true,
    conflictState: 'none',
    ...overrides,
  };
}

describe('buildPinPlannerRows', () => {
  it('projects four-bit-adder style rows with board profile metadata', () => {
    const rows = buildPinPlannerRows(
      [
        row({ id: 'a0', nodeId: 'a0', port: 'out', label: 'A0 (SW0)', pin: 'V17' }),
        row({ id: 'sum0', nodeId: 'sum0', port: 'in', label: 'LD0 (SUM0)', direction: 'out', pin: 'U16' }),
      ],
      BASYS3_BOARD_PROFILE
    );

    expect(rows).toHaveLength(2);
    const [a0, sum0] = rows;
    // Mirrors HardwareSurface's label rule: parenthetical wins as logical.
    expect(a0.logical).toBe('SW0');
    expect(a0.resource).toBe('SW0');
    expect(a0.packagePin).toBe('V17');
    expect(a0.ioStandard).toBe('LVCMOS33');
    expect(a0.clockCapable).toBe(false);
    expect(a0.status).toBe('assigned');
    // No export contract projection supplied -> artifact port is unknown.
    expect(a0.port).toBeNull();

    expect(sum0.logical).toBe('SUM0');
    expect(sum0.direction).toBe('out');
    expect(sum0.resource).toBe('LD0');
    expect(sum0.status).toBe('assigned');
  });

  it('resolves board aliases and marks the oscillator clock-capable', () => {
    const rows = buildPinPlannerRows(
      [row({ id: 'clk', label: 'CLK', pin: 'CLK100MHZ' })],
      BASYS3_BOARD_PROFILE
    );
    expect(rows[0].resource).toBe('CLK100MHZ');
    expect(rows[0].packagePin).toBe('W5');
    expect(rows[0].clockCapable).toBe(true);
  });

  it('renders unassigned required rows with null metadata, never fabricated', () => {
    const rows = buildPinPlannerRows(
      [row({ id: 'en', label: 'EN', pin: '' })],
      BASYS3_BOARD_PROFILE
    );
    expect(rows[0].status).toBe('unassigned');
    expect(rows[0].resource).toBeNull();
    expect(rows[0].resourceLabel).toBeNull();
    expect(rows[0].packagePin).toBeNull();
    expect(rows[0].ioStandard).toBeNull();
    expect(rows[0].clockCapable).toBeNull();
    expect(rows[0].port).toBeNull();
  });

  it('flags an unknown pin token as needs-review with null metadata', () => {
    const rows = buildPinPlannerRows(
      [row({ id: 'x', label: 'X', pin: 'BOGUS9' })],
      BASYS3_BOARD_PROFILE
    );
    expect(rows[0].status).toBe('needs-review');
    expect(rows[0].resource).toBeNull();
    expect(rows[0].packagePin).toBeNull();
    expect(rows[0].ioStandard).toBeNull();
    expect(rows[0].clockCapable).toBeNull();
  });

  it('detects duplicate package pins across alias and raw-pin spellings', () => {
    const rows = buildPinPlannerRows(
      [
        row({ id: 'a', label: 'A', pin: 'SW0' }),
        row({ id: 'b', label: 'B', pin: 'V17' }),
        row({ id: 'c', label: 'C', pin: 'V16' }),
      ],
      BASYS3_BOARD_PROFILE,
      { resolvePackagePin: resolveBasys3PackagePin }
    );
    expect(rows[0].status).toBe('conflict');
    expect(rows[1].status).toBe('conflict');
    expect(rows[2].status).toBe('assigned');
  });

  it('mirrors the surface status ladder for optional rows', () => {
    const rows = buildPinPlannerRows(
      [
        row({ id: 'opt-assigned', label: 'OPT A', pin: 'SW5', required: false }),
        row({ id: 'opt-empty', label: 'OPT B', pin: '', required: false }),
      ],
      BASYS3_BOARD_PROFILE
    );
    expect(rows[0].status).toBe('optional');
    // deriveMappingCompleteness: optional without pin is 'partial' -> needs review.
    expect(rows[1].status).toBe('needs-review');
  });

  it('prefers export-contract projection facts when provided', () => {
    const rows = buildPinPlannerRows(
      [row({ id: 'a0', label: 'A0 (SW0)', pin: 'V17' })],
      BASYS3_BOARD_PROFILE,
      {
        mappingProjection: [
          projection({
            logicalSignalId: 'a0',
            logicalLabel: 'A0 (SW0)',
            artifactPortName: 'sw0',
            boardResourceLabel: 'Slide switch SW0',
            packagePin: 'V17',
            conflictState: 'duplicate-package-pin',
          }),
        ],
      }
    );
    expect(rows[0].port).toBe('sw0');
    expect(rows[0].packagePin).toBe('V17');
    expect(rows[0].resourceLabel).toBe('Slide switch SW0');
    expect(rows[0].status).toBe('conflict');
  });

  it('treats projection missing-pin as unassigned for required rows', () => {
    const rows = buildPinPlannerRows(
      [row({ id: 'a0', label: 'A0', pin: '' })],
      BASYS3_BOARD_PROFILE,
      {
        mappingProjection: [
          projection({
            logicalSignalId: 'a0',
            artifactPortName: 'a0',
            conflictState: 'missing-pin',
          }),
        ],
      }
    );
    expect(rows[0].status).toBe('unassigned');
    expect(rows[0].packagePin).toBeNull();
    expect(rows[0].ioStandard).toBeNull();
  });

  it('preserves input row order deterministically', () => {
    const rows = buildPinPlannerRows(
      [
        row({ id: 'z', label: 'Z', pin: 'SW9' }),
        row({ id: 'a', label: 'A', pin: 'SW1' }),
      ],
      BASYS3_BOARD_PROFILE
    );
    expect(rows.map((entry) => entry.rowId)).toEqual(['z', 'a']);
  });
});
