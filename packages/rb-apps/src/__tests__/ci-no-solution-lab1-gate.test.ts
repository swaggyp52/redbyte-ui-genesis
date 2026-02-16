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

const STARTER_PATH = join(
  process.cwd(),
  'packages/rb-apps/src/examples/01_wire-lamp.json',
);

const GATE_TYPES = new Set([
  'AND', 'NAND', 'OR', 'NOR', 'XOR', 'XNOR', 'NOT',
  'MUX', 'DECODER', 'TRISTATE', 'FULLADDER',
]);

describe('ci:no-solution:lab1 gate', () => {
  it('keeps Lab 1 starter as a minimal wire-lamp scaffold', () => {
    const starter = JSON.parse(readFileSync(STARTER_PATH, 'utf8')) as StarterCircuitFile;
    const nodes = Array.isArray(starter.nodes) ? starter.nodes : [];
    const connections = Array.isArray(starter.connections) ? starter.connections : [];

    // Lab 1 starter should be minimal: a power source and a lamp
    expect(nodes.length).toBeLessThanOrEqual(4);
    expect(connections.length).toBeLessThanOrEqual(2);

    // No gate-type nodes should be present — that would be the solution
    const gateNodes = nodes.filter((n) =>
      GATE_TYPES.has(String(n.type ?? '').toUpperCase()),
    );
    expect(gateNodes).toEqual([]);

    // No suspicious solution labels
    const allText = nodes
      .map((n) => `${String(n.id ?? '')} ${String(n.label ?? '')}`.toLowerCase())
      .join(' ');
    expect(allText).not.toMatch(/\bsolution\b/);
    expect(allText).not.toMatch(/\bcomplete\b/);
    expect(allText).not.toMatch(/\bfinal\b/);
  });

  it('has a matching lab definition', () => {
    const lab = getLabDefinitionById('lab-1');
    expect(lab).toBeTruthy();
    expect(lab?.starterExampleId).toBe('01_wire-lamp');
  });
});
