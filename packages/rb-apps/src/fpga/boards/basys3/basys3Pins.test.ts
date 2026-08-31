import { describe, expect, it } from 'vitest';

import {
  BASYS3_BOARD_PROFILE,
  BASYS3_BOARD_PROFILE_PROVENANCE,
  BASYS3_BOARD_RESOURCES,
  BASYS3_DEFAULT_IO_STANDARD,
  formatBasys3XdcBinding,
  getBasys3BoardResource,
  listBasys3AssignableResources,
  listBasys3BoardResources,
  listBasys3CompatibleResources,
  resolveBasys3PackagePin,
} from './basys3Pins';

describe('basys3Pins board planner truth', () => {
  it('models the official 100 MHz board clock on W5', () => {
    const clock = getBasys3BoardResource('CLK100MHZ');
    expect(clock?.packagePin).toBe('W5');
    expect(clock?.frequencyMHz).toBe(100);
    expect(clock?.group).toBe('System clock');
    expect(resolveBasys3PackagePin('CLK100MHZ')).toBe('W5');
  });

  it('publishes one versioned Basys3 profile with dated official provenance', () => {
    expect(BASYS3_BOARD_PROFILE).toMatchObject({
      schemaVersion: 1,
      id: 'digilent.basys3',
      version: '1.0.0',
      boardId: 'basys3',
      boardName: 'Digilent Basys 3',
      fpgaPart: 'xc7a35tcpg236-1',
      defaultIoStandard: 'LVCMOS33',
    });
    expect(BASYS3_BOARD_PROFILE.resources).toBe(BASYS3_BOARD_RESOURCES);
    expect(BASYS3_BOARD_PROFILE.provenance).toBe(BASYS3_BOARD_PROFILE_PROVENANCE);
    expect(BASYS3_BOARD_PROFILE.proofBoundary).toContain('no Vivado execution');

    expect(BASYS3_BOARD_PROFILE_PROVENANCE).toEqual([
      expect.objectContaining({
        title: 'Digilent Basys 3 Resource Center',
        revision: 'Living product resource center',
        retrievedOn: '2026-08-01',
      }),
      expect.objectContaining({
        title: 'Digilent Basys 3 FPGA Board Reference Manual',
        documentId: 'DOC#502-183',
        revision: 'Rev C',
        publishedOn: '2019-07-10',
        retrievedOn: '2026-08-01',
      }),
      expect.objectContaining({
        title: 'Digilent Basys-3-Master.xdc',
        revision: 'Rev B',
        retrievedOn: '2026-08-01',
      }),
      expect.objectContaining({
        title: 'Digilent Basys 3 Public Schematic',
        documentId: 'DOC#500-183',
        revision: 'Rev D.1',
        publishedOn: '2021-02-05',
        retrievedOn: '2026-08-01',
      }),
    ]);
  });

  it('gives every profile resource compatibility, visual, differential, and documentation fields', () => {
    const provenanceIds = new Set(BASYS3_BOARD_PROFILE_PROVENANCE.map((source) => source.id));
    const groupedResourceIds = BASYS3_BOARD_PROFILE.resourceGroups.flatMap(
      (group) => group.resourceIds
    );

    expect(groupedResourceIds).toHaveLength(BASYS3_BOARD_RESOURCES.length);
    expect(new Set(groupedResourceIds).size).toBe(BASYS3_BOARD_RESOURCES.length);

    for (const resource of BASYS3_BOARD_RESOURCES) {
      expect(resource.ioStandard).toBe('LVCMOS33');
      expect(resource.compatibleSignalCategories.length).toBeGreaterThan(0);
      expect(resource.documentationReferences.length).toBeGreaterThan(0);
      expect(
        resource.documentationReferences.every((reference) => provenanceIds.has(reference))
      ).toBe(true);
      expect(Object.hasOwn(resource, 'differentialRelationship')).toBe(true);
      expect(resource.differentialRelationship).toBeNull();

      if (resource.direction === 'in') {
        expect(resource.compatibleSignalCategories).toContain('top-level-input');
      } else if (resource.direction === 'out') {
        expect(resource.compatibleSignalCategories).toContain('top-level-output');
      } else if (resource.direction === 'inout') {
        expect(resource.compatibleSignalCategories).toEqual(
          expect.arrayContaining(['top-level-input', 'top-level-output'])
        );
      }

      if (resource.visualCoordinate) {
        expect(resource.visualCoordinate.coordinateSpace).toBe('basys3-board-620x260-v1');
        expect(resource.visualCoordinate.x).toBeGreaterThanOrEqual(0);
        expect(resource.visualCoordinate.x).toBeLessThanOrEqual(620);
        expect(resource.visualCoordinate.y).toBeGreaterThanOrEqual(0);
        expect(resource.visualCoordinate.y).toBeLessThanOrEqual(260);
      }
    }

    expect(getBasys3BoardResource('CLK100MHZ')).toMatchObject({
      compatibleSignalCategories: ['clock', 'control', 'top-level-input'],
      differentialRelationship: null,
      visualCoordinate: null,
      documentationReferences: [
        'digilent-basys3-resource-center',
        'digilent-basys3-reference-manual',
        'digilent-basys3-master-xdc',
        'digilent-basys3-schematic',
      ],
    });
    expect(getBasys3BoardResource('SW0')).toMatchObject({
      compatibleSignalCategories: ['control', 'reset', 'data', 'top-level-input'],
      visualCoordinate: {
        coordinateSpace: 'basys3-board-620x260-v1',
        x: 588,
        y: 199,
      },
    });
    expect(getBasys3BoardResource('LD0')).toMatchObject({
      compatibleSignalCategories: ['data', 'top-level-output'],
      visualCoordinate: {
        coordinateSpace: 'basys3-board-620x260-v1',
        x: 588,
        y: 40,
      },
    });
    expect(getBasys3BoardResource('BTNC')?.visualCoordinate).toMatchObject({
      x: 155,
      y: 135,
    });
  });

  it('includes planner-visible switches, buttons, leds, and seven-segment resources', () => {
    const plannerResources = listBasys3BoardResources({ plannerOnly: true });
    expect(plannerResources.filter((resource) => resource.category === 'switch')).toHaveLength(16);
    expect(plannerResources.filter((resource) => resource.category === 'led')).toHaveLength(16);
    expect(plannerResources.filter((resource) => resource.category === 'button')).toHaveLength(5);
    expect(plannerResources.filter((resource) => resource.category === 'seven_seg')).toHaveLength(12);
  });

  it('keeps the first Basys3 switch aliases aligned with their official package pins', () => {
    expect(resolveBasys3PackagePin('SW0')).toBe('V17');
    expect(resolveBasys3PackagePin('SW1')).toBe('V16');
    expect(getBasys3BoardResource('V17')).toMatchObject({ alias: 'SW0', packagePin: 'V17' });
    expect(getBasys3BoardResource('V16')).toMatchObject({ alias: 'SW1', packagePin: 'V16' });
    expect(getBasys3BoardResource('SW0')).toMatchObject({
      id: 'switch-0',
      ioStandard: BASYS3_DEFAULT_IO_STANDARD,
    });
  });

  it.each([
    ['clock-clk100mhz', 'CLK100MHZ', 'W5'],
    ['switch-0', 'SW0', 'V17'],
    ['switch-15', 'SW15', 'R2'],
    ['led-0', 'LD0', 'U16'],
    ['led-15', 'LD15', 'L1'],
    ['button-btnc', 'BTNC', 'U18'],
    ['seven-seg-ca', 'CA', 'W7'],
    ['seven-seg-dp', 'DP', 'V7'],
    ['seven-seg-an0', 'AN0', 'U2'],
  ])('preserves stable resource %s at %s / %s', (resourceId, alias, packagePin) => {
    expect(getBasys3BoardResource(alias)).toMatchObject({
      id: resourceId,
      alias,
      packagePin,
    });
    expect(resolveBasys3PackagePin(alias)).toBe(packagePin);
  });

  it('provides direction-filtered current assignment choices without changing resource IDs', () => {
    const inputChoices = listBasys3AssignableResources('in');
    const outputChoices = listBasys3AssignableResources('out');

    expect(inputChoices).toHaveLength(22);
    expect(inputChoices.map((resource) => resource.alias)).toContain('CLK100MHZ');
    expect(inputChoices.map((resource) => resource.alias)).toContain('SW0');
    expect(inputChoices.map((resource) => resource.alias)).not.toContain('LD0');

    expect(outputChoices).toHaveLength(28);
    expect(outputChoices.map((resource) => resource.alias)).toContain('LD0');
    expect(outputChoices.map((resource) => resource.alias)).not.toContain('SW0');

    const catalogInputChoices = listBasys3AssignableResources('in', { plannerOnly: false });
    expect(catalogInputChoices.map((resource) => resource.alias)).toContain('JA0');
    expect(listBasys3AssignableResources('out', { category: 'switch' })).toEqual([]);
    expect(getBasys3BoardResource('SW0')?.id).toBe('switch-0');
    expect(getBasys3BoardResource('LD0')?.id).toBe('led-0');
  });

  it('keeps explicit switch-driven clock and reset lab controls compatible', () => {
    const manualClock = listBasys3CompatibleResources({
      direction: 'in',
      timingRole: 'clock',
      boardResourceType: 'switch',
    });
    const switchReset = listBasys3CompatibleResources({
      direction: 'in',
      timingRole: 'reset',
      boardResourceType: 'switch',
    });

    expect(manualClock.map((resource) => resource.alias)).toContain('SW5');
    expect(manualClock.every((resource) => resource.category === 'switch')).toBe(true);
    expect(manualClock.map((resource) => resource.alias)).not.toContain('CLK100MHZ');
    expect(manualClock.map((resource) => resource.alias)).not.toContain('BTNC');

    expect(switchReset.map((resource) => resource.alias)).toContain('SW4');
    expect(switchReset.every((resource) => resource.category === 'switch')).toBe(true);
    expect(switchReset.map((resource) => resource.alias)).not.toContain('BTNC');
    expect(switchReset.map((resource) => resource.alias)).not.toContain('CLK100MHZ');
  });

  it('keeps dedicated clocks and unconstrained resets semantically narrow', () => {
    const dedicatedClock = listBasys3CompatibleResources({
      direction: 'in',
      timingRole: 'clock',
    });
    const resetControls = listBasys3CompatibleResources({
      direction: 'in',
      timingRole: 'reset',
    });
    const conflictingResetClock = listBasys3CompatibleResources({
      direction: 'in',
      timingRole: 'reset',
      boardResourceType: 'clock_pin',
    });

    expect(dedicatedClock.map((resource) => resource.alias)).toEqual(['CLK100MHZ']);
    expect(resetControls.some((resource) => resource.category === 'switch')).toBe(true);
    expect(resetControls.some((resource) => resource.category === 'button')).toBe(true);
    expect(resetControls.map((resource) => resource.alias)).not.toContain('CLK100MHZ');
    expect(conflictingResetClock).toEqual([]);
  });

  it('keeps official catalog-only resources available for board reference', () => {
    const ja0 = getBasys3BoardResource('JA0');
    const vgaSync = getBasys3BoardResource('HSYNC');
    expect(ja0?.packagePin).toBe('J1');
    expect(ja0?.supportedInPlanner).toBe(false);
    expect(vgaSync?.packagePin).toBe('P19');
    expect(vgaSync?.category).toBe('vga');
  });

  it('formats a clock xdc preview with create_clock truth', () => {
    const clock = getBasys3BoardResource('CLK100MHZ');
    expect(clock).toBeTruthy();
    const xdc = formatBasys3XdcBinding(clock!, 'clk');
    expect(xdc).toContain('PACKAGE_PIN W5');
    expect(xdc).toContain('IOSTANDARD LVCMOS33');
    expect(xdc).toContain('create_clock -period 10.000');
  });
});
