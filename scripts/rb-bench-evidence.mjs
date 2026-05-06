#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const DEFAULT_RUNS_ROOT = path.join(ROOT, '.redbyte', 'bench', 'runs');

const TARGET_PROFILES = {
  'golden-basys3-switch-and': {
    expectedControls: 'SW0, SW1',
    expectedOutputs: 'LD0 lights only when SW0=1 and SW1=1',
    observationSteps: [
      'Set SW0/SW1 to 00 and confirm LD0 is off.',
      'Set SW0/SW1 to 10 and confirm LD0 is off.',
      'Set SW0/SW1 to 01 and confirm LD0 is off.',
      'Set SW0/SW1 to 11 and confirm LD0 is on.',
    ],
  },
  'two-bit-counter': {
    expectedControls: 'SW0 (enable), BTNC (reset), CLK100MHZ board clock',
    expectedOutputs: 'LD1:LD0 advances while enabled; BTNC forces 00',
    observationSteps: [
      'Set SW0=0 and confirm LD1:LD0 does not advance.',
      'Set SW0=1 and watch LD1:LD0 change (100MHz may blur/flicker).',
      'Press BTNC and confirm LD1:LD0 returns to 00.',
      'Release BTNC and confirm counting behavior resumes when SW0=1.',
    ],
  },
  'signal-tour': {
    expectedControls: 'SW0, SW1, SW2, SW3',
    expectedOutputs: 'LD0..LD3 mirror SW0..SW3 one-to-one',
    observationSteps: [
      'Toggle SW0 and confirm LD0 follows.',
      'Toggle SW1 and confirm LD1 follows.',
      'Toggle SW2 and confirm LD2 follows.',
      'Toggle SW3 and confirm LD3 follows.',
    ],
  },
};

function main() {
  const [command = 'classify', ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (command === 'classify') {
    const runDir = resolveRunDir(args);
    const result = classifyRun(runDir);
    writeClassificationOutputs(runDir, result);
    printClassificationSummary(result);
    return;
  }

  if (command === 'observe') {
    const runDir = resolveRunDir(args);
    const targetId = args.target ?? args._[0];
    if (!targetId) {
      fail('Missing target id. Usage: node scripts/rb-bench-evidence.mjs observe --run <run-id> -- <target-id>');
    }
    const out = writeObservationTemplate(runDir, targetId);
    console.log(`[rb-bench-evidence] wrote ${relative(out)}`);
    return;
  }

  if (command === 'test') {
    runSelfTests();
    return;
  }

  fail('Usage: node scripts/rb-bench-evidence.mjs <classify|observe|test> [--run <run-id-or-path>] [--runs-root <path>] [--target <id>]');
}

function parseArgs(argv) {
  const parsed = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--') {
      parsed._.push(...argv.slice(i + 1));
      break;
    }
    if (token === '--run') {
      parsed.run = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--runs-root') {
      parsed.runsRoot = argv[i + 1];
      i += 1;
      continue;
    }
    if (token === '--target') {
      parsed.target = argv[i + 1];
      i += 1;
      continue;
    }
    parsed._.push(token);
  }
  return parsed;
}

function resolveRunDir(args) {
  const runsRoot = path.resolve(ROOT, args.runsRoot ?? DEFAULT_RUNS_ROOT);
  if (!fs.existsSync(runsRoot)) {
    fail(`Bench runs root not found: ${runsRoot}`);
  }

  if (args.run) {
    const candidate = path.isAbsolute(args.run)
      ? args.run
      : path.join(runsRoot, args.run);
    if (!fs.existsSync(candidate)) {
      fail(`Bench run folder not found: ${candidate}`);
    }
    return candidate;
  }

  const entries = fs
    .readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (entries.length === 0) {
    fail(`No bench runs found under ${runsRoot}`);
  }

  return path.join(runsRoot, entries[entries.length - 1]);
}

export function classifyRun(runDir) {
  if (!fs.existsSync(runDir)) {
    throw new Error(`Bench run folder not found: ${runDir}`);
  }

  const targetIds = fs
    .readdirSync(runDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => hasTargetEvidence(path.join(runDir, name)))
    .sort();

  if (targetIds.length === 0) {
    throw new Error(`No target evidence folders found in ${runDir}`);
  }

  const targets = targetIds.map((targetId) => classifyTarget(runDir, targetId));
  return {
    generated_at: new Date().toISOString(),
    run_folder: relative(runDir),
    targets,
  };
}

function hasTargetEvidence(targetDir) {
  const files = [
    'vivado_batch.log',
    'vivado_program.log',
    'board-observation.md',
    'artifact-top.vhd',
    'artifact-project.rbproj.json',
  ];
  return files.some((file) => fs.existsSync(path.join(targetDir, file)));
}

export function classifyTarget(runDir, targetId) {
  const targetDir = path.join(runDir, targetId);
  const buildLog = readMaybe(path.join(targetDir, 'vivado_batch.log'));
  const programLog = readMaybe(path.join(targetDir, 'vivado_program.log'));
  const observationPath = path.join(targetDir, 'board-observation.md');
  const observation = parseObservation(readMaybe(observationPath));

  const exportStatus = detectExportStatus(targetDir);
  const synthesisStatus = detectSynthesisStatus(buildLog);
  const implementationStatus = detectImplementationStatus(buildLog);
  const bitstreamStatus = detectBitstreamStatus(buildLog, targetDir);
  const vivadoBuildStatus = classifyVivadoBuildStatus(synthesisStatus, implementationStatus, bitstreamStatus, buildLog);
  const programStatus = detectProgramStatus(programLog);
  const observedBehaviorStatus = detectObservedBehaviorStatus(observation);

  const warnings = collectWarnings(`${buildLog}\n${programLog}`);
  const warningClasses = unique(
    warnings.map(classifyWarningLine).filter(Boolean),
  );

  const blockers = [];
  if (exportStatus !== 'pass') blockers.push('Export package missing (E0 not satisfied).');
  if (vivadoBuildStatus === 'fail') blockers.push('Vivado build did not complete (E1 blocked).');
  if (programStatus === 'fail') blockers.push('Programming failed (E2 blocked).');
  if (programStatus !== 'pass') blockers.push('Programming not yet proven for this row.');
  if (observedBehaviorStatus === 'manual_required' || observedBehaviorStatus === 'observation_uncertain') {
    blockers.push('Observed board behavior is not closed (E3 blocked).');
  }

  const evidenceLevel = determineEvidenceLevel({
    exportStatus,
    vivadoBuildStatus,
    programStatus,
    observedBehaviorStatus,
    canPromote: observation.can_promote_to_e3 || observation.can_promote_to_E3,
  });

  const redbyteGap = classifyRedbyteGap({ warnings, observedBehaviorStatus, targetId });
  const recommendedNextAction = recommendNextAction({
    evidenceLevel,
    observedBehaviorStatus,
    programStatus,
    vivadoBuildStatus,
    exportStatus,
    targetId,
  });

  return {
    target_id: targetId,
    export_status: exportStatus,
    vivado_build_status: vivadoBuildStatus,
    synthesis_status: synthesisStatus,
    implementation_status: implementationStatus,
    bitstream_status: bitstreamStatus,
    program_status: programStatus,
    observed_behavior_status: observedBehaviorStatus,
    evidence_level: evidenceLevel,
    warnings,
    warning_classes: warningClasses,
    blockers,
    redbyte_gap: redbyteGap,
    recommended_next_action: recommendedNextAction,
  };
}

function detectExportStatus(targetDir) {
  const exportMarkers = [
    'artifact-top.vhd',
    'artifact-project.rbproj.json',
    'artifact-vivado_import.tcl',
    'artifact-README.txt',
    'artifact-golden-basys3-switch-and.xpr',
  ];
  const hasAnyMarker = exportMarkers.some((file) => fs.existsSync(path.join(targetDir, file)));
  if (hasAnyMarker) return 'pass';

  const generatedFiles = readMaybe(path.join(targetDir, 'generated-files.txt'));
  return /top\.vhd|project\.rbproj\.json|vivado_import\.tcl/i.test(generatedFiles) ? 'pass' : 'missing';
}

function detectSynthesisStatus(buildLog) {
  if (!buildLog.trim()) return 'not_run';
  if (/synth_1 STATUS = synth_design Complete!/i.test(buildLog)) return 'pass';
  if (/ERROR:/i.test(buildLog)) return 'fail';
  return 'unknown';
}

function detectImplementationStatus(buildLog) {
  if (!buildLog.trim()) return 'not_run';
  if (/impl_1 STATUS = write_bitstream Complete!/i.test(buildLog)) return 'pass';
  if (/ERROR:/i.test(buildLog)) return 'fail';
  return 'unknown';
}

function detectBitstreamStatus(buildLog, targetDir) {
  if (!buildLog.trim()) {
    return fs.existsSync(path.join(targetDir, 'top.bit')) ? 'generated' : 'not_run';
  }
  if (/RedByte batch: BITSTREAM = /i.test(buildLog) || /write_bitstream Complete!/i.test(buildLog)) return 'generated';
  if (/ERROR:/i.test(buildLog)) return 'missing';
  return 'missing';
}

function classifyVivadoBuildStatus(synthesisStatus, implementationStatus, bitstreamStatus, buildLog) {
  if (synthesisStatus === 'pass' && implementationStatus === 'pass' && bitstreamStatus === 'generated') {
    const hasWarnings = collectWarnings(buildLog).length > 0;
    return hasWarnings ? 'pass_with_warnings' : 'pass';
  }
  if (synthesisStatus === 'not_run' && implementationStatus === 'not_run') return 'not_run';
  if (synthesisStatus === 'fail' || implementationStatus === 'fail') return 'fail';
  return 'unknown';
}

function detectProgramStatus(programLog) {
  if (!programLog.trim()) return 'not_run';
  if (/RedByte program: SUCCESS|program_hw_devices/i.test(programLog) && !/ERROR:/i.test(programLog)) return 'pass';
  if (/ERROR:|No hardware targets|No matching hardware devices/i.test(programLog)) return 'fail';
  return 'unknown';
}

function detectObservedBehaviorStatus(observation) {
  const result = (observation.pass_fail_uncertain || '').toLowerCase();
  if (result === 'pass') return 'pass';
  if (result === 'fail') return 'fail';
  if (result === 'uncertain') return 'observation_uncertain';
  return 'manual_required';
}

export function determineEvidenceLevel({ exportStatus, vivadoBuildStatus, programStatus, observedBehaviorStatus, canPromote }) {
  if (exportStatus !== 'pass') return 'E0';
  if (!(vivadoBuildStatus === 'pass' || vivadoBuildStatus === 'pass_with_warnings')) return 'E0';
  if (programStatus !== 'pass') return 'E1';
  if (observedBehaviorStatus === 'pass' && /^yes$/i.test(canPromote || '')) return 'E3';
  return 'E2';
}

export function classifyWarningLine(line) {
  const text = line.toLowerCase();
  if (!text) return '';
  if (/error:/.test(text)) return 'build blocker';
  if (/no hardware targets|no matching hardware devices|connect_hw_server|program_hw_devices/.test(text)) {
    return 'programming blocker';
  }
  if (/no user specified timing constraints|no user defined clocks|power estimation is based on no user defined clocks|timing 38-313|power 33-232/.test(text)) {
    return 'expected/no-clock/combinational';
  }
  if (/path with more than 80 characters|path has more than 80 characters|260 characters/.test(text)) {
    return 'needs RedByte preflight';
  }
  if (/empty top module|synth 8-3330/.test(text)) return 'needs RedByte explanation';
  if (/generatedrun|auto incremental compile|place 46-29|parallel synthesis|synth 8-7080/.test(text)) {
    return 'confusing but nonblocking';
  }
  return 'acceptable';
}

function classifyRedbyteGap({ warnings, observedBehaviorStatus, targetId }) {
  if (observedBehaviorStatus === 'manual_required' || observedBehaviorStatus === 'observation_uncertain') {
    return 'Target requires E3 observation workflow completion.';
  }
  if (warnings.some((line) => /empty top module|synth 8-3330/i.test(line))) {
    return 'Need handoff explanation for optimized-empty-top Vivado warning.';
  }
  if (targetId === 'two-bit-counter') {
    return 'Sequential row needs explicit fast-clock observation guidance.';
  }
  return 'Maintain separated E1/E2/E3 evidence without collapsing statuses.';
}

function recommendNextAction({ evidenceLevel, observedBehaviorStatus, programStatus, vivadoBuildStatus, exportStatus, targetId }) {
  if (exportStatus !== 'pass') return 'Regenerate export artifacts and rerun classifier.';
  if (!(vivadoBuildStatus === 'pass' || vivadoBuildStatus === 'pass_with_warnings')) {
    return 'Fix Vivado build blockers and rerun classify.';
  }
  if (programStatus !== 'pass') return 'Program the board successfully (E2) then rerun classify.';
  if (observedBehaviorStatus === 'manual_required') {
    return `Run pnpm rb:bench:evidence:observe -- --run <run-id> ${targetId} and capture physical observation details.`;
  }
  if (observedBehaviorStatus === 'observation_uncertain') {
    return 'Repeat board observation with clearer steps/evidence; keep row at E2 until pass is confirmed.';
  }
  if (observedBehaviorStatus === 'pass') {
    return 'Observation is recorded; verify can_promote_to_E3 is yes and rerun classify.';
  }
  return 'Review blockers and rerun classify after evidence updates.';
}

function collectWarnings(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /WARNING:|no user specified timing constraints|No user defined clocks|path with more than 80 characters|260 characters|Synth\s+8-|Timing\s+38-|Power\s+33-|Place\s+46-/i.test(line));
}

function parseObservation(markdown) {
  const parsed = {
    pass_fail_uncertain: '',
    evidence_type: '',
    can_promote_to_e3: 'no',
  };

  if (!markdown.trim()) return parsed;

  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\s*-\s*([^:]+):\s*(.*)$/);
    if (!match) continue;
    const key = normalizeObservationKey(match[1]);
    parsed[key] = match[2].trim();
  }
  return parsed;
}

function normalizeObservationKey(key) {
  return key
    .trim()
    .toLowerCase()
    .replace(/\//g, '_')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function renderObservationTemplate({ targetId, bitstreamPath, boardTarget, programmed, existing }) {
  const profile = TARGET_PROFILES[targetId] ?? {
    expectedControls: 'Manual target-specific controls',
    expectedOutputs: 'Manual expected outputs',
    observationSteps: ['Describe the control/output checks for this target.'],
  };

  const base = {
    target: targetId,
    bitstream_path: bitstreamPath || '(unknown)',
    board_target: boardTarget || 'localhost:3121/xilinx_tcf/Digilent/210183BF7C42A',
    programmed_yes_no: programmed ? 'yes' : 'no',
    expected_controls: profile.expectedControls,
    expected_outputs: profile.expectedOutputs,
    observation_steps: profile.observationSteps.join(' | '),
    controls_toggled: existing.controls_toggled || '',
    observed_outputs: existing.observed_outputs || '',
    pass_fail_uncertain: existing.pass_fail_uncertain || 'uncertain',
    evidence_type: existing.evidence_type || 'manual',
    observer: existing.observer || '',
    timestamp: existing.timestamp || '',
    notes: existing.notes || '',
    can_promote_to_E3: existing.can_promote_to_E3 || 'no',
  };

  const stepLines = profile.observationSteps.map((step) => `  - ${step}`).join('\n');

  return [
    `# Board observation - ${targetId}`,
    '',
    `- target: ${base.target}`,
    `- bitstream path: ${base.bitstream_path}`,
    `- board target: ${base.board_target}`,
    `- programmed yes/no: ${base.programmed_yes_no}`,
    `- expected controls: ${base.expected_controls}`,
    `- expected outputs: ${base.expected_outputs}`,
    '- observation steps:',
    stepLines,
    `- controls toggled: ${base.controls_toggled}`,
    `- observed outputs: ${base.observed_outputs}`,
    `- pass/fail/uncertain: ${base.pass_fail_uncertain}`,
    `- evidence type: ${base.evidence_type}`,
    `- observer: ${base.observer}`,
    `- timestamp: ${base.timestamp}`,
    `- notes: ${base.notes}`,
    `- can_promote_to_E3: ${base.can_promote_to_E3}`,
    '',
    'Important distinction: programming success is E2 evidence only. Do not set can_promote_to_E3 to yes unless physical behavior was observed and matched expectation.',
    '',
  ].join('\n');
}

function writeObservationTemplate(runDir, targetId) {
  if (!isPathUnder(DEFAULT_RUNS_ROOT, runDir)) {
    fail(`Refusing to write observation outside .redbyte/bench/runs: ${runDir}`);
  }
  const targetDir = path.join(runDir, targetId);
  if (!fs.existsSync(targetDir)) {
    fail(`Target folder not found in run: ${targetId}`);
  }

  const programLog = readMaybe(path.join(targetDir, 'vivado_program.log'));
  const existing = parseObservation(readMaybe(path.join(targetDir, 'board-observation.md')));
  const bitstreamPath = extractMatch(readMaybe(path.join(targetDir, 'vivado_batch.log')), /RedByte batch: BITSTREAM = (.+)/i);
  const boardTarget = extractMatch(programLog, /TARGET\s*=\s*(.+)/i);
  const programmed = /RedByte program: SUCCESS|program_hw_devices/i.test(programLog) && !/ERROR:/i.test(programLog);
  const markdown = renderObservationTemplate({
    targetId,
    bitstreamPath,
    boardTarget,
    programmed,
    existing,
  });

  const out = path.join(targetDir, 'board-observation.md');
  fs.writeFileSync(out, markdown, 'utf8');
  return out;
}

function writeClassificationOutputs(runDir, result) {
  if (!isPathUnder(DEFAULT_RUNS_ROOT, runDir)) {
    fail(`Refusing to write classification outside .redbyte/bench/runs: ${runDir}`);
  }
  const jsonPath = path.join(runDir, 'evidence-classification.json');
  const mdPath = path.join(runDir, 'evidence-classification.md');

  fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdPath, renderClassificationMarkdown(result), 'utf8');

  console.log(`[rb-bench-evidence] wrote ${relative(mdPath)}`);
  console.log(`[rb-bench-evidence] wrote ${relative(jsonPath)}`);
}

function renderClassificationMarkdown(result) {
  const lines = [
    '# RedByte Bench Evidence Classification',
    '',
    `Generated: ${result.generated_at}`,
    `Run folder: ${result.run_folder}`,
    '',
    '| Target | Export | Build | Synthesis | Implementation | Bitstream | Program | Observed behavior | Evidence | Warning classes |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];

  for (const target of result.targets) {
    lines.push(
      `| ${target.target_id} | ${target.export_status} | ${target.vivado_build_status} | ${target.synthesis_status} | ${target.implementation_status} | ${target.bitstream_status} | ${target.program_status} | ${target.observed_behavior_status} | ${target.evidence_level} | ${target.warning_classes.join(', ') || 'none'} |`,
    );
  }

  lines.push('');
  lines.push('## Per-target notes');
  lines.push('');

  for (const target of result.targets) {
    lines.push(`### ${target.target_id}`);
    lines.push('');
    lines.push(`- redbyte_gap: ${target.redbyte_gap}`);
    lines.push(`- recommended_next_action: ${target.recommended_next_action}`);
    if (target.blockers.length > 0) {
      lines.push('- blockers:');
      for (const blocker of target.blockers) {
        lines.push(`  - ${blocker}`);
      }
    }
    if (target.warnings.length > 0) {
      lines.push('- warnings:');
      for (const warning of target.warnings.slice(0, 8)) {
        lines.push(`  - ${warning}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function printClassificationSummary(result) {
  const counts = { E0: 0, E1: 0, E2: 0, E3: 0 };
  for (const target of result.targets) {
    counts[target.evidence_level] = (counts[target.evidence_level] ?? 0) + 1;
  }

  console.log(`[rb-bench-evidence] classified ${result.targets.length} target(s): E0=${counts.E0}, E1=${counts.E1}, E2=${counts.E2}, E3=${counts.E3}`);
}

function runSelfTests() {
  const checks = [
    ['bitstream but not programmed => E1', () => {
      const level = determineEvidenceLevel({
        exportStatus: 'pass',
        vivadoBuildStatus: 'pass',
        programStatus: 'not_run',
        observedBehaviorStatus: 'manual_required',
        canPromote: 'no',
      });
      assertEqual(level, 'E1');
    }],
    ['programmed and unobserved => E2', () => {
      const level = determineEvidenceLevel({
        exportStatus: 'pass',
        vivadoBuildStatus: 'pass_with_warnings',
        programStatus: 'pass',
        observedBehaviorStatus: 'manual_required',
        canPromote: 'no',
      });
      assertEqual(level, 'E2');
    }],
    ['observed pass can promote => E3', () => {
      const level = determineEvidenceLevel({
        exportStatus: 'pass',
        vivadoBuildStatus: 'pass',
        programStatus: 'pass',
        observedBehaviorStatus: 'pass',
        canPromote: 'yes',
      });
      assertEqual(level, 'E3');
    }],
    ['observed uncertain never promotes => E2', () => {
      const level = determineEvidenceLevel({
        exportStatus: 'pass',
        vivadoBuildStatus: 'pass',
        programStatus: 'pass',
        observedBehaviorStatus: 'observation_uncertain',
        canPromote: 'yes',
      });
      assertEqual(level, 'E2');
    }],
    ['warning classes include expected buckets', () => {
      assertEqual(classifyWarningLine('WARNING: [Timing 38-313] There are no user specified timing constraints.'), 'expected/no-clock/combinational');
      assertEqual(classifyWarningLine('WARNING: [Synth 8-3330] design top has an empty top module'), 'needs RedByte explanation');
      assertEqual(classifyWarningLine('WARNING: The project path has more than 80 characters'), 'needs RedByte preflight');
    }],
  ];

  for (const [name, fn] of checks) {
    fn();
    console.log(`[rb-bench-evidence:test] [ok] ${name}`);
  }
}

function assertEqual(actual, expected) {
  if (actual !== expected) {
    throw new Error(`assertEqual failed. expected=${expected}, actual=${actual}`);
  }
}

function unique(items) {
  return [...new Set(items)];
}

function readMaybe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function extractMatch(text, regex) {
  const match = text.match(regex);
  return match?.[1]?.trim() ?? '';
}

function fail(message) {
  console.error(`[rb-bench-evidence] [error] ${message}`);
  process.exit(1);
}

export function isPathUnder(root, candidate) {
  const relativePath = path.relative(path.resolve(root), path.resolve(candidate));
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
