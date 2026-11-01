// Copyright (c) 2025 Connor Angiel — RedByte OS Genesis
// Tests: exportValidation for Basys3 VHDL/XDC export

import { describe, it, expect } from 'vitest';
import type { RBProject } from '../projectFormat';
import { validateExportForBasys3 } from '../exportValidation';

const projectMetadata = {
  kind: 'rb-project' as const,
  version: 1 as const,
  name: 'Export validation fixture',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('exportValidation', () => {
  it('accepts project with valid ports and complete IO mapping', () => {
    const project: RBProject = {
      ...projectMetadata,
      circuit: {
        nodes: [
          { id: 'p1', type: 'INPUT', label: 'SW0', x: 0, y: 0 },
          { id: 'p2', type: 'OUTPUT', label: 'LD0', x: 100, y: 0 },
        ],
        connections: [],
      },
      ioMapping: {
        inputs: [{ id: 'SW0', nodeId: 'p1', port: 'out', label: 'SW0', pin: 'V17' }],
        outputs: [{ id: 'LD0', nodeId: 'p2', port: 'in', label: 'LD0', pin: 'U16' }],
      },
    };

    const result = validateExportForBasys3(project);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects port with illegal characters', () => {
    const project: RBProject = {
      ...projectMetadata,
      circuit: {
        nodes: [
          { id: 'p1', type: 'INPUT', label: 'SW-0', x: 0, y: 0 },
        ],
        connections: [],
      },
      ioMapping: {
        inputs: [{ id: 'SW-0', nodeId: 'p1', port: 'out', label: 'SW-0', pin: 'V17' }],
        outputs: [],
      },
    };

    const result = validateExportForBasys3(project);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('illegal characters'))).toBe(true);
  });

  it('rejects reserved VHDL keywords as port names', () => {
    const project: RBProject = {
      ...projectMetadata,
      circuit: {
        nodes: [{ id: 'p1', type: 'INPUT', label: 'if', x: 0, y: 0 }],
        connections: [],
      },
      ioMapping: {
        inputs: [{ id: 'if', nodeId: 'p1', port: 'out', label: 'if', pin: 'V17' }],
        outputs: [],
      },
    };

    const result = validateExportForBasys3(project);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('reserved'))).toBe(true);
  });

  it('rejects port starting with digit', () => {
    const project: RBProject = {
      ...projectMetadata,
      circuit: {
        nodes: [{ id: 'p1', type: 'INPUT', label: '0_input', x: 0, y: 0 }],
        connections: [],
      },
      ioMapping: {
        inputs: [{ id: '0_input', nodeId: 'p1', port: 'out', label: '0_input', pin: 'V17' }],
        outputs: [],
      },
    };

    const result = validateExportForBasys3(project);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('cannot start with a digit'))).toBe(true);
  });

  it('warns on duplicate port names', () => {
    const project: RBProject = {
      ...projectMetadata,
      circuit: {
        nodes: [
          { id: 'p1', type: 'INPUT', label: 'SW0', x: 0, y: 0 },
          { id: 'p2', type: 'INPUT', label: 'SW0', x: 50, y: 0 }, // duplicate
        ],
        connections: [],
      },
      ioMapping: {
        inputs: [{ id: 'SW0', nodeId: 'p1', port: 'out', label: 'SW0', pin: 'V17' }],
        outputs: [],
      },
    };

    const result = validateExportForBasys3(project);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('Duplicate'))).toBe(true);
  });

  it('warns on unmapped ports', () => {
    const project: RBProject = {
      ...projectMetadata,
      circuit: {
        nodes: [
          { id: 'p1', type: 'INPUT', label: 'SW0', x: 0, y: 0 },
          { id: 'p2', type: 'INPUT', label: 'SW1', x: 50, y: 0 },
        ],
        connections: [],
      },
      ioMapping: {
        inputs: [{ id: 'SW0', nodeId: 'p1', port: 'out', label: 'SW0', pin: 'V17' }],
        outputs: [],
      }, // SW1 not mapped
    };

    const result = validateExportForBasys3(project);
    expect(result.ok).toBe(true); // Not a hard error
    expect(result.warnings.some(w => w.includes('not in IO mapping'))).toBe(true);
  });

  it('rejects IO mapping for non-existent ports', () => {
    const project: RBProject = {
      ...projectMetadata,
      circuit: {
        nodes: [{ id: 'p1', type: 'INPUT', label: 'SW0', x: 0, y: 0 }],
        connections: [],
      },
      ioMapping: {
        inputs: [{ id: 'SW0', nodeId: 'p1', port: 'out', label: 'SW0', pin: 'V17' }],
        outputs: [{ id: 'PHANTOM', nodeId: 'phantom', port: 'in', label: 'PHANTOM', pin: 'U16' }],
      }, // PHANTOM doesn't exist
    };

    const result = validateExportForBasys3(project);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('unknown port'))).toBe(true);
  });

  it('warns on no IO mapping provided', () => {
    const project: RBProject = {
      ...projectMetadata,
      circuit: {
        nodes: [{ id: 'p1', type: 'INPUT', label: 'SW0', x: 0, y: 0 }],
        connections: [],
      },
    };

    const result = validateExportForBasys3(project);
    expect(result.ok).toBe(true);
    expect(result.warnings.some(w => w.includes('No IO mapping'))).toBe(true);
  });

  it('allows empty circuit (no ports)', () => {
    const project: RBProject = {
      ...projectMetadata,
      circuit: {
        nodes: [{ id: 'g1', type: 'AND', label: 'and0', x: 50, y: 50 }],
        connections: [],
      },
    };

    const result = validateExportForBasys3(project);
    expect(result.ok).toBe(true);
    expect(result.warnings.some(w => w.includes('no I/O ports'))).toBe(true);
  });
});


it('checks each illegal identifier independently', () => {
  const project: RBProject = {
    ...projectMetadata,
    circuit: {
      nodes: [
        { id: 'p1', type: 'INPUT', label: 'SW-0' },
        { id: 'p2', type: 'OUTPUT', label: 'LD-0' },
      ],
      connections: [],
    },
  };
  const result = validateExportForBasys3(project);
  expect(result.errors.filter((error) => error.includes('illegal characters'))).toHaveLength(2);
});

it('accepts board aliases and reports structured rows with missing pin assignments', () => {
  const project: RBProject = {
    ...projectMetadata,
    circuit: {
      nodes: [
        { id: 'p1', type: 'INPUT', label: 'SW0' },
        { id: 'p2', type: 'OUTPUT', label: 'LD0' },
      ],
      connections: [],
    },
    ioMapping: {
      inputs: [{ id: 'sw0', nodeId: 'p1', port: 'out', label: 'SW0', pin: 'SW0' }],
      outputs: [{ id: 'ld0', nodeId: 'p2', port: 'in', label: 'LD0' }],
    },
  };
  const result = validateExportForBasys3(project);
  expect(result.ok).toBe(true);
  expect(result.warnings).toEqual([
    'Ports not in IO mapping: LD0 (will export with unassigned pins)',
  ]);
});
