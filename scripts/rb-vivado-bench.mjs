#!/usr/bin/env node
/**
 * RedByte Vivado/Basys3 bench-intelligence helper.
 *
 * This is intentionally a reporting harness around the existing cert scripts
 * and Tcl flows. It does not claim board behavior from programming logs.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const DEFAULT_RUNS_DIR = path.join(ROOT, '.redbyte', 'agent', 'runs', 'bench');

const TARGETS = [
  {
    id: 'golden-basys3-switch-and',
    label: 'Golden switch AND',
    category: 'Simple combinational',
    source: 'packages/rb-apps/src/fixtures/classroom/golden-basys3-switch-and.rbproj',
    expectedIo: 'SW0 and SW1 drive LD0; LD0 should light only when both switches are high.',
    xpr: 'out/vivado-cert/golden-basys3-switch-and-unpacked/golden-basys3-switch-and/golden-basys3-switch-and.xpr',
    bitstream:
      'out/vivado-cert/golden-basys3-switch-and-unpacked/golden-basys3-switch-and/golden-basys3-switch-and.runs/impl_1/top.bit',
  },
  {
    id: 'signal-tour',
    label: 'Signal Tour',
    category: 'Hardware mapping tour',
    source: 'IDE example: signal-tour',
    expectedIo: 'SW0..SW3 pass through to LD0..LD3.',
    xpr: 'out/vivado-cert/examples/signal-tour/unpacked/signal-tour/signal-tour.xpr',
    bitstream: 'out/vivado-cert/examples/signal-tour/unpacked/signal-tour/signal-tour.runs/impl_1/top.bit',
  },
  {
    id: 'half-adder',
    label: 'Half adder',
    category: 'Adder / multi-output combinational',
    source: 'IDE example: half-adder',
    expectedIo: 'Two switch inputs produce SUM and CARRY LEDs according to half-adder truth table.',
    xpr: 'out/vivado-cert/examples/half-adder/unpacked/half-adder/half-adder.xpr',
    bitstream: 'out/vivado-cert/examples/half-adder/unpacked/half-adder/half-adder.runs/impl_1/top.bit',
  },
  {
    id: 'two-bit-counter',
    label: 'Two-bit counter',
    category: 'Sequential / CLK100MHZ',
    source: 'IDE example: two-bit-counter',
    expectedIo: 'CLK100MHZ/W5 drives count; SW enable and BTNC reset affect LD0/LD1.',
    xpr: 'out/vivado-cert/examples/two-bit-counter/unpacked/two-bit-counter/two-bit-counter.xpr',
    bitstream:
      'out/vivado-cert/examples/two-bit-counter/unpacked/two-bit-counter/two-bit-counter.runs/impl_1/top.bit',
  },
];

function main() {
  const command = process.argv[2] ?? 'summarize';
  const options = parseOptions(process.argv.slice(3));
  const runsDir = path.resolve(ROOT, options.runs ?? DEFAULT_RUNS_DIR);

  if (command === 'doctor') {
    doctor(runsDir);
    return;
  }
  if (command === 'summarize' || command === 'classify' || command === 'evidence-pack') {
    const summaries = TARGETS.map((target) => summarizeTarget(runsDir, target));
    writeReports(runsDir, summaries);
    printMatrix(summaries);
    return;
  }

  console.error(`usage: node scripts/rb-vivado-bench.mjs <doctor|summarize|classify|evidence-pack> [--runs <dir>]`);
  process.exit(1);
}

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--runs') {
      options.runs = args[index + 1];
      index += 1;
    }
  }
  return options;
}

function doctor(runsDir) {
  fs.mkdirSync(runsDir, { recursive: true });
  const vivadoPath = runText('where.exe', ['vivado']);
  const hwServerPath = runText('where.exe', ['hw_server']);
  const djtgcfgPath = runText('where.exe', ['djtgcfg']);
  const vivadoVersion = runText('vivado', ['-version']);

  const report = [
    '# Vivado/Basys3 Environment',
    '',
    `- OS: ${os.type()} ${os.release()} (${os.arch()})`,
    `- Platform: ${os.platform()}`,
    `- XILINX_VIVADO: ${process.env.XILINX_VIVADO || '(not set)'}`,
    `- Vivado path: ${firstNonEmptyLine(vivadoPath.stdout) || '(not found)'}`,
    `- hw_server path: ${firstNonEmptyLine(hwServerPath.stdout) || '(not found)'}`,
    `- djtgcfg path: ${firstNonEmptyLine(djtgcfgPath.stdout) || '(not found)'}`,
    `- Vivado version command exit: ${vivadoVersion.status}`,
    '',
    '## Vivado version excerpt',
    '',
    fenced(excerpt(vivadoVersion.stdout || vivadoVersion.stderr, 12)),
    '',
    '## Known limitations',
    '',
    '- This doctor checks tool visibility only; run `pnpm lab:vivado:hw-probe` for hardware target proof.',
    '- Board behavior still requires manual observation or a separate instrumented readback flow.',
    '',
  ].join('\n');

  const out = path.join(runsDir, 'vivado-basys3-environment.md');
  fs.writeFileSync(out, report, 'utf8');
  console.log(`[rb-vivado-bench] wrote ${relative(out)}`);
}

function runText(command, args) {
  const commandLine = [command, ...args].map(quoteShellArg).join(' ');
  const result = spawnSync(commandLine, { cwd: ROOT, encoding: 'utf8', shell: true });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function quoteShellArg(value) {
  if (/^[A-Za-z0-9_.:\\/-]+$/.test(value)) return value;
  return `"${value.replaceAll('"', '\\"')}"`;
}

function summarizeTarget(runsDir, target) {
  const targetDir = path.join(runsDir, target.id);
  const buildLogPath = path.join(targetDir, 'vivado_batch.log');
  const programLogPath = path.join(targetDir, 'vivado_program.log');
  const buildLog = readMaybe(buildLogPath);
  const programLog = readMaybe(programLogPath);
  const warnings = collectWarnings(buildLog);
  const criticalWarnings = collectCriticalWarnings(buildLog);
  const errors = collectErrors(buildLog);
  const bitstreamFromLog = extractMatch(buildLog, /RedByte batch: BITSTREAM = (.+)/);
  const buildSuccess = /RedByte batch: SUCCESS/.test(buildLog);
  const synthSuccess = /synth_1 STATUS = synth_design Complete!/.test(buildLog);
  const implSuccess = /impl_1 STATUS = write_bitstream Complete!/.test(buildLog);
  const programSuccess = /RedByte program: SUCCESS/.test(programLog);

  return {
    ...target,
    targetDir,
    buildLogPath,
    programLogPath,
    exportStatus: fs.existsSync(path.join(ROOT, target.xpr)) ? 'yes' : 'missing',
    synthesis: synthSuccess ? 'success' : buildLog ? 'fail/unknown' : 'not run',
    implementation: implSuccess ? 'success' : buildLog ? 'fail/unknown' : 'not run',
    bitstream: buildSuccess || bitstreamFromLog ? 'success' : buildLog ? 'fail/unknown' : 'not run',
    program: programSuccess ? 'success' : programLog ? 'fail/unknown' : 'not run',
    boardObserved: 'manual required',
    bitstreamPath: bitstreamFromLog || target.bitstream,
    warnings,
    criticalWarnings,
    errors,
    redbyteGap: classifyGap(target, warnings),
  };
}

function writeReports(runsDir, summaries) {
  fs.mkdirSync(runsDir, { recursive: true });
  fs.writeFileSync(path.join(runsDir, 'vivado-basys3-matrix.md'), renderMatrix(summaries), 'utf8');
  fs.writeFileSync(path.join(runsDir, 'vivado-warning-taxonomy.md'), renderWarningTaxonomy(summaries), 'utf8');
  fs.writeFileSync(path.join(runsDir, 'bench-summary.json'), `${JSON.stringify(summaries, null, 2)}\n`, 'utf8');

  for (const summary of summaries) {
    fs.mkdirSync(summary.targetDir, { recursive: true });
    fs.writeFileSync(path.join(summary.targetDir, 'board-observation.md'), renderBoardObservation(summary), 'utf8');
  }
}

function renderMatrix(summaries) {
  const lines = [
    '# Vivado/Basys3 Bench Matrix',
    '',
    '| Target | Export | Synthesis | Implementation | Bitstream | Program | Board Observed | Warnings | RedByte Gap |',
    '|---|---|---|---|---|---|---|---|---|',
  ];

  for (const s of summaries) {
    lines.push(
      `| ${s.id} | ${s.exportStatus} | ${s.synthesis} | ${s.implementation} | ${s.bitstream} | ${s.program} | ${s.boardObserved} | ${summarizeWarningCell(s)} | ${s.redbyteGap} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

function renderWarningTaxonomy(summaries) {
  const warningSet = new Map();
  for (const s of summaries) {
    for (const warning of s.warnings) {
      const key = normalizeWarning(warning);
      if (!warningSet.has(key)) warningSet.set(key, { warning, targets: [] });
      warningSet.get(key).targets.push(s.id);
    }
  }

  const grouped = new Map();
  for (const item of warningSet.values()) {
    const category = classifyWarning(item.warning);
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push(item);
  }

  const lines = [
    '# Vivado Warning Taxonomy',
    '',
    'Generated from current bench logs. These are classifications for product learning, not reasons to hide warnings.',
    '',
  ];

  for (const [category, items] of grouped) {
    lines.push(`## ${category}`);
    lines.push('');
    lines.push(`- RedByte currently detects before export: ${currentDetectionFor(category)}`);
    lines.push(`- Recommended product handling: ${recommendedHandlingFor(category)}`);
    for (const item of items) {
      lines.push(`- Example log line: \`${item.warning.replaceAll('`', "'")}\``);
      lines.push(`  Seen in: ${[...new Set(item.targets)].join(', ')}`);
    }
    lines.push('');
  }

  if (warningSet.size === 0) {
    lines.push('- No warnings found in parsed logs.');
    lines.push('');
  }

  return lines.join('\n');
}

function renderBoardObservation(summary) {
  return [
    `# Board Observation: ${summary.id}`,
    '',
    `- Source: ${summary.source}`,
    `- Expected IO: ${summary.expectedIo}`,
    `- Bitstream: ${summary.bitstreamPath}`,
    `- Programming method: Vivado batch Tcl, scripts/vivado/redbyte_program_device.tcl`,
    `- Program result: ${summary.program}`,
    '- Board observed: manual required',
    '',
    '## Manual observation checklist',
    '',
    '- Toggle the listed switches/buttons for this target.',
    '- Record which LEDs or seven-segment outputs changed.',
    '- Compare the observation to the expected IO line above.',
    '- Mark pass/fail/uncertain with date, operator, and evidence type.',
    '',
    '## Observation result',
    '',
    '- Date:',
    '- Operator:',
    '- Switches/buttons toggled:',
    '- Observed LEDs/outputs:',
    '- Expected behavior matched: pass / fail / uncertain',
    '- Evidence type: manual observation / photo / video / automated readback',
    '- Notes:',
    '',
  ].join('\n');
}

function printMatrix(summaries) {
  console.log(renderMatrix(summaries));
}

function collectWarnings(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => /\bWARNING:/.test(line) || /260 characters|path with more than 80 characters/.test(line))
    .map((line) => line.trim())
    .filter(Boolean);
}

function collectCriticalWarnings(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => /Critical Warnings/i.test(line) && !/0 Critical Warnings/.test(line))
    .map((line) => line.trim());
}

function collectErrors(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => /\bERROR:/.test(line))
    .map((line) => line.trim());
}

function classifyGap(target, warnings) {
  if (target.id === 'signal-tour' && warnings.some((w) => /empty top module/.test(w))) {
    return 'Explain optimized pass-through/empty-top warning after Vivado';
  }
  if (warnings.some((w) => /no user specified timing constraints|No user defined clocks/.test(w))) {
    return 'Classify combinational no-clock timing/power warnings';
  }
  if (target.id === 'two-bit-counter') {
    return 'Board observation checklist needed for fast clock/LED semantics';
  }
  return 'Capture warnings and observation separately from build success';
}

function classifyWarning(warning) {
  if (/path with more than 80 characters|260 characters/.test(warning)) return 'A. Environment/setup';
  if (/GeneratedRun file|Auto Incremental Compile|incremental/.test(warning)) return 'B. Export/project generation';
  if (/timing constraints|No user defined clocks|Power estimation|Timing had been disabled/.test(warning)) return 'E. Implementation/timing';
  if (/CLOCK_BUFFER_TYPE|constraint/.test(warning)) return 'C. XDC/pin mapping';
  if (/empty top module|Parallel synthesis/.test(warning)) return 'D. HDL/synthesis';
  return 'General Vivado warning';
}

function currentDetectionFor(category) {
  if (category === 'A. Environment/setup') return 'partial: tool paths are manually checked; path-length risk is not preflighted';
  if (category === 'B. Export/project generation') return 'partial: project files exist, but first-run Vivado run-state warnings are post-build only';
  if (category === 'C. XDC/pin mapping') return 'yes for mapping validity; post-synthesis constraint-use warnings are not explained';
  if (category === 'D. HDL/synthesis') return 'partial: export succeeds, but optimized-empty warnings are not product-explained';
  if (category === 'E. Implementation/timing') return 'partial: clocked paths emit create_clock; combinational no-clock warnings are post-build only';
  return 'unknown';
}

function recommendedHandlingFor(category) {
  if (category === 'A. Environment/setup') return 'add doctor guidance for path length, Vivado path, hw_server, and Digilent cable detection';
  if (category === 'B. Export/project generation') return 'collect and label benign first-run Vivado project warnings separately from export errors';
  if (category === 'C. XDC/pin mapping') return 'surface XDC constraint policy in handoff report and keep pin/port preflight strict';
  if (category === 'D. HDL/synthesis') return 'explain optimized pass-through/empty-top warnings when bitstream still succeeds';
  if (category === 'E. Implementation/timing') return 'distinguish harmless combinational no-clock reports from missing sequential clock constraints';
  return 'classify before presenting to users';
}

function summarizeWarningCell(summary) {
  const count = summary.warnings.length;
  if (count === 0) return 'none';
  const emptyTop = summary.warnings.some((w) => /empty top module/.test(w));
  const timing = summary.warnings.some((w) => /timing constraints|No user defined clocks/.test(w));
  const pathLength = summary.warnings.some((w) => /260 characters|more than 80 characters/.test(w));
  const labels = [];
  if (pathLength) labels.push('path length');
  if (emptyTop) labels.push('empty top');
  if (timing) labels.push('no clock/timing');
  return `${count} (${labels.join(', ') || 'see taxonomy'})`;
}

function normalizeWarning(warning) {
  return warning.replace(/C:\/Users\/Administrator\/redbyte-ui-genesis\/[^ ]+/g, '<path>');
}

function readMaybe(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function extractMatch(text, regex) {
  const match = text.match(regex);
  return match?.[1]?.trim() ?? '';
}

function firstNonEmptyLine(text) {
  return text.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? '';
}

function excerpt(text, maxLines) {
  return text.split(/\r?\n/).filter(Boolean).slice(0, maxLines).join('\n');
}

function fenced(text) {
  return ['```text', text.trim(), '```'].join('\n');
}

function relative(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

main();
