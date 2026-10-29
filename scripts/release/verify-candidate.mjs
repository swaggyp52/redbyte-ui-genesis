// Run the maintained browser journeys against the unpacked, source-matched build.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { sourceState } from '../source-state.mjs';
const base = process.env.RB_BASE_URL ?? 'http://127.0.0.1:5188/os/';
const url = new URL(base);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw Error('Candidate validation requires a local server');
const health = await (await fetch(new URL('/__redbyte_health', base))).json();
const state = sourceState();
if (health.sourceDigest !== state.sourceDigest) throw Error('Running candidate does not match current source inputs');
const names = ['determinism', 'scenario-partnership', 'causal-capture', 'recorded-investigation', 'complex-import',
  'full-adder-operational', 'vcd-analyzer', 'nested-adder', 'studio-coherence', 'project-experience', 'studio-scale',
  'board-check-composition', 'studio-accessibility', 'project-persistence', 'large-experiment',
  'recording-comparison', 'design-core-authoring', 'constraint-sets', 'session-portability', 'session-recovery', 'storage-transaction',
  'responsive-theme-sweep', 'meridian-workflows', 'design-workspace-stability', 'narrow-layouts'];
const only = process.argv.slice(2);
const selected = only.length ? names.filter(name => only.includes(name)) : names;
if (!selected.length) throw Error('No matching journeys');
const out = path.resolve(process.env.RB_RELEASE_EVIDENCE_DIR ?? '.redbyte/release-candidate/validation/built-campaign');
fs.mkdirSync(out, { recursive: true });
const report = { baseUrl: base, node: process.version, build: health, sourceDigest: state.sourceDigest, started: new Date().toISOString(), records: [] };
for (const name of selected) {
  const start = Date.now();
  const log = path.join(out, `${name}.log`);
  const output = fs.createWriteStream(log);
  const exitCode = await new Promise(resolve => {
    const child = spawn(process.execPath, [`packages/rb-e2e/${name}-journey.mjs`], {
      env: { ...process.env, RB_BASE_URL: base, RB_SHOT_LABEL: `candidate-${health.version}` }, windowsHide: true,
    });
    child.stdout.pipe(output, { end: false }); child.stderr.pipe(output, { end: false });
    child.on('error', error => { output.write(`${error.stack}\n`); resolve(1); });
    child.on('close', code => resolve(code ?? 1));
  });
  await new Promise(resolve => output.end(resolve));
  report.records.push({ name, exitCode, seconds: (Date.now() - start) / 1000, log });
  fs.writeFileSync(path.join(out, only.length ? 'rerun.json' : 'results.json'), JSON.stringify(report, null, 2));
  console.log(`${exitCode === 0 ? 'PASS' : 'FAIL'} ${name} (${report.records.at(-1).seconds}s): ${log}`);
}
report.ended = new Date().toISOString();
report.sourceUnchanged = sourceState().sourceDigest === state.sourceDigest;
fs.writeFileSync(path.join(out, only.length ? 'rerun.json' : 'results.json'), JSON.stringify(report, null, 2));
if (!report.sourceUnchanged || report.records.some(record => record.exitCode !== 0)) process.exitCode = 1;
