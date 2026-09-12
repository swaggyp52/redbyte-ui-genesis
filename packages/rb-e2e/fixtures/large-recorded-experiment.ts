// Uses the canonical hierarchical starter and HDL generator; fixed inputs for repeatable browser proof.
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildHierarchicalRippleAdder } from '../../rb-apps/src/apps/ide/examples/hierarchicalRippleAdder';
import { generateHierarchicalVhdlProject } from '../../rb-apps/src/apps/ide/hierarchicalVhdl';
import type { RBProject } from '../../rb-apps/src/export/projectFormat';
const fixture = buildHierarchicalRippleAdder();
const project: RBProject = {
  kind: 'rb-project', version: 1, name: '512-case hierarchical adder',
  createdAt: '2026-09-12T00:00:00.000Z', updatedAt: '2026-09-12T00:00:00.000Z',
  circuit: fixture.circuit, hierarchy: fixture.hierarchy,
  ioMapping: { inputs: fixture.ioRows.filter(row => row.direction === 'in'), outputs: fixture.ioRows.filter(row => row.direction === 'out') },
  vectors: Array.from({ length: 512 }, (_, tick) => {
    const a = tick % 16, b = Math.floor(tick / 16) % 16, sum = a + b;
    return { tick, inputs: Object.fromEntries([0,1,2,3].flatMap(i => [[`a${i}`, (a >> i) & 1], [`b${i}`, (b >> i) & 1]])),
      expected: Object.fromEntries([...([0,1,2,3].map(i => [`sum${i}`, (sum >> i) & 1])), ['carry-out', (sum >> 4) & 1]]) };
  }),
  fpga: { board: 'basys3', top: 'top' },
  meta: { projectId: 'p2-6b-large-fixture' },
};
const hdl = generateHierarchicalVhdlProject(project)!;
project.hdl = { top: 'top', sources: [{ path: 'top.vhd', language: 'vhdl', text: hdl.topVhd },
  ...hdl.moduleSources.map(source => ({ path: source.path, language: 'vhdl' as const, text: source.text }))] };
mkdirSync('.redbyte/e2e-evidence/large-experiment', { recursive: true });
writeFileSync('.redbyte/e2e-evidence/large-experiment/fixture.rbproj', JSON.stringify(project));
