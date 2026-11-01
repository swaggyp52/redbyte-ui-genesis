// Portable entry point: bundled Node and Windows URL association, no package manager.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const canonical = value => fs.realpathSync.native(value);
const samePath = (left, right) => typeof left === 'string' && typeof right === 'string' &&
  (process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right);
const hash = value => createHash('sha256').update(value).digest('hex');

export function requestHealth(port, token, shutdown = false) {
  return new Promise(resolve => {
    const req = http.request({ hostname: '127.0.0.1', port, path: shutdown ? '/__redbyte_shutdown' : '/__redbyte_health',
      method: shutdown ? 'POST' : 'GET', headers: token ? { 'X-RedByte-Owner': token } : {}, timeout: 1500 }, res => {
      let data = '';
      res.on('error', () => resolve(null));
      res.on('aborted', () => resolve(null));
      res.on('data', chunk => { data += chunk; if (data.length > 65536) req.destroy(); });
      res.on('end', () => { try { resolve(res.statusCode === 200 ? JSON.parse(data) : null); } catch { resolve(null); } });
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
    req.end();
  });
}

function occupied(port) {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const finish = value => { socket.destroy(); resolve(value); };
    socket.setTimeout(1000, () => finish(true));
    socket.once('connect', () => finish(true));
    socket.once('error', error => finish(error.code !== 'ECONNREFUSED'));
  });
}

function expectedIdentity(root, port) {
  const candidate = JSON.parse(fs.readFileSync(path.join(root, 'candidate.json'), 'utf8'));
  const version = JSON.parse(fs.readFileSync(path.join(root, 'app/os/version.json'), 'utf8'));
  if (!candidate.version || !candidate.sourceDigest || version.version !== candidate.version || version.sourceDigest !== candidate.sourceDigest) {
    throw Error('This folder has mismatched or missing candidate files. Extract a complete candidate into a new folder.');
  }
  return { version: candidate.version, sourceDigest: candidate.sourceDigest, port,
    packageRoot: canonical(root), serverRoot: canonical(path.join(root, 'app')),
    executable: canonical(path.join(root, 'runtime/node.exe')), serverScript: canonical(path.join(root, 'server.mjs')) };
}

function owns(health, receipt, expected) {
  return health && receipt && typeof receipt.token === 'string' && receipt.token.length === 64 &&
    health.pid === receipt.pid && health.version === expected.version && health.sourceDigest === expected.sourceDigest &&
    health.port === expected.port && health.ownerProof === hash(receipt.token) &&
    ['packageRoot', 'serverRoot', 'executable', 'serverScript'].every(key =>
      samePath(health[key], expected[key]) && samePath(receipt[key], expected[key]));
}

function readReceipt(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function writeReceipt(file, value) {
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2));
  fs.renameSync(temporary, file);
}

async function openBrowser(url) {
  if (process.platform !== 'win32') throw Error(`Open ${url} in your browser; automatic launch is supported on Windows.`);
  await new Promise((resolve, reject) => {
    const child = spawn(process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', `start "" "${url}"`], { windowsHide: true, windowsVerbatimArguments: true });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(Error(`Windows URL association returned exit ${code}`)));
  });
  console.log('Windows accepted the request to open this address in your default browser.');
}

export async function launch({ root, action = 'start', port = 5188, noBrowser = false }) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Use --port with an integer from 1024 through 65535.');
  root = canonical(root);
  const expected = expectedIdentity(root, port);
  const runDir = path.join(root, 'run');
  const receiptFile = path.join(runDir, `instance-${port}.json`);
  const url = `http://127.0.0.1:${port}/os/`;
  let receipt = readReceipt(receiptFile);
  let health = await requestHealth(port);
  if (action === 'stop') {
    if (!health) {
      if (await occupied(port)) throw Error(`Port ${port} is occupied by an unrecognized service. No process was stopped.`);
      console.log('RedByte is already stopped. Saved projects remain in your browser.');
      return;
    }
    if (!owns(health, receipt, expected)) throw Error(`Port ${port} is not this folder's owned server. Stop it from its own folder. No process was stopped.`);
    if (!await requestHealth(port, receipt.token, true)) throw Error('The owned server refused shutdown. No other process was stopped.');
    for (let attempt = 0; attempt < 30; attempt++) {
      if (!await occupied(port)) { fs.unlinkSync(receiptFile); console.log('RedByte stopped. Saved projects remain in your browser.'); return; }
      await sleep(100);
    }
    throw Error('The owned server has not finished stopping. Retry Stop; no other process was stopped.');
  }
  if (action !== 'start') throw Error('Use start or stop.');
  if (health && !owns(health, receipt, expected)) throw Error(`Port ${port} serves another candidate or folder. Start/stop it from its own folder, or explicitly choose --port. Changing ports changes browser storage.`);
  if (!health && await occupied(port)) throw Error(`Port ${port} is already in use. Close its owning application or explicitly choose --port; changing ports changes browser storage. No process was stopped.`);
  if (!health) {
    fs.mkdirSync(runDir, { recursive: true });
    const lockFile = path.join(runDir, `start-${port}.lock`);
    let lock;
    try { lock = fs.openSync(lockFile, 'wx'); }
    catch (error) {
      if (error.code === 'EEXIST') throw Error(`Another launch is in progress for port ${port}. Wait and retry. If a launch was interrupted, inspect ${lockFile} before removing only that lock.`);
      throw Error(`Cannot create the launch lock at ${lockFile}: ${error.message}. Extract the candidate into a writable folder.`);
    }
    let child;
    const logFile = path.join(runDir, `server-${port}.log`);
    const errorFile = path.join(runDir, `server-${port}-error.log`);
    try {
      fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, packageRoot: root }));
      const token = randomBytes(32).toString('hex');
      const output = fs.openSync(logFile, 'a');
      const errors = fs.openSync(errorFile, 'a');
      try {
        child = spawn(expected.executable, [expected.serverScript, expected.serverRoot], { cwd: root,
          env: { ...process.env, RB_PORT: String(port), RB_SERVER_TOKEN: token, RB_PACKAGE_ROOT: root },
          detached: true, windowsHide: true, stdio: ['ignore', output, errors] });
      } finally { fs.closeSync(output); fs.closeSync(errors); }
      let spawnError;
      child.once('error', error => { spawnError = error; });
      receipt = { ...expected, pid: child.pid, token };
      for (let attempt = 0; attempt < 50; attempt++) {
        if (spawnError || child.exitCode !== null) throw Error(`The bundled server failed to start. ${spawnError?.message ?? ''} Inspect ${errorFile}.`);
        health = await requestHealth(port);
        if (owns(health, receipt, expected)) break;
        if (health) throw Error(`Another service acquired port ${port} during startup. No other process was stopped.`);
        await sleep(100);
      }
      if (!owns(health, receipt, expected)) throw Error(`RedByte did not become ready. Inspect ${logFile} and ${errorFile}.`);
      writeReceipt(receiptFile, receipt);
      child.unref();
    } catch (error) {
      // This child was created by this invocation, never discovered by PID/name.
      if (child && child.exitCode === null && child.pid) child.kill();
      throw error;
    } finally { fs.closeSync(lock); fs.unlinkSync(lockFile); }
  } else console.log('This folder is already running; opening its existing instance.');
  console.log(`RedByte ${expected.version}: ${url}`);
  console.log('Projects live in this browser at this address, not inside the ZIP. Export a session backup before changing browser, port or device.');
  if (!noBrowser) {
    try { await openBrowser(url); }
    catch (error) { throw Error(`RedByte is ready at ${url}, but Windows could not open the browser: ${error.message}. Open the address manually. The owned server can be stopped with Stop-RedByte.cmd.`); }
  }
}

if (process.argv[1] && samePath(path.resolve(process.argv[1]), fileURLToPath(import.meta.url))) {
  const action = process.argv[2] ?? 'start';
  let port = 5188;
  let noBrowser = false;
  try {
    for (let index = 3; index < process.argv.length; index++) {
      const argument = process.argv[index];
      if (argument === '--port') port = Number(process.argv[++index]);
      else if (argument === '--no-browser') noBrowser = true;
      else throw Error(`Unknown option ${argument}. Use --port NUMBER or --no-browser.`);
    }
    await launch({ root: path.dirname(fileURLToPath(import.meta.url)), action, port, noBrowser });
  } catch (error) { console.error(`RedByte: ${error.message}`); process.exitCode = 1; }
}
