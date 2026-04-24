/**
 * Cross-machine hw_probe launcher (Windows-friendly).
 * Prefers VIVADO_BAT, then common 2024.2 install path.
 *
 * Usage: pnpm exec node scripts/vivado/run-hw-probe.mjs
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(repoRoot, 'out', 'vivado-cert');
mkdirSync(outDir, { recursive: true });

const candidates = [
  process.env.VIVADO_BAT,
  'C:\\Xilinx\\Vivado\\2024.2\\bin\\vivado.bat',
].filter((p) => typeof p === 'string' && p.length > 0);

const vivado = candidates.find((p) => existsSync(p));
if (!vivado) {
  console.error(
    '[hw-probe] No vivado.bat found. Set VIVADO_BAT to the full path (e.g. C:\\Xilinx\\Vivado\\2024.2\\bin\\vivado.bat).',
  );
  process.exit(1);
}

const log = join(outDir, 'hw_probe.log');
const tcl = join(repoRoot, 'scripts', 'vivado', 'hw_probe.tcl');
const r = spawnSync(
  vivado,
  ['-mode', 'batch', '-source', tcl, '-notrace', '-nojournal', '-log', log],
  { stdio: 'inherit', cwd: repoRoot, shell: true },
);
process.exit(r.status === null ? 1 : r.status);
