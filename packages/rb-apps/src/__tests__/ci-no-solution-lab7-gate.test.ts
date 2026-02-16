import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
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
}

const STARTER_PATH = join(process.cwd(), 'packages/rb-apps/src/examples/22_lab7-sync-counter-starter-basys3.json');

describe('ci:no-solution:lab7 gate', () => {
  it('keeps Lab 7 starter unsolved while preserving required IO scaffold', () => {
    const starter = JSON.parse(readFileSync(STARTER_PATH, 'utf8')) as StarterCircuitFile;
    const nodes = Array.isArray(starter.nodes) ? starter.nodes : [];
    const connections = Array.isArray(starter.connections) ? starter.connections : [];

    expect(nodes.length).toBeGreaterThanOrEqual(6);
    expect(connections.length).toBe(0);

    const labels = nodes.map((node) => String(node.label ?? '').toLowerCase());
    const requiredMarkers = ['en (sw8)', 'clk (sw7)', 'rst (sw6)', 'q2 (led2)', 'q1 (led1)', 'q0 (led0)'];
    for (const marker of requiredMarkers) {
      expect(labels.some((label) => label.includes(marker))).toBe(true);
    }

    const suspiciousTypes = new Set(['COUNTER', 'DFF', 'REGISTER', 'FSM', 'LATCH']);
    const suspiciousNodes = nodes.filter((node) => suspiciousTypes.has(String(node.type ?? '').toUpperCase()));
    expect(suspiciousNodes).toEqual([]);
  });

  it('maps Lab 7 to the unsolved starter scaffold', () => {
    const lab = getLabDefinitionById('lab-7');
    expect(lab).toBeTruthy();
    expect(lab?.starterExampleId).toBe('22_lab7-sync-counter-starter-basys3');
  });
});
