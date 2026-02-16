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

const STARTER_PATH = join(process.cwd(), 'packages/rb-apps/src/examples/20_lab5-addsub-starter-basys3.json');

describe('ci:no-solution:lab5 gate', () => {
  it('keeps Lab 5 starter unsolved while preserving required IO scaffold', () => {
    const starter = JSON.parse(readFileSync(STARTER_PATH, 'utf8')) as StarterCircuitFile;
    const nodes = Array.isArray(starter.nodes) ? starter.nodes : [];
    const connections = Array.isArray(starter.connections) ? starter.connections : [];

    expect(nodes.length).toBeGreaterThanOrEqual(4);
    expect(connections.length).toBe(0);

    const labels = nodes.map((node) => String(node.label ?? '').toLowerCase());
    const requiredMarkers = ['m (sw8)', 'a (sw7)', 'b (sw6)', 'f (led1)'];
    for (const marker of requiredMarkers) {
      expect(labels.some((label) => label.includes(marker))).toBe(true);
    }

    const suspiciousTypes = new Set(['AND', 'NAND', 'OR', 'NOR', 'XOR', 'XNOR', 'MUX', 'DECODER', 'TRISTATE', 'FULLADDER']);
    const suspiciousNodes = nodes.filter((node) => suspiciousTypes.has(String(node.type ?? '').toUpperCase()));
    expect(suspiciousNodes).toEqual([]);
  });

  it('maps Lab 5 to the unsolved starter scaffold', () => {
    const lab = getLabDefinitionById('lab-5');
    expect(lab).toBeTruthy();
    expect(lab?.starterExampleId).toBe('20_lab5-addsub-starter-basys3');
  });
});
