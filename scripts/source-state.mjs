import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const repoRoot = fileURLToPath(new URL('../', import.meta.url));

/** Identify actual build inputs even when HEAD is intentionally uncommitted. */
export function sourceState(root = repoRoot) {
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
  const paths = git(['ls-files', '--cached', '--others', '--exclude-standard']).split(/\r?\n/)
    .filter(p => (/^(apps\/playground\/|packages\/|public\/|tools\/config\/|scripts\/)/.test(p)
      || /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|\.nvmrc|tsconfig[^/]*\.json|(?:vite|vitest|tailwind|postcss)\.config\.[cm]?[jt]s)$/.test(p))
      && !/(^|\/)(dist|node_modules|\.redbyte)\//.test(p) && !/\/(build|version)\.json$/.test(p));
  const files = [...new Set(paths)].sort().filter(p => fs.existsSync(path.join(root, p)) && fs.statSync(path.join(root, p)).isFile())
    .map(p => ({ path: p, sha256: createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex') }));
  return { gitHead: git(['rev-parse', 'HEAD']), branch: git(['branch', '--show-current']),
    sourceDigest: createHash('sha256').update(JSON.stringify(files)).digest('hex'), files };
}
