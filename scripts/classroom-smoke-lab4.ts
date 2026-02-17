import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDeterministicZip, sha256Hex } from '../packages/rb-apps/src/export/deterministicZip';
import { decodeRBProject, encodeRBProject, type RBProject } from '../packages/rb-apps/src/export/projectFormat';
import { exportBasys3Bundle } from '../packages/rb-apps/src/fpga/boards/basys3/basys3Bundle';

interface StarterNode {
  id?: string;
  type?: string;
  label?: string;
}

interface StarterConnection {
  fromNodeId?: string;
  toNodeId?: string;
  from?: { nodeId?: string };
  to?: { nodeId?: string };
}

interface StarterCircuitFile {
  nodes?: StarterNode[];
  connections?: StarterConnection[];
  ioMapping?: {
    inputs?: Array<{ label?: string; nodeId?: string }>;
    outputs?: Array<{ label?: string; nodeId?: string }>;
  };
}

interface SmokeHarnessResult {
  pass: boolean;
  reasons: string[];
  details: Record<string, unknown>;
}

interface IoMappingEntry {
  id: string;
  nodeId: string;
  port: string;
  pin?: string;
  label?: string;
}

interface IoMapping {
  inputs: IoMappingEntry[];
  outputs: IoMappingEntry[];
}

interface GoldenFixture extends RBProject {
  classroom?: {
    board?: 'basys3';
    ioMapping?: IoMapping;
  };
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

const starterPath = join(repoRoot, 'packages/rb-apps/src/examples/19_lab4-alu-starter-basys3.json');
const sanityFixturePath = join(repoRoot, 'packages/rb-apps/src/fixtures/classroom/lab4-sanity-and.rbproj');
const outPath = join(repoRoot, 'out/classroom/lab4-smoke.rb-lab.zip');

const REQUIRED_LABEL_KEYS = ['en', 'a', 'b', 's2', 's1', 's0', 'f'] as const;
const EXPECTED_SCAFFOLD_FAILURE_REASONS = ['output_unwired', 'no_operation_paths', 'select_logic_missing'] as const;
const GATE_TYPES = new Set(['AND', 'NAND', 'OR', 'NOR', 'XOR', 'XNOR', 'NOT', 'MUX', 'DECODER', 'TRISTATE', 'FULLADDER']);

function fail(message: string): never {
  console.error(`[classroom:smoke:lab4] FAIL: ${message}`);
  process.exit(1);
}

function normalizeLabel(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function hasLabelKey(node: StarterNode, key: (typeof REQUIRED_LABEL_KEYS)[number]): boolean {
  const label = normalizeLabel(node.label);
  return label === key || label.startsWith(`${key} `) || label.startsWith(`${key}(`) || label.includes(` ${key} `);
}

function runLab4Harness(
  starter: StarterCircuitFile,
  options: { requireSelectLogic: boolean },
): SmokeHarnessResult {
  const nodes = Array.isArray(starter.nodes) ? starter.nodes : [];
  const connections = Array.isArray(starter.connections) ? starter.connections : [];
  const reasons: string[] = [];

  const presentKeys = new Set<string>();
  for (const node of nodes) {
    for (const key of REQUIRED_LABEL_KEYS) {
      if (hasLabelKey(node, key)) {
        presentKeys.add(key);
      }
    }
  }
  for (const entry of starter.ioMapping?.inputs ?? []) {
    const label = normalizeLabel(entry.label);
    for (const key of REQUIRED_LABEL_KEYS) {
      if (label === key || label.startsWith(`${key} `) || label.startsWith(`${key}(`)) {
        presentKeys.add(key);
      }
    }
  }
  for (const entry of starter.ioMapping?.outputs ?? []) {
    const label = normalizeLabel(entry.label);
    if (label === 'f' || label.startsWith('f ') || label.startsWith('f(')) {
      presentKeys.add('f');
    }
  }

  const missingKeys = REQUIRED_LABEL_KEYS.filter((key) => !presentKeys.has(key));
  if (missingKeys.length > 0) {
    reasons.push('required_io_missing');
  }

  const fNodeIds = new Set(
    nodes
      .filter((node) => hasLabelKey(node, 'f'))
      .map((node) => String(node.id ?? '').trim())
      .filter((value) => value.length > 0),
  );
  for (const entry of starter.ioMapping?.outputs ?? []) {
    const label = normalizeLabel(entry.label);
    if (label === 'f' || label.startsWith('f ') || label.startsWith('f(')) {
      const mappedNodeId = String(entry.nodeId ?? '').trim();
      if (mappedNodeId.length > 0) {
        fNodeIds.add(mappedNodeId);
      }
    }
  }
  const hasOutputWiring = connections.some((connection) => {
    const toId = String(connection.toNodeId ?? connection.to?.nodeId ?? '').trim();
    return fNodeIds.has(toId);
  });
  if (!hasOutputWiring) {
    reasons.push('output_unwired');
  }

  const gateNodeCount = nodes.filter((node) => GATE_TYPES.has(String(node.type ?? '').toUpperCase())).length;
  if (gateNodeCount < 2) {
    reasons.push('no_operation_paths');
  }

  if (options.requireSelectLogic) {
    const selectNodeIds = new Set(
      nodes
        .filter((node) => hasLabelKey(node, 's2') || hasLabelKey(node, 's1') || hasLabelKey(node, 's0'))
        .map((node) => String(node.id ?? '').trim())
        .filter((value) => value.length > 0),
    );
    const hasSelectConnections = connections.some((connection) => {
      const fromId = String(connection.fromNodeId ?? connection.from?.nodeId ?? '').trim();
      return selectNodeIds.has(fromId);
    });
    if (!hasSelectConnections) {
      reasons.push('select_logic_missing');
    }
  }

  return {
    pass: reasons.length === 0,
    reasons,
    details: {
      nodeCount: nodes.length,
      connectionCount: connections.length,
      gateNodeCount,
      presentIo: [...presentKeys].sort(),
      missingIo: missingKeys,
      hasOutputWiring,
      requireSelectLogic: options.requireSelectLogic,
    },
  };
}

function assertScaffoldFailsWithExpectedReasons(starter: StarterCircuitFile): SmokeHarnessResult {
  const result = runLab4Harness(starter, { requireSelectLogic: true });
  if (result.pass) {
    fail('Starter scaffold unexpectedly passed harness (should be intentionally incomplete).');
  }

  for (const reason of EXPECTED_SCAFFOLD_FAILURE_REASONS) {
    if (!result.reasons.includes(reason)) {
      fail(`Starter scaffold missing expected failure reason: ${reason}`);
    }
  }

  return result;
}

function assertTinySanityPasses(starter: StarterCircuitFile): SmokeHarnessResult {
  const result = runLab4Harness(starter, { requireSelectLogic: false });
  if (!result.pass) {
    fail(`Tiny sanity fixture did not pass harness: ${result.reasons.join(', ')}`);
  }
  return result;
}

function assertPinsPresent(topXdc: string): void {
  const requiredPins = ['PACKAGE_PIN V2', 'PACKAGE_PIN V15', 'PACKAGE_PIN W15', 'PACKAGE_PIN E19'];
  for (const pin of requiredPins) {
    if (!topXdc.includes(pin)) {
      fail(`Expected pin mapping not found in top.xdc: ${pin}`);
    }
  }
}

async function main() {
  const starter = JSON.parse(readFileSync(starterPath, 'utf8')) as StarterCircuitFile;
  const scaffoldResult = assertScaffoldFailsWithExpectedReasons(starter);

  const sanityRaw = readFileSync(sanityFixturePath, 'utf8');
  const decoded = decodeRBProject(sanityRaw) as GoldenFixture;
  const normalized = decodeRBProject(encodeRBProject(decoded)) as GoldenFixture;

  const ioMapping = normalized.classroom?.ioMapping;
  if (!ioMapping) {
    fail('Sanity fixture missing classroom.ioMapping');
  }

  const sanityResult = assertTinySanityPasses({
    nodes: (normalized.circuit.nodes as StarterNode[]),
    connections: (normalized.circuit.connections as unknown as StarterConnection[]),
    ioMapping: {
      inputs: ioMapping.inputs.map((entry) => ({ label: entry.label, nodeId: entry.nodeId })),
      outputs: ioMapping.outputs.map((entry) => ({ label: entry.label, nodeId: entry.nodeId })),
    },
  });

  const bundle = exportBasys3Bundle(normalized.circuit, ioMapping);
  if (!bundle.valid) {
    fail(`Sanity fixture Basys3 export invalid: ${bundle.warnings.join('; ')}`);
  }

  assertPinsPresent(bundle.topXdc);

  const smokeReport = {
    schema: 'rb_classroom_smoke_lab4_v1',
    generatedAt: '2026-02-16T00:00:00.000Z',
    scaffoldCheck: scaffoldResult,
    tinySanityCheck: sanityResult,
    export: {
      valid: bundle.valid,
      warnings: bundle.warnings,
      topVhdContainsTopEntity: bundle.topVhd.includes('entity top is'),
      topXdcHasRequiredPins: true,
    },
  };

  const zipEntries = [
    { name: 'README.txt', text: bundle.readme },
    { name: 'smoke-report.json', text: JSON.stringify(smokeReport, null, 2) },
    { name: 'top.vhd', text: bundle.topVhd },
    { name: 'top.xdc', text: bundle.topXdc },
  ];

  const zipRun1 = await buildDeterministicZip(zipEntries);
  const zipRun2 = await buildDeterministicZip(zipEntries);
  const sha1 = sha256Hex(zipRun1);
  const sha2 = sha256Hex(zipRun2);
  if (sha1 !== sha2) {
    fail(`Deterministic smoke bundle mismatch: run1=${sha1} run2=${sha2}`);
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, Buffer.from(zipRun1));

  console.log(`[classroom:smoke:lab4] scaffold: PASS (expected incomplete reasons: ${scaffoldResult.reasons.join(', ')})`);
  console.log('[classroom:smoke:lab4] tiny-sanity: PASS');
  console.log(`[classroom:smoke:lab4] artifact: ${outPath}`);
  console.log(`[classroom:smoke:lab4] sha256(run1): ${sha1}`);
  console.log(`[classroom:smoke:lab4] sha256(run2): ${sha2}`);
  console.log('[classroom:smoke:lab4] result: GO');
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});