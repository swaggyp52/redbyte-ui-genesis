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

    // Must have at minimum: 11 inputs (SW[3:0] A, SW[7:4] B, SW[10:8] opcode) +
    // 4 AND + 4 OR + 4 XOR + 4 FA + 4 MUX4 + 5 Lamps (LED[3:0] + LED[4]) = 36 nodes
    expect(nodes.length).toBeGreaterThanOrEqual(32);

    // Zero connections — starter is intentionally unsolved
    expect(connections.length).toBe(0);

    // Required IO label markers (case-insensitive substring match)
    const labels = nodes.map((node) => String(node.label ?? '').toLowerCase());

    // A operand switches: SW[0..3]
    const aMarkers = ['sw[0]', 'sw[1]', 'sw[2]', 'sw[3]'];
    for (const marker of aMarkers) {
      expect(labels.some((label) => label.includes(marker))).toBe(true);
    }

    // B operand switches: SW[4..7]
    const bMarkers = ['sw[4]', 'sw[5]', 'sw[6]', 'sw[7]'];
    for (const marker of bMarkers) {
      expect(labels.some((label) => label.includes(marker))).toBe(true);
    }

    // Opcode switches: SW[8], SW[9], SW[10]
    const opcodeMarkers = ['sw[8]', 'sw[9]', 'sw[10]'];
    for (const marker of opcodeMarkers) {
      expect(labels.some((label) => label.includes(marker))).toBe(true);
    }

    // Output lamps: LED[0..4]
    const ledMarkers = ['led[0]', 'led[1]', 'led[2]', 'led[3]', 'led[4]'];
    for (const marker of ledMarkers) {
      expect(labels.some((label) => label.includes(marker))).toBe(true);
    }

    // Pre-placed logic blocks present (integration scaffold)
    const types = nodes.map((node) => String(node.type ?? '').toUpperCase());
    expect(types.filter((t) => t === 'AND').length).toBeGreaterThanOrEqual(4);
    expect(types.filter((t) => t === 'OR').length).toBeGreaterThanOrEqual(4);
    expect(types.filter((t) => t === 'XOR').length).toBeGreaterThanOrEqual(4);
    expect(types.filter((t) => t === 'FULLADDER').length).toBeGreaterThanOrEqual(4);
    expect(types.filter((t) => t === 'MUX4').length).toBeGreaterThanOrEqual(4);

    // No solved wiring present — all ALU datapath connections must be left to student
    // (connections array is already checked to be empty above)
  });

  it('keeps explicit Lab 4 mapping guidance in lab definition text', () => {
    const lab4 = getLabDefinitionById('lab-4');
    expect(lab4).toBeTruthy();

    // Hardware steps must document the new SW/LED mapping
    const hardwareText = (lab4?.hardwareSteps ?? []).join(' ').toLowerCase();
    const mappingTerms = ['sw[3:0]', 'sw[7:4]', 'sw[10:8]', 'led[3:0]', 'led[4]'];
    for (const term of mappingTerms) {
      expect(hardwareText.includes(term)).toBe(true);
    }

    // Build steps must guide students through wiring the datapath
    const buildText = (lab4?.buildSteps ?? []).join(' ').toLowerCase();
    expect(buildText.includes('fa') || buildText.includes('fulladder') || buildText.includes('adder')).toBe(true);
    expect(buildText.includes('mux') || buildText.includes('select')).toBe(true);
    expect(buildText.includes('led')).toBe(true);
  });
});
