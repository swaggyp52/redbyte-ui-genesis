#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

import {
  classifyRun,
  classifyTarget,
  classifyWarningLine,
  determineEvidenceLevel,
  isPathUnder,
} from './rb-bench-evidence.mjs';

function test(name, fn) {
  try {
    fn();
    process.stdout.write(`[ok] ${name}\n`);
  } catch (error) {
    process.stderr.write(`[fail] ${name}\n`);
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  }
}

function makeRunRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-bench-evidence-'));
  const run = path.join(root, '20260505-222402');
  fs.mkdirSync(run, { recursive: true });
  return { root, run };
}

function writeTarget(run, id, { buildLog, programLog, observation }) {
  const dir = path.join(run, id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'artifact-top.vhd'), '-- vhdl', 'utf8');
  if (buildLog) fs.writeFileSync(path.join(dir, 'vivado_batch.log'), buildLog, 'utf8');
  if (programLog) fs.writeFileSync(path.join(dir, 'vivado_program.log'), programLog, 'utf8');
  if (observation) fs.writeFileSync(path.join(dir, 'board-observation.md'), observation, 'utf8');
  return dir;
}

test('generated + built + programmed + not observed => E2', () => {
  const { root, run } = makeRunRoot();
  writeTarget(run, 'golden-basys3-switch-and', {
    buildLog: 'synth_1 STATUS = synth_design Complete!\nimpl_1 STATUS = write_bitstream Complete!\nRedByte batch: BITSTREAM = C:/tmp/top.bit\n',
    programLog: 'RedByte program: SUCCESS\n',
    observation: '- pass/fail/uncertain: uncertain\n- can_promote_to_E3: no\n',
  });
  const result = classifyRun(run);
  assert.equal(result.targets[0].evidence_level, 'E2');
  fs.rmSync(root, { recursive: true, force: true });
});

test('generated + built + not programmed => E1', () => {
  const { root, run } = makeRunRoot();
  writeTarget(run, 'golden-basys3-switch-and', {
    buildLog: 'synth_1 STATUS = synth_design Complete!\nimpl_1 STATUS = write_bitstream Complete!\nRedByte batch: BITSTREAM = C:/tmp/top.bit\n',
    programLog: '',
    observation: '- pass/fail/uncertain: uncertain\n- can_promote_to_E3: no\n',
  });
  const result = classifyRun(run);
  assert.equal(result.targets[0].evidence_level, 'E1');
  fs.rmSync(root, { recursive: true, force: true });
});

test('observed pass promotes to E3', () => {
  const { root, run } = makeRunRoot();
  writeTarget(run, 'signal-tour', {
    buildLog: 'synth_1 STATUS = synth_design Complete!\nimpl_1 STATUS = write_bitstream Complete!\nRedByte batch: BITSTREAM = C:/tmp/top.bit\n',
    programLog: 'RedByte program: SUCCESS\n',
    observation: '- pass/fail/uncertain: pass\n- can_promote_to_E3: yes\n',
  });
  const target = classifyTarget(run, 'signal-tour');
  assert.equal(target.evidence_level, 'E3');
  fs.rmSync(root, { recursive: true, force: true });
});

test('observed uncertain never reaches E3', () => {
  const level = determineEvidenceLevel({
    exportStatus: 'pass',
    vivadoBuildStatus: 'pass',
    programStatus: 'pass',
    observedBehaviorStatus: 'observation_uncertain',
    canPromote: 'yes',
  });
  assert.equal(level, 'E2');
});

test('warning classifier maps expected buckets', () => {
  assert.equal(classifyWarningLine('WARNING: [Timing 38-313] There are no user specified timing constraints.'), 'expected/no-clock/combinational');
  assert.equal(classifyWarningLine('WARNING: [Synth 8-3330] design top has an empty top module'), 'needs RedByte explanation');
  assert.equal(classifyWarningLine('WARNING: [Synth 8-7080] Parallel synthesis criteria is not met'), 'confusing but nonblocking');
  assert.equal(classifyWarningLine('WARNING: project path has more than 80 characters'), 'needs RedByte preflight');
});

test('missing run folder fails clearly', () => {
  assert.throws(() => classifyRun('C:/does/not/exist/run-folder'), /Bench run folder not found/);
});

test('output paths stay under .redbyte/bench/runs', () => {
  const runsRoot = path.join(process.cwd(), '.redbyte', 'bench', 'runs');
  const good = path.join(runsRoot, '20260505-222402');
  const bad = path.join(process.cwd(), 'out', 'vivado-cert');
  assert.equal(isPathUnder(runsRoot, good), true);
  assert.equal(isPathUnder(runsRoot, bad), false);
});
