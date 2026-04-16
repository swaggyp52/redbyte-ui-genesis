// Copyright (c) 2025 Connor Angiel — RedByte OS Genesis
// Roundtrip test: import fixture → verify exports preserve structure

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { resolveIoMappingFromProjectFields } from '@redbyte/rb-utils';
import type { RBProject } from '../../export/projectFormat';
import { parseVhdl } from '../vhdlImport';
import { parseXdcPins } from '../xdcImport';
import { importToRbProject } from '../importToRbProject';

const FIXTURES_DIR = join(__dirname, '../../fixtures/import');

/** Flat port-label → pin for fixture assertions (matches legacy import test shape). */
function flatLabelPinMap(project: RBProject): Record<string, string> {
  const io = resolveIoMappingFromProjectFields(project) ?? project.ioMapping;
  const m: Record<string, string> = {};
  for (const row of [...(io?.inputs ?? []), ...(io?.outputs ?? [])]) {
    const label = (row.label ?? row.id).trim();
    if (label) m[label] = (row.pin ?? '').trim().toUpperCase();
  }
  return m;
}

/**
 * Load fixture files for a given fixture name.
 */
function loadFixture(name: string) {
  const vhdlPath = join(FIXTURES_DIR, name, 'top.vhd');
  const xdcPath = join(FIXTURES_DIR, name, 'basys3.xdc');
  
  const vhdl = readFileSync(vhdlPath, 'utf8');
  const xdc = readFileSync(xdcPath, 'utf8');
  
  return { vhdl, xdc };
}

describe('importExportRoundtrip', () => {
  it('01-and-gate: import preserves expected port count', () => {
    const { vhdl, xdc } = loadFixture('01-and-gate');
    
    // Parse HDL + XDC
    const parsed = parseVhdl(vhdl);
    const xdcResult = parseXdcPins(xdc);
    const project = importToRbProject(parsed, xdcResult);
    
    // Verify parsed HDL has correct structure
    expect(parsed.entityName).toBe('top');
    expect(parsed.ports).toHaveLength(3);
    
    // Verify circuit structure (nodes + connections)
    expect(project.circuit.nodes).toBeDefined();
    expect(project.circuit.connections).toBeDefined();
    expect(project.circuit.nodes.length).toBeGreaterThan(0);
    
    expect(project.hardwareMappingV2?.entries.length).toBeGreaterThan(0);
    expect(flatLabelPinMap(project)).toEqual({
      SW0: 'V17',
      SW1: 'V16',
      LD0: 'U16',
    });
  });
  
  it('02-full-adder: import preserves all ports', () => {
    const { vhdl, xdc } = loadFixture('02-full-adder');
    
    // Parse HDL + XDC
    const parsed = parseVhdl(vhdl);
    const xdcResult = parseXdcPins(xdc);
    const project = importToRbProject(parsed, xdcResult);
    
    // Verify parsed HDL has correct structure
    expect(parsed.entityName).toBe('top');
    expect(parsed.ports).toHaveLength(5);
    
    // Extract port names
    const portNames = parsed.ports.map(p => p.name).sort();
    expect(portNames).toContain('SW0');
    expect(portNames).toContain('SW1');
    expect(portNames).toContain('SW2');
    expect(portNames).toContain('LD0');
    expect(portNames).toContain('LD1');
    
    expect(flatLabelPinMap(project)).toEqual({
      SW0: 'V17',
      SW1: 'V16',
      SW2: 'W16',
      LD0: 'U16',
      LD1: 'E19',
    });
  });
  
  it('XDC parser handles fixture constraints correctly', () => {
    const { xdc } = loadFixture('01-and-gate');
    const result = parseXdcPins(xdc);
    
    // Verify all three pins were parsed
    expect(Object.keys(result.pinMap)).toHaveLength(3);
    expect(result.pinMap['SW0']).toBe('V17');
    expect(result.pinMap['SW1']).toBe('V16');
    expect(result.pinMap['LD0']).toBe('U16');
    
    // XDC should warn about IOSTANDARD directives (not yet supported in v1)
    expect(result.warnings.some(w => w.includes('IOSTANDARD'))).toBe(true);
  });
  
  it('Fixture VHDL files contain expected entity declarations', () => {
    // 01-and-gate
    const { vhdl: andVhdl } = loadFixture('01-and-gate');
    expect(andVhdl).toContain('entity top');
    expect(andVhdl).toContain('SW0');
    expect(andVhdl).toContain('SW1');
    expect(andVhdl).toContain('LD0');
    expect(andVhdl).toContain('AND2');
    
    // 02-full-adder
    const { vhdl: faVhdl } = loadFixture('02-full-adder');
    expect(faVhdl).toContain('entity top');
    expect(faVhdl).toContain('SW0');
    expect(faVhdl).toContain('SW1');
    expect(faVhdl).toContain('SW2');
    expect(faVhdl).toContain('LD0');
    expect(faVhdl).toContain('LD1');
    expect(faVhdl).toContain('FullAdder');
  });
  
  it('Fixture port names match XDC constraint names', () => {
    const fixtures = ['01-and-gate', '02-full-adder', '03-vivado-ish-clocked'];
    
    for (const fixture of fixtures) {
      const { vhdl, xdc } = loadFixture(fixture);
      
      // Parse both
      const parsed = parseVhdl(vhdl);
      const xdcResult = parseXdcPins(xdc);
      
      // Every port in VHDL should have a corresponding XDC constraint
      for (const port of parsed.ports) {
        expect(xdcResult.pinMap).toHaveProperty(port.name);
      }
    }
  });

  it('03-vivado-ish-clocked: handles varied XDC formatting without crashing', () => {
    const { vhdl, xdc } = loadFixture('03-vivado-ish-clocked');
    
    // Parse (must not throw despite create_clock, varied spacing, IOSTANDARD)
    expect(() => {
      const parsed = parseVhdl(vhdl);
      const xdcResult = parseXdcPins(xdc);
      const project = importToRbProject(parsed, xdcResult);
      expect(project.hardwareMappingV2?.entries).toHaveLength(7);
      expect(Object.keys(flatLabelPinMap(project))).toHaveLength(7);
    }).not.toThrow();
  });

  it('fixture XDC parsing warns on unsupported directives (not errors)', () => {
    const { xdc } = loadFixture('03-vivado-ish-clocked');
    const result = parseXdcPins(xdc);
    
    // Should warn about create_clock, IOSTANDARD, but NOT fail parsing
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.pinMap).toBeDefined();
    expect(Object.keys(result.pinMap).length).toBeGreaterThan(0);
  });
});
