// Windows entry contract: actual shipped CMD files, bundled Node, system-only PATH.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { requestHealth } from './launch.mjs';

const source = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(source, '../..');
const environment = { ...process.env, PATH: `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}`,
  RB_LAUNCH_NO_PAUSE: '1' };
const candidates = [];
const running = [];
async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'RedByte spaces Ω '));
  candidates.push(root);
  fs.mkdirSync(path.join(root, 'runtime'));
  fs.mkdirSync(path.join(root, 'app/os'), { recursive: true });
  fs.copyFileSync(path.join(repo, '.redbyte/tools/node-v20.19.0-win-x64/node.exe'), path.join(root, 'runtime/node.exe'));
  for (const file of ['launch.mjs', 'Start-RedByte.cmd', 'Stop-RedByte.cmd', 'Start-RedByte.ps1', 'Stop-RedByte.ps1']) fs.copyFileSync(path.join(source, file), path.join(root, file));
  fs.copyFileSync(path.join(source, 'local-server.mjs'), path.join(root, 'server.mjs'));
  const identity = { version: 'launcher-test', sourceDigest: 'launcher-source-test' };
  fs.writeFileSync(path.join(root, 'candidate.json'), JSON.stringify(identity));
  fs.writeFileSync(path.join(root, 'app/os/version.json'), JSON.stringify(identity));
  fs.writeFileSync(path.join(root, 'app/os/index.html'), '<!doctype html><title>RedByte launcher transport fixture</title>');
  return root;
}
function cmd(root, action, port, options = '--no-browser') {
  return new Promise(resolve => {
    const file = path.join(root, action === 'start' ? 'Start-RedByte.cmd' : 'Stop-RedByte.cmd');
    const child = spawn(process.env.ComSpec, ['/d', '/s', '/c', `""${file}" --port ${port} ${options}"`], {
      cwd: os.tmpdir(), env: environment, windowsHide: true, windowsVerbatimArguments: true,
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.once('error', error => resolve({ code: 1, stdout, stderr: String(error) }));
    child.once('close', code => resolve({ code, stdout, stderr }));
  });
}
async function start(root, port) {
  const result = await cmd(root, 'start', port);
  assert.equal(result.code, 0, JSON.stringify(result));
  running.push({ root, port });
  return await requestHealth(port);
}

test('portable Windows launcher ownership and recovery', { skip: process.platform !== 'win32', timeout: 60000 }, async t => {
  const root = fixture();
  const other = fixture();
  const port = await freePort();
  try {
    let first;
    await t.test('actual CMD starts from a space/non-ASCII folder with no developer tools in PATH', async () => {
      first = await start(root, port);
      assert.equal(first.executable.toLowerCase(), path.join(root, 'runtime/node.exe').toLowerCase());
      assert.equal(first.serverScript, path.join(root, 'server.mjs'));
      assert.equal(first.serverRoot, path.join(root, 'app'));
      assert.equal(first.packageRoot, root);
      assert.equal(first.token, undefined);
      assert.equal(await (await fetch(`http://127.0.0.1:${port}/os/`)).text(), '<!doctype html><title>RedByte launcher transport fixture</title>');
    });
    await t.test('repeated starts retain the exact owned process', async () => {
      const repeat = await cmd(root, 'start', port);
      assert.equal(repeat.code, 0, JSON.stringify(repeat));
      assert.match(repeat.stdout, /already running/);
      assert.equal((await requestHealth(port)).pid, first.pid);
    });
    await t.test('same-source other folder cannot start or stop the existing instance', async () => {
      for (const action of ['start', 'stop']) {
        const refused = await cmd(other, action, port);
        assert.equal(refused.code, 1);
        assert.match(refused.stderr, /another candidate or folder|not this folder/);
        assert.equal((await requestHealth(port)).pid, first.pid);
      }
    });
    await t.test('shutdown rejects wrong method, missing token and malformed token without affecting readiness', async () => {
      const url = `http://127.0.0.1:${port}/__redbyte_shutdown`;
      assert.equal((await fetch(url)).status, 405);
      assert.equal((await fetch(url, { method: 'POST' })).status, 403);
      assert.equal((await fetch(url, { method: 'POST', headers: { 'X-RedByte-Owner': 'a'.repeat(64) } })).status, 403);
      assert.equal((await fetch(url, { method: 'POST', headers: { 'X-RedByte-Owner': '!'.repeat(64) } })).status, 403);
      assert.equal((await requestHealth(port)).pid, first.pid);
    });
    await t.test('tampered executable/root receipt refuses stop, then valid receipt stops only the secondary', async () => {
      const secondaryPort = await freePort();
      await start(other, secondaryPort);
      const file = path.join(other, 'run', `instance-${secondaryPort}.json`);
      const original = fs.readFileSync(file, 'utf8');
      const receipt = JSON.parse(original);
      for (const key of ['executable', 'serverScript', 'serverRoot', 'packageRoot']) {
        fs.writeFileSync(file, JSON.stringify({ ...receipt, [key]: path.join(root, 'wrong') }));
        assert.equal((await cmd(other, 'stop', secondaryPort)).code, 1);
        assert.ok(await requestHealth(secondaryPort));
      }
      fs.writeFileSync(file, original);
      assert.equal((await cmd(other, 'stop', secondaryPort)).code, 0);
      assert.equal(await requestHealth(secondaryPort), null);
      assert.equal((await requestHealth(port)).pid, first.pid);
    });
    await t.test('an unrelated occupied port is reported and never stopped', async () => {
      const server = http.createServer((_request, response) => response.writeHead(404).end('not RedByte'));
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const occupiedPort = server.address().port;
      try {
        for (const action of ['start', 'stop']) {
          const result = await cmd(root, action, occupiedPort);
          assert.equal(result.code, 1);
          assert.match(result.stderr, /already in use|unrecognized service/);
          assert.equal(server.listening, true);
        }
      } finally { await new Promise(resolve => server.close(resolve)); }
    });
    await t.test('failed server startup leaves actionable logs and no owned child listening', async () => {
      const broken = fixture();
      fs.writeFileSync(path.join(broken, 'server.mjs'), "throw Error('controlled startup failure');");
      const brokenPort = await freePort();
      const result = await cmd(broken, 'start', brokenPort);
      assert.equal(result.code, 1);
      assert.match(result.stderr, /failed to start.*Inspect/s);
      assert.match(fs.readFileSync(path.join(broken, 'run', `server-${brokenPort}-error.log`), 'utf8'), /controlled startup failure/);
      assert.equal(await requestHealth(brokenPort), null);
      assert.equal(fs.existsSync(path.join(broken, 'run', `start-${brokenPort}.lock`)), false);
    });
    await t.test('readiness timeout terminates only its newly created child and retains failure logs', async () => {
      const stalled = fixture();
      fs.writeFileSync(path.join(stalled, 'server.mjs'), "import fs from 'node:fs'; fs.writeFileSync('stalled-pid.txt',String(process.pid)); console.error('controlled readiness stall'); setInterval(()=>{},1000);");
      const stalledPort = await freePort();
      const result = await cmd(stalled, 'start', stalledPort);
      assert.equal(result.code, 1);
      assert.match(result.stderr, /did not become ready.*Inspect/s);
      const pid = Number(fs.readFileSync(path.join(stalled, 'stalled-pid.txt'), 'utf8'));
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
      assert.match(fs.readFileSync(path.join(stalled, 'run', `server-${stalledPort}-error.log`), 'utf8'), /controlled readiness stall/);
      assert.equal(await requestHealth(stalledPort), null);
      assert.equal(fs.existsSync(path.join(stalled, 'run', `start-${stalledPort}.lock`)), false);
      assert.equal((await requestHealth(port)).pid, first.pid);
    });
    await t.test('partial extraction without bundled runtime has an actionable CMD error', async () => {
      const partial = fixture();
      fs.unlinkSync(path.join(partial, 'runtime/node.exe'));
      const partialPort = await freePort();
      for (const action of ['start', 'stop']) {
        const result = await cmd(partial, action, partialPort);
        assert.equal(result.code, 1);
        assert.match(result.stderr, /bundled runtime missing.*Extract the entire ZIP/);
      }
      assert.equal(await requestHealth(partialPort), null);
      assert.equal(fs.existsSync(path.join(partial, 'run')), false);
    });
    await t.test('interrupted-launch lock is explicit and does not create a hidden server', async () => {
      const locked = fixture();
      const lockedPort = await freePort();
      fs.mkdirSync(path.join(locked, 'run'));
      fs.writeFileSync(path.join(locked, 'run', `start-${lockedPort}.lock`), '{}');
      const result = await cmd(locked, 'start', lockedPort);
      assert.equal(result.code, 1);
      assert.match(result.stderr, /Another launch is in progress/);
      assert.equal(await requestHealth(lockedPort), null);
    });
    await t.test('CMD/PS entry sources never override execution policy or require pnpm', () => {
      for (const file of ['Start-RedByte.cmd', 'Stop-RedByte.cmd', 'Start-RedByte.ps1', 'Stop-RedByte.ps1']) {
        const text = fs.readFileSync(path.join(root, file), 'utf8');
        assert.doesNotMatch(text, /ExecutionPolicy|Bypass|pnpm|npm\s/i);
        assert.match(text, /runtime[\\/]node\.exe/);
      }
    });
  } finally {
    for (const entry of running.reverse()) await cmd(entry.root, 'stop', entry.port);
    // Only fixtures created by this test; no owner directories or archives.
    for (const candidate of candidates) {
      assert.ok(candidate.startsWith(path.join(os.tmpdir(), 'RedByte spaces Ω ')));
      fs.rmSync(candidate, { recursive: true, maxRetries: 20, retryDelay: 100 });
    }
  }
});
