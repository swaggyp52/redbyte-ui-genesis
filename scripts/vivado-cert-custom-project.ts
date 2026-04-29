/**
 * Generic custom-project Vivado certification harness.
 *
 * Usage:
 *   pnpm exec tsx scripts/vivado-cert-custom-project.ts --case my-case --project path/to/project.rbproj --program false
 *   pnpm exec tsx scripts/vivado-cert-custom-project.ts --case fs-and --fixture fs-comb-switch-and-basys3 --program true
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import {
  FROM_SCRATCH_BASYS3_CERT_FIXTURE_IDS,
  getFromScratchBasys3CertProjectById,
} from '../packages/rb-apps/src/apps/ide/fixtures/fromScratchBasys3CertProjects';
import {
  decodeRBProject,
  encodeRBProject,
  type RBProject,
} from '../packages/rb-apps/src/export/projectFormat';
import { stableStringify } from '../packages/rb-apps/src/export/stableStringify';
import { exportBasys3Bundle } from '../packages/rb-apps/src/fpga/boards/basys3/basys3Bundle';
import {
  buildVivadoProjectFolderZip,
  deriveVivadoProjectSlug,
  resolveVivadoPart,
} from '../packages/rb-apps/src/fpga/vivado/vivadoProjectFolder';

type ProjectSource =
  | { kind: 'project-path'; sourcePath: string }
  | {
      kind: 'from-scratch-fixture';
      fixtureId: (typeof FROM_SCRATCH_BASYS3_CERT_FIXTURE_IDS)[number];
    };

interface CliOptions {
  caseId: string;
  projectSource: ProjectSource;
  expectedBehavior?: string;
  jobs: number;
  program: boolean;
  hwServer?: string;
}

interface BringUpIoRow {
  id: string;
  nodeId?: string;
  label: string;
  port?: string;
  direction: 'in' | 'out';
  pin: string;
  required: boolean;
}

interface HarnessBringUpArtifacts {
  bringupMarkdown: string;
  expectedIoJson: string;
  programAndTestTcl: string;
}

interface HarnessSummary {
  caseId: string;
  generatedAtIso: string;
  commitSha: string;
  projectName: string;
  projectSlug: string;
  projectSource: ProjectSource;
  topModule: string;
  part: string;
  expectedBehavior: string;
  exportWarnings: string[];
  exportPaths: {
    bundleZip: string;
    unpackedProjectDir: string;
    xpr: string;
    topVhd: string;
    topXdc: string;
    bringup: string;
    expectedIo: string;
    programAndTestTcl: string;
  };
  logs: {
    vivadoBatch: string;
    vivadoSynth: string;
    vivadoImpl: string;
    vivadoBitstream: string;
    vivadoProgram?: string;
  };
  statuses: {
    export: 'passed';
    vivadoBuild: 'passed';
    boardProgram: 'passed' | 'skipped';
  };
  bitstreamPath?: string;
  notes: string[];
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const vivadoBat = 'C:\\Xilinx\\Vivado\\2024.2\\bin\\vivado.bat';

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outDir = join(repoRoot, 'out', 'vivado-cert', 'custom-projects', options.caseId);
  mkdirSync(outDir, { recursive: true });

  const { project, sourceCopyName, sourceNote } = loadProject(options.projectSource);
  if (!project.ioMapping) {
    throw new Error('custom-project harness requires project.ioMapping');
  }

  const ioRows = toBringUpIoRows(project);
  const projectForExport = project;

  const expectedBehavior =
    options.expectedBehavior?.trim() ||
    project.description?.trim() ||
    'Outputs should match the generated bring-up vectors and EXPECTED_IO report.';

  const bundle = exportBasys3Bundle(projectForExport.circuit, projectForExport.ioMapping);
  if (!bundle.valid) {
    throw new Error(`exportBasys3Bundle invalid: ${bundle.warnings.join('; ')}`);
  }

  const slug = deriveVivadoProjectSlug(projectForExport.meta?.projectId ?? projectForExport.name);
  const manifestText = encodeRBProject(projectForExport);
  const bringup = buildHarnessBringUpArtifacts(projectForExport, ioRows, expectedBehavior);
  const zipBytes = await buildZipBytes({
    bundle,
    manifestText,
    project: projectForExport,
    bringup,
    slug,
  });

  const normalizedProjectPath = join(outDir, sourceCopyName);
  const bundleZipPath = join(outDir, `${slug}.zip`);
  const unpackDir = join(outDir, 'unpacked');
  const xprPath = join(unpackDir, slug, `${slug}.xpr`);
  const rootTopVhd = join(outDir, 'top.vhd');
  const rootTopXdc = join(outDir, 'top.xdc');
  const rootBringupPath = join(outDir, 'BRINGUP.md');
  const rootExpectedIoPath = join(outDir, 'EXPECTED_IO.json');
  const rootProgramAndTestPath = join(outDir, 'program_and_test.tcl');
  const exportSummaryPath = join(outDir, 'export-summary.json');
  const resultPath = join(outDir, 'result.md');
  const vivadoBatchLogPath = join(outDir, 'vivado_batch.log');
  const vivadoSynthLogPath = join(outDir, 'vivado_synth.log');
  const vivadoImplLogPath = join(outDir, 'vivado_impl.log');
  const vivadoBitstreamLogPath = join(outDir, 'vivado_bitstream.log');
  const vivadoProgramLogPath = join(outDir, 'vivado_program.log');

  writeFileSync(normalizedProjectPath, manifestText);
  writeFileSync(bundleZipPath, Buffer.from(zipBytes));
  writeFileSync(rootTopVhd, bundle.topVhd);
  writeFileSync(rootTopXdc, bundle.topXdc);
  writeFileSync(rootBringupPath, bringup.bringupMarkdown);
  writeFileSync(rootExpectedIoPath, bringup.expectedIoJson);
  writeFileSync(rootProgramAndTestPath, bringup.programAndTestTcl);
  if (options.projectSource.kind === 'project-path') {
    copyFileSync(options.projectSource.sourcePath, join(outDir, basename(options.projectSource.sourcePath)));
  }

  expandArchive(bundleZipPath, unpackDir);

  const commitSha = execSync('git rev-parse HEAD', {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();

  runVivadoBatch(xprPath, vivadoBatchLogPath, options.jobs);
  copyFileSync(vivadoBatchLogPath, vivadoSynthLogPath);
  copyFileSync(vivadoBatchLogPath, vivadoImplLogPath);
  copyFileSync(vivadoBatchLogPath, vivadoBitstreamLogPath);

  const bitstreamPath = extractBitstreamPath(vivadoBatchLogPath);
  let boardProgramStatus: 'passed' | 'skipped' = 'skipped';
  if (options.program) {
    runVivadoProgram(bitstreamPath, vivadoProgramLogPath, options.hwServer);
    boardProgramStatus = 'passed';
  }

  const summary: HarnessSummary = {
    caseId: options.caseId,
    generatedAtIso: new Date().toISOString(),
    commitSha,
    projectName: projectForExport.name,
    projectSlug: slug,
    projectSource: options.projectSource,
    topModule: projectForExport.fpga?.top ?? 'top',
    part: resolveVivadoPart(projectForExport.fpga?.part),
    expectedBehavior,
    exportWarnings: bundle.warnings,
    exportPaths: {
      bundleZip: relativeFromRepo(bundleZipPath),
      unpackedProjectDir: relativeFromRepo(join(unpackDir, slug)),
      xpr: relativeFromRepo(xprPath),
      topVhd: relativeFromRepo(rootTopVhd),
      topXdc: relativeFromRepo(rootTopXdc),
      bringup: relativeFromRepo(rootBringupPath),
      expectedIo: relativeFromRepo(rootExpectedIoPath),
      programAndTestTcl: relativeFromRepo(rootProgramAndTestPath),
    },
    logs: {
      vivadoBatch: relativeFromRepo(vivadoBatchLogPath),
      vivadoSynth: relativeFromRepo(vivadoSynthLogPath),
      vivadoImpl: relativeFromRepo(vivadoImplLogPath),
      vivadoBitstream: relativeFromRepo(vivadoBitstreamLogPath),
      vivadoProgram: options.program ? relativeFromRepo(vivadoProgramLogPath) : undefined,
    },
    statuses: {
      export: 'passed',
      vivadoBuild: 'passed',
      boardProgram: boardProgramStatus,
    },
    bitstreamPath: relativeFromRepo(bitstreamPath),
    notes: [
      sourceNote,
      'Canonical repo flow uses one Vivado batch log for synth + impl + bitstream; this harness copies that log to stage-named files for deterministic artifact collection.',
    ],
  };

  writeFileSync(exportSummaryPath, stableStringify(summary));
  writeFileSync(resultPath, renderResult(summary));

  console.log(`[vivado-cert-custom] case: ${options.caseId}`);
  console.log(`[vivado-cert-custom] summary: ${exportSummaryPath}`);
  console.log(`[vivado-cert-custom] result: ${resultPath}`);
}

function parseArgs(args: string[]): CliOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index++) {
    const raw = args[index];
    if (!raw.startsWith('--')) continue;
    const key = raw.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith('--')) {
      values.set(key, 'true');
      continue;
    }
    values.set(key, next);
    index += 1;
  }

  const caseId = sanitizeCaseId(values.get('case') ?? '');
  if (!caseId) {
    throw new Error(
      'usage: pnpm exec tsx scripts/vivado-cert-custom-project.ts --case <case-id> (--project <path.rbproj> | --fixture <fixture-id>) [--program true|false] [--jobs 4] [--expected-behavior "..."] [--hw-server host:3121]'
    );
  }

  const projectPath = values.get('project')?.trim();
  const fixtureId = values.get('fixture')?.trim();
  if ((projectPath ? 1 : 0) + (fixtureId ? 1 : 0) !== 1) {
    throw new Error('exactly one of --project or --fixture is required');
  }

  const jobs = Number.parseInt(values.get('jobs') ?? '4', 10);
  const program = parseBoolean(values.get('program') ?? 'false');

  return {
    caseId,
    projectSource: projectPath
      ? { kind: 'project-path', sourcePath: resolve(repoRoot, projectPath) }
      : {
          kind: 'from-scratch-fixture',
          fixtureId: parseFixtureId(fixtureId ?? ''),
        },
    expectedBehavior: values.get('expected-behavior') ?? undefined,
    jobs: Number.isFinite(jobs) && jobs > 0 ? jobs : 4,
    program,
    hwServer: values.get('hw-server')?.trim() || undefined,
  };
}

function parseFixtureId(raw: string): (typeof FROM_SCRATCH_BASYS3_CERT_FIXTURE_IDS)[number] {
  const fixtureId = raw as (typeof FROM_SCRATCH_BASYS3_CERT_FIXTURE_IDS)[number];
  if (!FROM_SCRATCH_BASYS3_CERT_FIXTURE_IDS.includes(fixtureId)) {
    throw new Error(
      `unknown fixture id: ${raw}; expected one of ${FROM_SCRATCH_BASYS3_CERT_FIXTURE_IDS.join(', ')}`
    );
  }
  return fixtureId;
}

function parseBoolean(raw: string): boolean {
  return /^(1|true|yes)$/i.test(raw.trim());
}

function sanitizeCaseId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function loadProject(source: ProjectSource): {
  project: RBProject;
  sourceCopyName: string;
  sourceNote: string;
} {
  if (source.kind === 'project-path') {
    if (!existsSync(source.sourcePath)) {
      throw new Error(`project file not found: ${source.sourcePath}`);
    }
    const raw = readFileSync(source.sourcePath, 'utf8');
    return {
      project: decodeRBProject(raw),
      sourceCopyName: 'project.rbproj',
      sourceNote: `Source project loaded from ${relativeFromRepo(source.sourcePath)}.`,
    };
  }

  return {
    project: getFromScratchBasys3CertProjectById(source.fixtureId),
    sourceCopyName: 'project.rbproj',
    sourceNote: `Source project generated from in-repo fixture ${source.fixtureId}.`,
  };
}

function toBringUpIoRows(project: RBProject): BringUpIoRow[] {
  const ioMapping = project.ioMapping;
  if (!ioMapping) return [];
  return [
    ...ioMapping.inputs.map((entry) => ({
      id: entry.id,
      nodeId: entry.nodeId,
      label: entry.label,
      port: entry.port,
      direction: 'in' as const,
      pin: entry.pin ?? '',
      required: true,
    })),
    ...ioMapping.outputs.map((entry) => ({
      id: entry.id,
      nodeId: entry.nodeId,
      label: entry.label,
      port: entry.port,
      direction: 'out' as const,
      pin: entry.pin ?? '',
      required: true,
    })),
  ];
}

function buildZipBytes(input: {
  bundle: ReturnType<typeof exportBasys3Bundle>;
  manifestText: string;
  project: RBProject;
  bringup: HarnessBringUpArtifacts;
  slug: string;
}): Promise<Uint8Array> {
  return buildVivadoProjectFolderZip({
    artifacts: [
      { path: 'project.rbproj.json', content: input.manifestText },
      { path: 'top.vhd', content: input.bundle.topVhd },
      { path: 'top.xdc', content: input.bundle.topXdc },
      { path: 'README.txt', content: input.bundle.readme },
      { path: 'EXPECTED_IO.json', content: input.bringup.expectedIoJson },
      { path: 'BRINGUP.md', content: input.bringup.bringupMarkdown },
      { path: 'program_and_test.tcl', content: input.bringup.programAndTestTcl },
    ],
    projectName: input.project.name,
    projectSlug: input.slug,
    topModule: input.project.fpga?.top ?? 'top',
    part: resolveVivadoPart(input.project.fpga?.part),
  });
}

function buildHarnessBringUpArtifacts(
  project: RBProject,
  ioRows: BringUpIoRow[],
  expectedBehavior: string
): HarnessBringUpArtifacts {
  return {
    bringupMarkdown: buildHarnessBringUpMarkdown(project, ioRows, expectedBehavior),
    expectedIoJson: buildHarnessExpectedIoJson(project, ioRows),
    programAndTestTcl: buildHarnessProgramAndTestTcl(project),
  };
}

function buildHarnessBringUpMarkdown(
  project: RBProject,
  ioRows: BringUpIoRow[],
  expectedBehavior: string
): string {
  const lines = [
    '# Basys3 Bring-Up',
    `- Project: ${project.name}`,
    '- Board: Basys3 (xc7a35tcpg236-1)',
    `- Top module: ${project.fpga?.top ?? 'top'}`,
    '',
    '## Expected behavior',
    `- ${expectedBehavior}`,
    '',
    '## Pin map',
    ...ioRows.map((row) => `- ${row.label} (${row.direction}) -> ${row.pin || 'UNMAPPED'}`),
    '',
    '## Notes',
    '- Bitstream generation happens in Vivado, not in RedByte.',
    '- Use the bundle XPR with scripts/vivado/redbyte_batch_synth_impl_bitstream.tcl for certification.',
  ];
  return `${lines.join('\n')}\n`;
}

function buildHarnessExpectedIoJson(project: RBProject, ioRows: BringUpIoRow[]): string {
  const outputRows = ioRows.filter((row) => row.direction === 'out');
  const vectors = project.vectors ?? [];
  const signals = outputRows.map((row) => ({
    signal: row.label,
    direction: 'out',
    pin: row.pin,
    values: vectors.map((vector) => ({
      tick: vector.tick,
      expected: readExpectedVectorBit(vector.expected ?? {}, row) ? '1' : '0',
    })),
  }));

  return stableStringify({
    schemaVersion: 'rb.expected-io.v1',
    board: 'basys3',
    source: 'project-vectors',
    generatedAtIso: project.updatedAt ?? project.createdAt,
    vectorsCount: vectors.length,
    signals,
  });
}

function readExpectedVectorBit(
  expected: Record<string, unknown>,
  row: BringUpIoRow
): boolean {
  const candidates = [row.id, row.nodeId, row.label].filter(
    (value): value is string => Boolean(value && value.trim().length > 0)
  );
  return candidates.some((candidate) => expected[candidate] === 1 || expected[candidate] === '1');
}

function buildHarnessProgramAndTestTcl(project: RBProject): string {
  const projectName = sanitizeTclIdentifier(project.name, 'redbyte_project');
  const topEntity = sanitizeTclIdentifier(project.fpga?.top ?? project.hdl?.top ?? 'top', 'top');
  return [
    '# RedByte Basys3 program-and-test scaffold',
    `set project_name "${projectName}"`,
    `set top_module "${topEntity}"`,
    'set project_dir [pwd]',
    'set bitstream_path [file normalize [file join $project_dir "${project_name}.runs" "impl_1" "${top_module}.bit"]]',
    '',
    'open_hw_manager',
    'connect_hw_server',
    'open_hw_target',
    'set device [lindex [get_hw_devices] 0]',
    'current_hw_device $device',
    'refresh_hw_device $device',
    '# set_property PROGRAM.FILE $bitstream_path $device',
    '# program_hw_devices $device',
    'puts "Update bitstream_path if needed, then uncomment PROGRAM.FILE/program commands."',
    '',
  ].join('\n');
}

function expandArchive(zipPath: string, destinationPath: string): void {
  mkdirSync(destinationPath, { recursive: true });
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destinationPath.replace(/'/g, "''")}' -Force`,
    ],
    { stdio: 'inherit' }
  );
}

function runVivadoBatch(xprPath: string, logPath: string, jobs: number): void {
  runVivadoCommand(
    [
      '-mode',
      'batch',
      '-source',
      'scripts/vivado/redbyte_batch_synth_impl_bitstream.tcl',
      '-notrace',
      '-nojournal',
      '-log',
      logPath,
      '-tclargs',
      xprPath,
      String(jobs),
    ],
    'Vivado synth/impl/bitstream'
  );
}

function runVivadoProgram(bitPath: string, logPath: string, hwServer?: string): void {
  const args = [
    '-mode',
    'batch',
    '-source',
    'scripts/vivado/redbyte_program_device.tcl',
    '-notrace',
    '-nojournal',
    '-log',
    logPath,
    '-tclargs',
    bitPath,
  ];
  if (hwServer) {
    args.push(hwServer);
  }
  runVivadoCommand(args, 'Vivado program device');
}

function runVivadoCommand(args: string[], label: string): void {
  const commandLine = `& '${vivadoBat.replace(/'/g, "''")}' ${args.map(quotePowerShellArg).join(' ')}`;
  try {
    execFileSync(
      'powershell.exe',
      ['-NoProfile', '-Command', commandLine],
      {
        cwd: repoRoot,
        stdio: 'inherit',
      }
    );
  } catch (error) {
    const status =
      error && typeof error === 'object' && 'status' in error
        ? Number((error as { status?: number }).status ?? -1)
        : -1;
    throw new Error(`${label} failed with exit code ${status}`);
  }
}

function extractBitstreamPath(batchLogPath: string): string {
  const logText = readFileSync(batchLogPath, 'utf8');
  const match = logText.match(/BITSTREAM\s*=\s*(.+)$/m);
  if (!match?.[1]) {
    throw new Error(`could not extract BITSTREAM path from ${batchLogPath}`);
  }
  return match[1].trim();
}

function relativeFromRepo(absPath: string): string {
  return absPath.replace(`${repoRoot}\\`, '').replace(/\\/g, '/');
}

function renderResult(summary: HarnessSummary): string {
  const lines = [
    `# Custom project Vivado result: ${summary.caseId}`,
    '',
    `- Generated: ${summary.generatedAtIso}`,
    `- Commit: ${summary.commitSha}`,
    `- Project: ${summary.projectName}`,
    `- Source: ${renderSource(summary.projectSource)}`,
    `- Top module: ${summary.topModule}`,
    `- Part: ${summary.part}`,
    '',
    '## Status',
    `- Export: ${summary.statuses.export}`,
    `- Vivado build: ${summary.statuses.vivadoBuild}`,
    `- Board program: ${summary.statuses.boardProgram}`,
    '',
    '## Artifacts',
    `- Bundle ZIP: ${summary.exportPaths.bundleZip}`,
    `- XPR: ${summary.exportPaths.xpr}`,
    `- top.vhd: ${summary.exportPaths.topVhd}`,
    `- top.xdc: ${summary.exportPaths.topXdc}`,
    `- BRINGUP.md: ${summary.exportPaths.bringup}`,
    `- EXPECTED_IO.json: ${summary.exportPaths.expectedIo}`,
    `- Bitstream: ${summary.bitstreamPath ?? 'not found'}`,
    '',
    '## Logs',
    `- Vivado batch: ${summary.logs.vivadoBatch}`,
    `- Vivado synth: ${summary.logs.vivadoSynth}`,
    `- Vivado impl: ${summary.logs.vivadoImpl}`,
    `- Vivado bitstream: ${summary.logs.vivadoBitstream}`,
    ...(summary.logs.vivadoProgram ? [`- Vivado program: ${summary.logs.vivadoProgram}`] : []),
    '',
    '## Notes',
    ...summary.notes.map((note) => `- ${note}`),
    '',
    '## Export warnings',
    ...(summary.exportWarnings.length > 0
      ? summary.exportWarnings.map((warning) => `- ${warning}`)
      : ['- none']),
  ];
  return `${lines.join('\n')}\n`;
}

function renderSource(source: ProjectSource): string {
  return source.kind === 'project-path'
    ? relativeFromRepo(source.sourcePath)
    : `fixture:${source.fixtureId}`;
}

function sanitizeTclIdentifier(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized.length > 0 ? normalized : fallback;
}

function quotePowerShellArg(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

main().catch((error) => {
  console.error(
    '[vivado-cert-custom] FAIL:',
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});
