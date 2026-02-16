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
  'packages/rb-apps/src/examples/19_lab4-alu-starter-basys3.json',
);

describe('ci:no-solution:lab4 gate', () => {
  it('keeps Lab 4 starter unsolved while preserving required IO scaffold', () => {
    const starter = JSON.parse(readFileSync(STARTER_PATH, 'utf8')) as StarterCircuitFile;
    const nodes = Array.isArray(starter.nodes) ? starter.nodes : [];
    const connections = Array.isArray(starter.connections) ? starter.connections : [];

    expect(nodes.length).toBeGreaterThanOrEqual(7);
    expect(connections.length).toBe(0);

    const labels = nodes.map((node) => String(node.label ?? '').toLowerCase());
    const requiredMarkers = ['en (sw8)', 'a (sw5)', 'b (sw4)', 's2 (sw3)', 's1 (sw2)', 's0 (sw1)', 'f (led1)'];
    for (const marker of requiredMarkers) {
      expect(labels.some((label) => label.includes(marker))).toBe(true);
    }

    const suspiciousNodeTypes = new Set(['AND', 'NAND', 'OR', 'NOR', 'XOR', 'XNOR', 'MUX', 'DECODER', 'TRISTATE', 'FULLADDER']);
    const suspiciousNodes = nodes.filter((node) => suspiciousNodeTypes.has(String(node.type ?? '').toUpperCase()));
    expect(suspiciousNodes.length).toBeLessThanOrEqual(1);

    const suspiciousTextPatterns = [/\balu\b/i, /\bopcode\b/i, /mux\s*8\s*[:_\-]?\s*1/i, /full\s*adder/i, /carry\s*out/i];
    const suspiciousNames = nodes
      .map((node) => `${String(node.id ?? '')} ${String(node.label ?? '')}`.trim())
      .filter((text) => suspiciousTextPatterns.some((pattern) => pattern.test(text)));
    expect(suspiciousNames).toEqual([]);
  });

  it('keeps explicit Lab 4 mapping guidance in lab definition text', () => {
    const lab4 = getLabDefinitionById('lab-4');
    expect(lab4).toBeTruthy();

    const hardwareText = (lab4?.hardwareSteps ?? []).join(' ').toLowerCase();
    const mappingTerms = ['sw8', 'sw5', 'sw4', 'sw3', 'sw2', 'sw1', 'led1'];
    for (const term of mappingTerms) {
      expect(hardwareText.includes(term)).toBe(true);
    }

    const buildText = (lab4?.buildSteps ?? []).join(' ').toLowerCase();
    expect(buildText.includes('8:1 mux') || buildText.includes('8-to-1 mux')).toBe(true);
    expect(buildText.includes('decoder')).toBe(true);
  });
});