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
  'packages/rb-apps/src/examples/09_4bit-adder.json',
);

describe('ci:no-solution:lab2 gate', () => {
  it('keeps Lab 2 starter within expected 4-bit adder scaffold bounds', () => {
    const starter = JSON.parse(readFileSync(STARTER_PATH, 'utf8')) as StarterCircuitFile;
    const nodes = Array.isArray(starter.nodes) ? starter.nodes : [];
    const connections = Array.isArray(starter.connections) ? starter.connections : [];

    // The 4-bit adder starter is a reference circuit — verify it hasn't
    // grown beyond its known scaffold shape (no extra solution modules added)
    expect(nodes.length).toBeLessThanOrEqual(40);
    expect(connections.length).toBeLessThanOrEqual(50);

    // No suspicious solution labels indicating someone added answer annotations
    const allText = nodes
      .map((n) => `${String(n.id ?? '')} ${String(n.label ?? '')}`.toLowerCase())
      .join(' ');
    expect(allText).not.toMatch(/\bsolution\b/);
    expect(allText).not.toMatch(/\bcomplete\b/);
    expect(allText).not.toMatch(/\bfinal\s+adder\b/);

    // Should not contain ALU / MUX / DECODER nodes (those are Lab 4+ concepts)
    const suspiciousTypes = new Set(['MUX', 'DECODER', 'TRISTATE']);
    const suspiciousNodes = nodes.filter((n) =>
      suspiciousTypes.has(String(n.type ?? '').toUpperCase()),
    );
    expect(suspiciousNodes).toEqual([]);
  });

  it('has a matching lab definition', () => {
    const lab = getLabDefinitionById('lab-2');
    expect(lab).toBeTruthy();
    expect(lab?.starterExampleId).toBe('09_4bit-adder');
  });
});
