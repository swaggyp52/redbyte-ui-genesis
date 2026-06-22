import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDeterministicZip, sha256Hex } from '../packages/rb-apps/src/export/deterministicZip';

type LabSmokeSpec = {
  labId: 'lab-5' | 'lab-6' | 'lab-7' | 'lab-8';
  starterPath: string;
  requiredLabels: string[];
};

type StarterNode = {
  id?: string;
  type?: string;
  label?: string;
};

type StarterConnection = {
  fromNodeId?: string;
  toNodeId?: string;
};

type StarterCircuitFile = {
  nodes?: StarterNode[];
  connections?: StarterConnection[];
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const outPath = join(repoRoot, 'out/classroom/labs-5-8-smoke.rb-lab.zip');

const LAB_SPECS: LabSmokeSpec[] = [
  {
    labId: 'lab-5',
    starterPath: join(repoRoot, 'packages/rb-apps/src/examples/20_lab5-addsub-starter-basys3.json'),
    requiredLabels: ['m (sw8)', 'a (sw7)', 'b (sw6)', 'f (led1)'],
  },
  {
    labId: 'lab-6',
    starterPath: join(repoRoot, 'packages/rb-apps/src/examples/21_lab6-flipflop-starter.json'),
    requiredLabels: ['clk', 'd', 'q'],
  },
  {
    labId: 'lab-7',
    starterPath: join(repoRoot, 'packages/rb-apps/src/examples/22_lab7-sync-counter-starter-basys3.json'),
    requiredLabels: ['en (sw8)', 'clk (sw7)', 'rst (sw6)', 'q2 (led2)', 'q1 (led1)', 'q0 (led0)'],
  },
  {
    labId: 'lab-8',
    starterPath: join(repoRoot, 'packages/rb-apps/src/examples/23_lab8-fsm-lock-starter-basys3.json'),
    requiredLabels: ['in2 (sw8)', 'in1 (sw7)', 'in0 (sw6)', 'enter (sw5)', 'reset (sw4)', 'lock (led1)'],
  },
];

function fail(message: string): never {
  console.error(`[classroom:smoke:labs-5-8] FAIL: ${message}`);
  process.exit(1);
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function analyzeStarter(starter: StarterCircuitFile, spec: LabSmokeSpec) {
  const nodes = Array.isArray(starter.nodes) ? starter.nodes : [];
  const connections = Array.isArray(starter.connections) ? starter.connections : [];

  if (connections.length !== 0) {
    fail(`${spec.labId} starter must be unsolved scaffold with zero connections (found ${connections.length}).`);
  }

  const labels = nodes.map((node) => normalize(node.label));
  for (const marker of spec.requiredLabels) {
    if (!labels.some((label) => label.includes(marker))) {
      fail(`${spec.labId} starter missing required label marker: ${marker}`);
    }
  }

  const suspiciousTypes = new Set(['AND', 'NAND', 'OR', 'NOR', 'XOR', 'XNOR', 'MUX', 'DECODER', 'TRISTATE', 'FULLADDER', 'COUNTER', 'FSM', 'DFF', 'LATCH']);
  const suspiciousNodes = nodes.filter((node) => suspiciousTypes.has(String(node.type ?? '').toUpperCase()));
  if (suspiciousNodes.length > 0) {
    fail(`${spec.labId} starter contains solution-like logic nodes: ${suspiciousNodes.map((node) => node.type).join(', ')}`);
  }

  return {
    labId: spec.labId,
    nodeCount: nodes.length,
    connectionCount: connections.length,
    requiredLabelsSatisfied: true,
  };
}

async function main() {
  const report = {
    schema: 'rb_classroom_smoke_labs_5_8_v1',
    generatedAt: '2026-02-16T00:00:00.000Z',
    results: [] as Array<ReturnType<typeof analyzeStarter>>,
  };

  for (const spec of LAB_SPECS) {
    const starter = JSON.parse(readFileSync(spec.starterPath, 'utf8')) as StarterCircuitFile;
    report.results.push(analyzeStarter(starter, spec));
  }

  const entries = [
    { name: 'README.txt', text: 'Classroom smoke verification for Labs 5-8 unsolved starter scaffolds.' },
    { name: 'smoke-report.json', text: JSON.stringify(report, null, 2) },
  ];

  const zipRun1 = await buildDeterministicZip(entries);
  const zipRun2 = await buildDeterministicZip(entries);
  const sha1 = await sha256Hex(zipRun1);
  const sha2 = await sha256Hex(zipRun2);

  if (sha1 !== sha2) {
    fail(`Deterministic smoke artifact hash mismatch: ${sha1} vs ${sha2}`);
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, Buffer.from(zipRun1));

  console.log('[classroom:smoke:labs-5-8] starters: PASS');
  console.log(`[classroom:smoke:labs-5-8] artifact: ${outPath}`);
  console.log(`[classroom:smoke:labs-5-8] sha256(run1): ${sha1}`);
  console.log(`[classroom:smoke:labs-5-8] sha256(run2): ${sha2}`);
  console.log('[classroom:smoke:labs-5-8] result: GO');
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
