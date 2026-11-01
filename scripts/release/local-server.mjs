// Standalone loopback server for the exact unified browser build. No dependencies.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fs.realpathSync.native(path.resolve(process.argv[2] ?? 'app'));
const port = Number(process.env.RB_PORT ?? 5188);
const version = JSON.parse(fs.readFileSync(path.join(root, 'os/version.json'), 'utf8'));
const token = process.env.RB_SERVER_TOKEN;
delete process.env.RB_SERVER_TOKEN;
const executable = fs.realpathSync.native(process.execPath);
const serverScript = fs.realpathSync.native(fileURLToPath(import.meta.url));
const packageRoot = process.env.RB_PACKAGE_ROOT ? fs.realpathSync.native(process.env.RB_PACKAGE_ROOT) : path.dirname(root);
const equalPath = (left, right) => process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
if (token) {
  const candidate = JSON.parse(fs.readFileSync(path.join(packageRoot, 'candidate.json'), 'utf8'));
  if (!/^[a-f0-9]{64}$/.test(token) || candidate.version !== version.version || candidate.sourceDigest !== version.sourceDigest ||
      !equalPath(root, fs.realpathSync.native(path.join(packageRoot, 'app'))) ||
      !equalPath(executable, fs.realpathSync.native(path.join(packageRoot, 'runtime/node.exe'))) ||
      !equalPath(serverScript, fs.realpathSync.native(path.join(packageRoot, 'server.mjs')))) {
    throw Error('The server identity does not match this extracted candidate.');
  }
}
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png',
  '.jpg':'image/jpeg', '.ico':'image/x-icon', '.woff':'font/woff', '.woff2':'font/woff2', '.wasm':'application/wasm', '.txt':'text/plain; charset=utf-8' };
const server = http.createServer((request, response) => {
  response.setHeader('Cache-Control','no-store');
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
  catch { response.writeHead(400); response.end(); return; }
  if (urlPath === '/__redbyte_shutdown') {
    if (request.method !== 'POST') { response.writeHead(405); response.end(); return; }
    const supplied = request.headers['x-redbyte-owner'];
    if (!token || typeof supplied !== 'string' || !/^[a-f0-9]{64}$/.test(supplied) ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))) {
      response.writeHead(403); response.end(); return;
    }
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ stopping: true }));
    server.close(() => process.exit(0));
    setTimeout(() => server.closeAllConnections(), 1000).unref();
    return;
  }
  if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
  if (urlPath === '/__redbyte_health') {
    response.setHeader('Content-Type','application/json'); response.end(JSON.stringify({ ...version, pid:process.pid, port,
      serverRoot:root, packageRoot, executable, serverScript,
      ownerProof: token ? createHash('sha256').update(token).digest('hex') : null })); return;
  }
  if (urlPath === '/') { response.writeHead(302,{Location:'/os/'}); response.end(); return; }
  let file = path.resolve(root, `.${urlPath}`);
  if (!file.startsWith(`${root}${path.sep}`)) { response.writeHead(403); response.end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file,'index.html');
  if (!fs.existsSync(file) && urlPath.startsWith('/os/') && !path.extname(urlPath)) file = path.join(root,'os/index.html');
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end('File not found'); return; }
  response.setHeader('Content-Type',mime[path.extname(file)] ?? 'application/octet-stream');
  if (request.method === 'HEAD') { response.end(); return; }
  const stream = fs.createReadStream(file); stream.on('error',()=>response.destroy()); stream.pipe(response);
});
server.on('error', error => { console.error(`RedByte could not start on 127.0.0.1:${port}: ${error.message}`); process.exitCode=1; });
server.listen(port,'127.0.0.1',()=>console.log(`RedByte ${version.version} READY http://127.0.0.1:${port}/os/ source=${version.sourceDigest}`));
