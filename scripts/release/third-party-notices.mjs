// Third-party notices for what a RedByte build actually ships. The packages are read from the
// build's own source maps (every bundled module names its file under node_modules), together with
// their production dependencies (a prebuilt file such as jszip's carries its dependencies inside
// it), the fonts the build copies, and code the build tools insert. Each package's own licence
// text is copied verbatim. A shipped package without licence text is an error: its notice cannot
// be honoured.
//
//   node scripts/release/third-party-notices.mjs --check [buildDir]   fail if any notice is missing
//   node scripts/release/third-party-notices.mjs --write <out> [buildDir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LICENSE_FILES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENSE.markdown', 'LICENCE', 'LICENCE.md', 'license', 'license.md', 'LICENSE-MIT', 'LICENSE-MIT.txt', 'COPYING', 'OFL.txt'];
const unix = (text) => text.split('\r\n').join('\n');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
}

/** The package directory that owns a file under node_modules, or null. */
function packageDirOf(file) {
  const marker = `${path.sep}node_modules${path.sep}`;
  const at = file.lastIndexOf(marker);
  if (at < 0) return null;
  const rest = file.slice(at + marker.length).split(path.sep);
  const name = rest[0].startsWith('@') ? `${rest[0]}${path.sep}${rest[1]}` : rest[0];
  return file.slice(0, at + marker.length) + name;
}

/** A package without a licence file may state its licence in the README's License section. */
function readmeLicense(dir) {
  const readme = ['README.md', 'Readme.md', 'readme.md'].map((name) => path.join(dir, name)).find((candidate) => fs.existsSync(candidate));
  if (!readme) return null;
  const text = unix(fs.readFileSync(readme, 'utf8'));
  const at = text.search(/^#{1,3} *Licen[cs]e\b.*$/im);
  return at < 0 ? null : `(from ${path.basename(readme)})\n${text.slice(at).trimEnd()}`;
}

function readPackage(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const licenseFile = LICENSE_FILES.map((name) => path.join(dir, name)).find((candidate) => fs.existsSync(candidate));
  const licenseText = licenseFile ? unix(fs.readFileSync(licenseFile, 'utf8')).trimEnd() : readmeLicense(dir);
  const license = manifest.license ?? manifest.licenses?.map?.((entry) => entry.type).join(' OR ') ?? 'UNKNOWN';
  return { dir, name: manifest.name, version: manifest.version, license, dependencies: Object.keys(manifest.dependencies ?? {}), licenseText };
}

/** A dependency as pnpm links it: a sibling in the virtual store's node_modules. */
function dependencyDir(packageDir, name) {
  const marker = `${path.sep}node_modules${path.sep}`;
  const store = packageDir.slice(0, packageDir.lastIndexOf(marker) + marker.length);
  const candidate = path.join(store, ...name.split('/'));
  return fs.existsSync(path.join(candidate, 'package.json')) ? fs.realpathSync(candidate) : null;
}

export function collectThirdParty({ root = process.cwd(), buildDir } = {}) {
  const build = path.resolve(root, buildDir ?? (fs.existsSync(path.join(root, 'dist/os/assets')) ? 'dist' : 'apps/playground/dist'));
  const files = walk(build);
  const maps = files.filter((file) => file.endsWith('.js.map') || file.endsWith('.css.map'));
  if (maps.length === 0) throw Error(`No source maps under ${build}: the shipped packages cannot be read from this build.`);
  const found = new Map();
  const queue = [];
  const add = (dir, reason) => {
    if (!dir) return;
    const real = fs.realpathSync(dir);
    if (found.has(real)) return;
    const entry = { ...readPackage(real), reason };
    found.set(real, entry);
    queue.push(entry);
  };
  for (const map of maps) {
    // The unified build copies maps between folders, so a source's relative prefix is not reliable;
    // its path from node_modules on is, and the workspace's node_modules is at the root.
    const { sources = [] } = JSON.parse(fs.readFileSync(map, 'utf8'));
    for (const source of sources) {
      const at = source.indexOf('node_modules/');
      if (at < 0) continue;
      const file = path.join(root, ...source.slice(at).split('/'));
      if (!fs.existsSync(file)) throw Error(`A shipped module is not in this workspace: ${source} (${path.basename(map)})`);
      add(packageDirOf(file), 'bundled');
    }
  }
  // A prebuilt dependency carries its own dependencies inside it.
  while (queue.length) {
    const entry = queue.shift();
    for (const name of entry.dependencies) add(dependencyDir(entry.dir, name), `dependency of ${entry.name}`);
  }
  // Fonts the build copies, and code its tools insert.
  const resolveFrom = (name) => {
    const store = path.join(root, 'node_modules', '.pnpm');
    const prefix = `${name.replace('/', '+')}@`;
    const match = fs.existsSync(store) ? fs.readdirSync(store).filter((entry) => entry.startsWith(prefix)).sort().pop() : null;
    return match ? path.join(store, match, 'node_modules', ...name.split('/')) : null;
  };
  const text = (pattern) => files.some((file) => /\.(css|js)$/.test(file) && pattern.test(fs.readFileSync(file, 'utf8')));
  if (files.some((file) => /ibm-plex-mono/.test(path.basename(file)))) add(resolveFrom('@fontsource/ibm-plex-mono'), 'font');
  if (files.some((file) => /ibm-plex-sans/.test(path.basename(file)))) add(resolveFrom('@fontsource-variable/ibm-plex-sans'), 'font');
  if (text(/--tw-[a-z]/)) add(resolveFrom('tailwindcss'), 'generated CSS');
  if (text(/__vitePreload|modulepreload/)) add(resolveFrom('vite'), 'build helper');
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name, 'en') || a.version.localeCompare(b.version, 'en'));
}

export function noticesText(packages) {
  const missing = packages.filter((entry) => !entry.licenseText);
  if (missing.length) throw Error(`Shipped without licence text: ${missing.map((entry) => `${entry.name}@${entry.version}`).join(', ')}`);
  const header = [
    'RedByte third-party notices',
    '',
    'RedByte ships the following third-party software. Each is used under the licence named here; the',
    "licence text and copyright notice from each package follow. The Node.js runtime's notices are in",
    'runtime/LICENSE.',
    '',
    ...packages.map((entry) => `  ${entry.name} ${entry.version}  (${entry.license})`),
    '',
  ];
  const sections = packages.map((entry) => [
    '='.repeat(78),
    `${entry.name} ${entry.version}  (${entry.license})`,
    '-'.repeat(78),
    entry.licenseText,
    '',
  ].join('\n'));
  return `${header.join('\n')}\n${sections.join('\n')}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, a, b] = process.argv.slice(2);
  const packages = collectThirdParty({ buildDir: mode === '--write' ? b : a });
  const text = noticesText(packages); // throws when a shipped package carries no licence text
  if (mode === '--write') {
    fs.writeFileSync(a, text);
    console.log(`[third-party-notices] ${packages.length} packages -> ${a}`);
  } else if (mode === '--check') {
    console.log(`[third-party-notices] ${packages.length} shipped third-party packages, each with its licence text:`);
    for (const entry of packages) console.log(`  ${entry.name} ${entry.version} (${entry.license}) - ${entry.reason}`);
  } else {
    throw Error('Use --check [buildDir] or --write <out> [buildDir].');
  }
}
