// Copyright (c) 2025 Connor Angiel — RedByte OS Genesis
// Tests: exportValidation for Basys3 VHDL/XDC export

import { describe, it, expect } from 'vitest';
import type { RBProject } from '@redbyte/rb-circuit';
import { validateExportForBasys3 } from '../exportValidation';

describe('exportValidation', () => {
  it('accepts project with valid ports and complete IO mapping', () => {
    const project: RBProject = {
      circuit: {
        nodes: [
          { id: 'p1', type: 'INPUT', label: 'SW0', x: 0, y: 0 },
          { id: 'p2', type: 'OUTPUT', label: 'LD0', x: 100, y: 0 },
        ],
        connections: [],
      },
      ioMapping: {
        SW0: 'V17',
        LD0: 'U16',
      },
    };

    const result = validateExportForBasys3(project);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects port with illegal characters', () => {
    const project: RBProject = {
      circuit: {
        nodes: [
          { id: 'p1', type: 'INPUT', label: 'SW-0', x: 0, y: 0 },
        ],
        connections: [],
      },
      ioMapping: { 'SW-0': 'V17' },
    };

    const result = validateExportForBasys3(project);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('illegal characters'))).toBe(true);
  });

  it('rejects reserved VHDL keywords as port names', () => {
    const project: RBProject = {
      circuit: {
        nodes: [{ id: 'p1', type: 'INPUT', label: 'if', x: 0, y: 0 }],
        connections: [],
      },
      ioMapping: { if: 'V17' },
    };

    const result = validateExportForBasys3(project);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('reserved'))).toBe(true);
  });

  it('rejects port starting with digit', () => {
    const project: RBProject = {
      circuit: {
        nodes: [{ id: 'p1', type: 'INPUT', label: '0_input', x: 0, y: 0 }],
        connections: [],
      },
      ioMapping: { '0_input': 'V17' },
    };

    const result = validateExportForBasys3(project);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('cannot start with a digit'))).toBe(true);
  });

  it('warns on duplicate port names', () => {
    const project: RBProject = {
      circuit: {
        nodes: [
          { id: 'p1', type: 'INPUT', label: 'SW0', x: 0, y: 0 },
          { id: 'p2', type: 'INPUT', label: 'SW0', x: 50, y: 0 }, // duplicate
        ],
        connections: [],
      },
      ioMapping: { SW0: 'V17' },
    };

    const result = validateExportForBasys3(project);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('Duplicate'))).toBe(true);
  });

  it('warns on unmapped ports', () => {
    const project: RBProject = {
      circuit: {
        nodes: [
          { id: 'p1', type: 'INPUT', label: 'SW0', x: 0, y: 0 },
          { id: 'p2', type: 'INPUT', label: 'SW1', x: 50, y: 0 },
        ],
        connections: [],
      },
      ioMapping: { SW0: 'V17' }, // SW1 not mapped
    };

    const result = validateExportForBasys3(project);
    expect(result.ok).toBe(true); // Not a hard error
    expect(result.warnings.some(w => w.includes('not in IO mapping'))).toBe(true);
  });

  it('rejects IO mapping for non-existent ports', () => {
    const project: RBProject = {
      circuit: {
        nodes: [{ id: 'p1', type: 'INPUT', label: 'SW0', x: 0, y: 0 }],
        connections: [],
      },
      ioMapping: { SW0: 'V17', PHANTOM: 'U16' }, // PHANTOM doesn't exist
    };

    const result = validateExportForBasys3(project);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.includes('unknown port'))).toBe(true);
  });

  it('warns on no IO mapping provided', () => {
    const project: RBProject = {
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
