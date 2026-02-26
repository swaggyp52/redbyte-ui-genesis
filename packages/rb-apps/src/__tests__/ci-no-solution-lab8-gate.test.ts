import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadExampleAsProject } from '../examples';
import { getLabDefinitionById } from '../labs/labDefinitions';

interface StarterNode {
  id?: string;
  type?: string;
  label?: string;
}

interface StarterConnection {
  fromNodeId?: string;
  toNodeId?: string;
}

interface StarterCircuitFile {
  nodes?: StarterNode[];
  connections?: StarterConnection[];
  labSpec?: {
    checkpoints?: Array<{
      id?: string;
      type?: string;
      config?: {
        schedule?: string;
        clockSignal?: string;
      };
    }>;
  };
}

const STARTER_PATH = join(process.cwd(), 'packages/rb-apps/src/examples/23_lab8-fsm-lock-starter-basys3.json');

describe('ci:no-solution:lab8 gate', () => {
  it('keeps Lab 8 starter unsolved while preserving required IO scaffold', () => {
    const starter = JSON.parse(readFileSync(STARTER_PATH, 'utf8')) as StarterCircuitFile;
    const nodes = Array.isArray(starter.nodes) ? starter.nodes : [];
    const connections = Array.isArray(starter.connections) ? starter.connections : [];

    expect(nodes.length).toBeGreaterThanOrEqual(6);
    expect(connections.length).toBe(0);

    const labels = nodes.map((node) => String(node.label ?? '').toLowerCase());
    const requiredMarkers = ['in2 (sw8)', 'in1 (sw7)', 'in0 (sw6)', 'enter (sw5)', 'reset (sw4)', 'lock (led1)'];
    for (const marker of requiredMarkers) {
      expect(labels.some((label) => label.includes(marker))).toBe(true);
    }

    const suspiciousTypes = new Set(['FSM', 'COUNTER', 'DECODER', 'REGISTER', 'DFF']);
    const suspiciousNodes = nodes.filter((node) => suspiciousTypes.has(String(node.type ?? '').toUpperCase()));
    expect(suspiciousNodes).toEqual([]);

    const checkpoints = starter.labSpec?.checkpoints ?? [];
    const invalidCheckpoint = checkpoints.find((checkpoint) => checkpoint.id === 'fsm-invalid-path');
    const validCheckpoint = checkpoints.find((checkpoint) => checkpoint.id === 'fsm-valid-path');

    expect(invalidCheckpoint).toBeTruthy();
    expect(validCheckpoint).toBeTruthy();
    expect(invalidCheckpoint?.type).toBe('truth-table');
    expect(validCheckpoint?.type).toBe('truth-table');
    expect(invalidCheckpoint?.config?.schedule).toBe('clocked_macro');
    expect(validCheckpoint?.config?.schedule).toBe('clocked_macro');
    expect(invalidCheckpoint?.config?.clockSignal).toBe('sw_enter');
    expect(validCheckpoint?.config?.clockSignal).toBe('sw_enter');
  });

  it('maps Lab 8 to the unsolved starter scaffold', () => {
    const lab = getLabDefinitionById('lab-8');
    expect(lab).toBeTruthy();
    expect(lab?.starterExampleId).toBe('23_lab8-fsm-lock-starter-basys3');
  });

  it('preserves labSpec checkpoints when loading the starter as a project', () => {
    const project = loadExampleAsProject('23_lab8-fsm-lock-starter-basys3');
    const checkpoints = project.labSpec?.checkpoints ?? [];
    const invalidCheckpoint = checkpoints.find((checkpoint) => checkpoint.id === 'fsm-invalid-path');
    const validCheckpoint = checkpoints.find((checkpoint) => checkpoint.id === 'fsm-valid-path');

    expect(invalidCheckpoint).toBeTruthy();
    expect(validCheckpoint).toBeTruthy();
    expect((invalidCheckpoint?.config as { clockSignal?: string } | undefined)?.clockSignal).toBe('sw_enter');
    expect((validCheckpoint?.config as { clockSignal?: string } | undefined)?.clockSignal).toBe('sw_enter');
  });
});
