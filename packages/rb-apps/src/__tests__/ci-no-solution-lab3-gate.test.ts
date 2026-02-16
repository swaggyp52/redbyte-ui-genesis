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
  'packages/rb-apps/src/examples/12_2to4-decoder.json',
);

describe('ci:no-solution:lab3 gate', () => {
  it('keeps Lab 3 starter within expected decoder scaffold bounds', () => {
    const starter = JSON.parse(readFileSync(STARTER_PATH, 'utf8')) as StarterCircuitFile;
    const nodes = Array.isArray(starter.nodes) ? starter.nodes : [];
    const connections = Array.isArray(starter.connections) ? starter.connections : [];

    // The 2-to-4 decoder starter is a reference circuit — verify it hasn't
    // grown beyond its known scaffold shape
    expect(nodes.length).toBeLessThanOrEqual(20);
    expect(connections.length).toBeLessThanOrEqual(20);

    // No suspicious solution labels
    const allText = nodes
      .map((n) => `${String(n.id ?? '')} ${String(n.label ?? '')}`.toLowerCase())
      .join(' ');
    expect(allText).not.toMatch(/\bsolution\b/);
    expect(allText).not.toMatch(/\bcomplete\b/);
    expect(allText).not.toMatch(/\bseven.?seg(ment)?\b/);

    // Should not contain MUX / TRISTATE / FULLADDER (not part of Lab 3 scaffold)
    const suspiciousTypes = new Set(['MUX', 'TRISTATE', 'FULLADDER']);
    const suspiciousNodes = nodes.filter((n) =>
      suspiciousTypes.has(String(n.type ?? '').toUpperCase()),
    );
    expect(suspiciousNodes).toEqual([]);
  });

  it('has a matching lab definition', () => {
    const lab = getLabDefinitionById('lab-3');
    expect(lab).toBeTruthy();
    expect(lab?.starterExampleId).toBe('12_2to4-decoder');
  });
});
