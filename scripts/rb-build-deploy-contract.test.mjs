#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const repoRoot = process.cwd();
const verifyDistScript = path.join(repoRoot, 'scripts', 'verify-dist.mjs');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function writeFixture(rootDir, redirects) {
  const distDir = path.join(rootDir, 'dist');
  const osDir = path.join(distDir, 'os');
  const assetsDir = path.join(osDir, 'assets');

  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(
    path.join(distDir, 'index.html'),
    [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '  <head>',
      '    <meta charset="UTF-8" />',
      '    <!-- REDBYTE_PUBLIC_ROOT: public start-page fallback -->',
      '    <meta http-equiv="refresh" content="0; url=/start.html" />',
      '    <title>Start RedByte</title>',
      '  </head>',
      '  <body>',
      '    <p>RedByte - <a href="/start.html">Start page</a> - <a href="/os/">Open the IDE</a></p>',
      '  </body>',
      '</html>',
      '',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(
    path.join(distDir, 'start.html'),
    [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '  <head><title>Start RedByte</title></head>',
      '  <body>',
      '    <main data-testid="redbyte-start-page">',
      '      <h1>RedByte is a digital logic and FPGA workbench.</h1>',
      '      <a href="/os/" data-testid="redbyte-open-ide">Open IDE</a>',
      '      <p>Project -> Design -> Simulate -> Board &amp; Constraints -> Build &amp; Export -> Vivado</p>',
      '      <p>E0 E1 E2 E3 stay separate.</p>',
      '    </main>',
      '  </body>',
      '</html>',
      '',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(path.join(distDir, 'build.json'), `${JSON.stringify({ env: 'development' })}\n`, 'utf8');
  fs.writeFileSync(path.join(distDir, '_redirects'), redirects, 'utf8');
  fs.writeFileSync(path.join(distDir, '_headers'), '/index.html\n/start.html\n/os/index.html\n', 'utf8');
  fs.writeFileSync(
    path.join(osDir, 'index.html'),
    [
      '<!DOCTYPE html>',
      '<html lang="en">',
      '  <head><title>RedByte Playground</title></head>',
      '  <body>',
      '    <!-- REDBYTE_OS_IDE -->',
      '    <script type="module" src="/os/assets/main.js"></script>',
      '  </body>',
      '</html>',
      '',
    ].join('\n'),
    'utf8',
  );
  fs.writeFileSync(path.join(osDir, 'version.json'), `${JSON.stringify({ sha: 'test', builtAt: '2026-05-12T00:00:00.000Z' })}\n`, 'utf8');
  fs.writeFileSync(path.join(assetsDir, 'main.js'), 'console.log("RedByte IDE");\n', 'utf8');
}

function runVerify(rootDir) {
  return spawnSync(process.execPath, [verifyDistScript], {
    cwd: rootDir,
    encoding: 'utf8',
  });
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-build-contract-'));

try {
  const currentContractRoot = path.join(tempRoot, 'current-contract');
  writeFixture(
    currentContractRoot,
    [
      '# Canonical root redirect to the public start path',
      '/      /start.html  302',
      '',
      '# Normalize /os without trailing slash',
      '/os    /os/  302',
      '',
    ].join('\n'),
  );
  const currentResult = runVerify(currentContractRoot);
  assert(
    currentResult.status === 0,
    [
      'current public deploy contract should pass dist verification',
      currentResult.stdout,
      currentResult.stderr,
    ].join('\n'),
  );

  const staleContractRoot = path.join(tempRoot, 'stale-contract');
  writeFixture(
    staleContractRoot,
    [
      '# Stale OS-era root redirect',
      '/      /os/  302',
      '',
      '# Normalize /os without trailing slash',
      '/os    /os/  302',
      '',
    ].join('\n'),
  );
  const staleResult = runVerify(staleContractRoot);
  assert(staleResult.status !== 0, 'stale root /os/ redirect should fail dist verification');

  const staleOutput = `${staleResult.stdout}\n${staleResult.stderr}`;
  assert(
    /root redirect/i.test(staleOutput),
    'stale redirect failure should explain the root redirect contract',
  );

  console.log('[rb-build-deploy-contract:test] ok');
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
