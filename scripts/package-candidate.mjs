import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import archiver from 'archiver';
import { sourceState } from './source-state.mjs';
import { collectThirdParty, noticesText } from './release/third-party-notices.mjs';
const root = process.cwd();
const version = process.argv[2] ?? '1.0.0-rc.1';
if (!/^[\w.-]+$/.test(version)) throw Error('Invalid candidate version');
const state = sourceState(root);
const built = JSON.parse(fs.readFileSync('dist/os/version.json','utf8'));
const build = JSON.parse(fs.readFileSync('dist/build.json','utf8'));
if (built.sourceDigest !== state.sourceDigest || build.sourceDigest !== state.sourceDigest) throw Error('Build is stale for this source tree. Run build:unified before packaging.');
if (built.version !== version || build.version !== version) throw Error(`Build version differs. Build with RB_CANDIDATE_VERSION=${version}.`);
const dir = path.join(root,'.redbyte/releases',`redbyte-${version}-win-x64`);
if (fs.existsSync(dir)) throw Error(`Candidate directory already exists: ${dir}. Preserve it or choose a new version.`);
fs.mkdirSync(dir,{recursive:true});
fs.cpSync('dist',path.join(dir,'app'),{recursive:true});
const runtime = '.redbyte/tools/node-v20.19.0-win-x64';
if (execFileSync(path.resolve(runtime,'node.exe'),['--version'],{encoding:'utf8',windowsHide:true}).trim() !== 'v20.19.0') throw Error('Pinned runtime unavailable');
fs.mkdirSync(path.join(dir,'runtime'));
for (const name of ['node.exe','LICENSE']) fs.copyFileSync(path.join(runtime,name),path.join(dir,'runtime',name));
fs.copyFileSync('scripts/release/local-server.mjs',path.join(dir,'server.mjs'));
for (const name of ['launch.mjs','Start-RedByte.cmd','Stop-RedByte.cmd','Start-RedByte.ps1','Stop-RedByte.ps1']) fs.copyFileSync(path.join('scripts/release',name),path.join(dir,name));
fs.copyFileSync('docs/release/local-candidate-quickstart.md',path.join(dir,'QUICKSTART.md'));
fs.copyFileSync('LICENSE',path.join(dir,'LICENSE'));
// The bundled libraries' and fonts' own notices (the Node runtime's are in runtime/LICENSE).
fs.writeFileSync(path.join(dir,'THIRD_PARTY_NOTICES.txt'),noticesText(collectThirdParty({ root, buildDir: 'dist' })));
fs.cpSync('scripts/release/samples',path.join(dir,'samples'),{recursive:true});
fs.writeFileSync(path.join(dir,'candidate.json'),JSON.stringify({version,...state,node:'20.19.0',pnpm:'10.24.0',proofTier:'Browser E0; Vivado and physical board unverified'},null,2)+'\n');
function walk(dir,base='') { return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name),`${base}${e.name}/`):[`${base}${e.name}`]); }
const checksums = walk(dir).map(p=>`${createHash('sha256').update(fs.readFileSync(path.join(dir,p))).digest('hex')}  ${p}`).join('\n')+'\n';
fs.writeFileSync(path.join(dir,'SHA256SUMS.txt'),checksums);
async function zip(target) {
  const output=fs.createWriteStream(target); const archive=archiver('zip',{zlib:{level:9}});
  const done=new Promise((resolve,reject)=>{output.on('close',resolve);output.on('error',reject);archive.on('error',reject)});
  archive.pipe(output);
  // file() resolves stat calls concurrently, which can reorder identical entries.
  // Append the sorted snapshot directly so repeated archives have identical order.
  for (const p of walk(dir)) archive.append(fs.readFileSync(path.join(dir,p)),{name:`redbyte-${version}-win-x64/${p}`,date:new Date('2026-01-01T00:00:00Z'),mode:0o644});
  await archive.finalize(); await done;
}
const zipPath=`${dir}.zip`; await zip(zipPath);
const first=createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
const repeat=`${dir}.repro.zip`; await zip(repeat);
if (createHash('sha256').update(fs.readFileSync(repeat)).digest('hex')!==first) throw Error('Repeated packaging differs');
fs.unlinkSync(repeat);
fs.writeFileSync(`${zipPath}.sha256`,`${first}  ${path.basename(zipPath)}\n`);
console.log(JSON.stringify({dir,zipPath,sha256:first,bytes:fs.statSync(zipPath).size,sourceDigest:state.sourceDigest,reproduciblePackaging:true},null,2));
