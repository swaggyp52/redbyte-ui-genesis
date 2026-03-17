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

const STARTER_PATH = join(process.cwd(), 'packages/rb-apps/src/examples/21_lab6-flipflop-starter.json');

describe('ci:no-solution:lab6 gate', () => {
  it('keeps Lab 6 starter unsolved while preserving required signal scaffold', () => {
    const starter = JSON.parse(readFileSync(STARTER_PATH, 'utf8')) as StarterCircuitFile;
    const nodes = Array.isArray(starter.nodes) ? starter.nodes : [];
    const connections = Array.isArray(starter.connections) ? starter.connections : [];

    expect(nodes.length).toBeGreaterThanOrEqual(10);
    expect(connections.length).toBe(0);

    const labels = nodes.map((node) => String(node.label ?? '').toLowerCase());
    const requiredMarkers = ['dl_d', 'dl_g', 'dff_d', 'dff_clk', 'tff_t', 'tff_clk', 'clr0', 'jk_j', 'jk_k', 'jk_clk', 'q'];
    for (const marker of requiredMarkers) {
      expect(labels.some((label) => label.includes(marker))).toBe(true);
    }

    const suspiciousTypes = new Set(['DLATCH', 'DFLIPFLOP', 'TFLIPFLOP', 'JKFLIPFLOP', 'DFF', 'LATCH', 'TFF', 'JKFF', 'REGISTER', 'COUNTER']);
    const suspiciousNodes = nodes.filter((node) => suspiciousTypes.has(String(node.type ?? '').toUpperCase()));
    expect(suspiciousNodes).toEqual([]);

    const groundNodes = nodes.filter((node) => String(node.type ?? '') === 'Ground');
    expect(groundNodes.length).toBeGreaterThanOrEqual(2);
  });

  it('maps Lab 6 to the unsolved starter scaffold', () => {
    const lab = getLabDefinitionById('lab-6');
    expect(lab).toBeTruthy();
    expect(lab?.starterExampleId).toBe('21_lab6-flipflop-starter');
    expect(lab?.requiredBoardPreset).toBe('basys3');
  });
});
