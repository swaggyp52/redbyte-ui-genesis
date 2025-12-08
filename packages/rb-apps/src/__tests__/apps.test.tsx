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

    const file = createFile('Test Circuit', circuit);

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

    const file = createFile('To Delete', circuit);
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

    createFile('Persistent', circuit);

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
    expect(examples).toHaveLength(5);

    const ids = examples.map((ex) => ex.id);
    expect(ids).toContain('01_wire-lamp');
    expect(ids).toContain('02_and-gate');
    expect(ids).toContain('03_half-adder');
    expect(ids).toContain('04_4bit-counter');
    expect(ids).toContain('05_simple-cpu');
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
