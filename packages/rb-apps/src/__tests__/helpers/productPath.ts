import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { IoMapping, TestVector } from '@redbyte/rb-utils';
import type { RBProject } from '../../export/projectFormat';
import { useCircuitStore } from '../../stores/circuitStore';
import { useProjectRuntime, type RuntimeVerifyRun } from '../../apps/ide/projectRuntime';
import { planStudioRun } from '../../apps/ide/studioRunInput';
import { deriveIdeBlockingDesignIssue } from '../../apps/ide/ideDesignBlocking';
import { buildIdeExportProject } from '../../apps/ide/ideExportProject';
import { getActiveScenario } from '../../apps/ide/verifyScenario';
import { buildExportVerifyAuthority, buildExportViewModel } from '../../apps/ide/viewmodels/buildExportViewModel';
import { buildVivadoProjectFolderEntries, deriveVivadoProjectSlug } from '../../fpga/vivado/vivadoProjectFolder';
import { classifyGhdlRun, runGhdlFiles } from './ghdlHarness';

/**
 * The student's path, shared by the artifact-consistency matrix and the review regressions:
 * Verify through planStudioRun and runVerification, Export from the same runtime state, and the
 * Open Project package exactly as Export builds it, run in GHDL.
 */

export const NOW = '2026-10-27T00:00:00.000Z';
export const at = (x: number, y = 0) => ({ position: { x, y }, x, y, rotation: 0, config: {}, state: {} });
export const wire = (id: string, from: string, fromPort: string, to: string, toPort: string) =>
  ({ id, from: { nodeId: from, portName: fromPort }, to: { nodeId: to, portName: toPort } });

export function resetRuntime(): void {
  localStorage.clear();
  useCircuitStore.getState().reset();
  useProjectRuntime.getState().resetToActiveExample();
}

/** A Basys3 project whose rows are keyed by node id and labelled with their pin. */
export function projectOf(name: string, circuit: Circuit, inputs: Array<[string, string]>, outputs: Array<[string, string]>, vectors: TestVector[] = [], hierarchy?: RBProject['hierarchy']): RBProject {
  const mapping: IoMapping = {
    inputs: inputs.map(([nodeId, pin]) => ({ id: nodeId, nodeId, port: 'out', label: pin, pin })),
    outputs: outputs.map(([nodeId, pin]) => ({ id: nodeId, nodeId, port: 'in', label: pin, pin })),
  };
  return projectWithMapping(name, circuit, mapping, vectors, hierarchy);
}

export function projectWithMapping(name: string, circuit: Circuit, mapping: IoMapping, vectors: TestVector[] = [], hierarchy?: RBProject['hierarchy']): RBProject {
  return {
    kind: 'rb-project', version: 1, createdAt: NOW, updatedAt: NOW, name, circuit, hierarchy, ioMapping: mapping, vectors,
    hdl: { top: 'top', sources: [] }, fpga: { board: 'basys3', part: 'xc7a35tcpg236-1', top: 'top' },
    meta: { projectId: `matrix-${name}` },
  } as RBProject;
}

export interface ProductRun {
  run?: RuntimeVerifyRun;
  refusal?: string;
  checkCount: number;
  project: RBProject;
  vm: ReturnType<typeof buildExportViewModel>;
  authority: ReturnType<typeof buildExportVerifyAuthority>;
}

/** Verify as a student runs it, then Export from the same runtime state. */
export function runProduct(): ProductRun {
  const state = useProjectRuntime.getState();
  const plan = planStudioRun(state, { captureEvaluations: false, resolveBlockingIssue: deriveIdeBlockingDesignIssue });
  let run: RuntimeVerifyRun | undefined;
  let refusal: string | undefined;
  try {
    run = useProjectRuntime.getState().runVerification(plan.input);
  } catch (error) {
    refusal = error instanceof Error ? error.message : String(error);
  }
  const after = useProjectRuntime.getState();
  const project = buildIdeExportProject(after);
  const scenario = getActiveScenario(after.scenarios, after.activeScenarioId) ?? undefined;
  return {
    run, refusal, checkCount: plan.checkCount, project,
    vm: buildExportViewModel(project, run, scenario, after.customVectors ?? []),
    authority: buildExportVerifyAuthority(project, run, scenario, after.customVectors ?? []),
  };
}

const checkedRows = (run: RuntimeVerifyRun) => run.report.rows.filter((row) => row.expected === '0' || row.expected === '1');

/** Failing checked cells of a recorded run, as its case table shows them. */
export function browserFailureCount(run: RuntimeVerifyRun): number {
  return checkedRows(run).filter((row) => row.actual !== row.expected).length;
}

/** Design sources in dependency order (an entity before every `entity work.<it>` user), then the bench. */
export function orderForAnalysis(files: Array<{ name: string; text: string }>): Array<{ name: string; text: string }> {
  const declares = new Map(files.map((file) => [file, (file.text.match(/^\s*entity\s+(\w+)\s+is/im)?.[1] ?? '').toLowerCase()]));
  const uses = (file: { text: string }) => [...file.text.matchAll(/entity\s+work\.(\w+)/gi)].map((match) => match[1].toLowerCase());
  const ordered: Array<{ name: string; text: string }> = [];
  const visit = (file: { name: string; text: string }, trail: Set<string>) => {
    if (ordered.includes(file) || trail.has(file.name)) return;
    trail.add(file.name);
    for (const dependency of uses(file)) {
      const provider = files.find((candidate) => declares.get(candidate) === dependency);
      if (provider) visit(provider, trail);
    }
    ordered.push(file);
  };
  for (const file of [...files].sort((left, right) => (left.name < right.name ? -1 : 1))) visit(file, new Set());
  return ordered;
}

export interface PackagedRun {
  outcome: string;
  rule: string;
  checks: number;
  failures: number;
  /** Failing checks per testbench vector index, from the bench's own assertion reports. */
  failuresByVector: Map<number, number>;
  log: string;
  /** The packaged design and bench text, by file name. */
  files: Array<{ name: string; text: string }>;
}

const DUMP_DIR = process.env.REDBYTE_MATRIX_DUMP?.trim();

/** The Open Project package exactly as Export builds it, its VHDL run in GHDL. */
export async function runPackage(label: string, product: ProductRun, expectedChecks: number): Promise<PackagedRun> {
  const zipArtifacts = product.vm.artifacts.filter((artifact) => artifact.content.trim().length > 0);
  const entries = await buildVivadoProjectFolderEntries({
    artifacts: zipArtifacts.map((artifact) => ({ path: artifact.path, content: artifact.content })),
    projectName: product.project.name,
    projectSlug: deriveVivadoProjectSlug(label),
    topModule: product.vm.topAuthority.designTop,
    part: product.project.fpga?.part,
  });
  const vhdl = entries.filter((entry) => !entry.dir && entry.name.endsWith('.vhd'));
  const design = vhdl.filter((entry) => entry.name.includes('/sources_1/'));
  const bench = vhdl.filter((entry) => entry.name.includes('/sim_1/'));
  // The download ZIP and the project folder carry the same design and bench text.
  for (const entry of [...design, ...bench]) {
    const base = entry.name.split('/').pop()!;
    const zipped = zipArtifacts.find((artifact) => artifact.path.split('/').pop() === base);
    expect(zipped?.content, `${label}: ${base} differs between the ZIP and the project folder`).toBe(entry.text);
  }
  const files = [...orderForAnalysis(design.map((entry) => ({ name: entry.name.split('/').pop()!, text: entry.text }))),
    ...bench.map((entry) => ({ name: 'testbench.vhd', text: entry.text }))];
  const run = runGhdlFiles(files, product.vm.topAuthority.simulationTop);
  const classified = classifyGhdlRun(run, { tbEntity: product.vm.topAuthority.simulationTop, expectedChecks });
  const failuresByVector = new Map<number, number>();
  for (const match of run.log.matchAll(/Vector (\d+) failed on /g)) failuresByVector.set(Number(match[1]), (failuresByVector.get(Number(match[1])) ?? 0) + 1);
  if (DUMP_DIR) {
    const dir = join(DUMP_DIR, label.replace(/[^A-Za-z0-9._-]+/g, '_'));
    mkdirSync(dir, { recursive: true });
    for (const file of files) writeFileSync(join(dir, file.name), file.text);
    writeFileSync(join(dir, 'ghdl.log'), run.log);
    writeFileSync(join(dir, 'export.json'), `${JSON.stringify({ status: product.vm.status, errors: product.vm.errors.map((e) => `${e.code} ${e.message}`), outcome: classified.outcome }, null, 2)}\n`);
  }
  return {
    outcome: classified.outcome, rule: classified.rule,
    checks: classified.summary?.checks ?? 0, failures: classified.summary?.failures ?? 0,
    failuresByVector, log: run.log, files,
  };
}

/** The shipped text of one packaged artifact. */
export function artifactText(product: ProductRun, path: string): string {
  return product.vm.artifacts.find((artifact) => artifact.path === path)?.content ?? '';
}
