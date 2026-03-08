// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, vi } from 'vitest';
import { listFiles, createFile, deleteFile } from '../stores/filesStore';

describe('FilesApp Store', () => {
  it('should create and list files', () => {
    // Clear localStorage
    localStorage.clear();

    const circuit = {
      version: 'v1' as const,
      nodes: [],
      connections: [],
    };

    const file = createFile('Test Circuit', circuit, {
      kind: 'source',
      schema_version: 'v1',
      created_by: 'test',
      derived_from: null,
    });

    expect(file.name).toBe('Test Circuit');
    expect(file.circuit).toEqual(circuit);

    const files = listFiles();
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('Test Circuit');
  });

  it('should delete files', () => {
    localStorage.clear();

    const circuit = {
      version: 'v1' as const,
      nodes: [],
      connections: [],
    };

    const file = createFile('To Delete', circuit, {
      kind: 'source',
      schema_version: 'v1',
      created_by: 'test',
      derived_from: null,
    });
    expect(listFiles()).toHaveLength(1);

    deleteFile(file.id);
    expect(listFiles()).toHaveLength(0);
  });

  it('should persist to localStorage', () => {
    localStorage.clear();

    const circuit = {
      version: 'v1' as const,
      nodes: [],
      connections: [],
    };

    createFile('Persistent', circuit, {
      kind: 'source',
      schema_version: 'v1',
      created_by: 'test',
      derived_from: null,
    });

    const stored = localStorage.getItem('rb:files:rblogic:v1');
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe('Persistent');
  });
});

describe('App Registry', () => {
  it('should register and retrieve apps', async () => {
    const { registerApp, getApp, listApps } = await import('../AppRegistry');
    const { TerminalApp } = await import('../apps/TerminalApp');

    // Manually register for test
    registerApp(TerminalApp);

    const apps = listApps();
    expect(apps.length).toBeGreaterThanOrEqual(1);

    const terminal = getApp('terminal');
    expect(terminal).toBeTruthy();
    expect(terminal?.manifest.name).toBe('Terminal');
    expect(terminal?.manifest.singleton).toBe(true);
  });
});

describe('Examples', () => {
  it('should list all examples', async () => {
    const { listExamples } = await import('../examples');

    const examples = listExamples();
    const ids = examples.map((ex) => ex.id);
    const requiredExampleIds = [
      '01_wire-lamp',
      '02_and-gate',
      '03_half-adder',
      '04_4bit-counter',
      '05_simple-cpu',
      '06_xor-gate',
      '07_2to1-mux',
      '08_full-adder',
      '09_4bit-adder',
      '10_sr-latch',
      '11_d-flipflop',
      '12_2to4-decoder',
      '13_4to1-mux',
      '14_4bit-register',
      '15_not-gate',
    ];

    expect(examples.length).toBeGreaterThanOrEqual(requiredExampleIds.length);
    // Original examples
    requiredExampleIds.forEach((id) => {
      expect(ids).toContain(id);
    });
  });

  it('should load example circuits', async () => {
    const { loadExample } = await import('../examples');

    const circuit = await loadExample('01_wire-lamp');
    expect(circuit.version).toBe('v1');
    expect(circuit.nodes).toHaveLength(2);
    expect(circuit.connections).toHaveLength(1);

    const powerNode = circuit.nodes.find((n) => n.type === 'PowerSource');
    const lampNode = circuit.nodes.find((n) => n.type === 'Lamp');

    expect(powerNode).toBeTruthy();
    expect(lampNode).toBeTruthy();
  });
});
