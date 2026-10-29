// Release qualification preflight for external HDL execution. A developer run leaves
// REDBYTE_REQUIRE_GHDL unset and the GHDL suites report skipped without GHDL; a release run sets
// REDBYTE_REQUIRE_GHDL=1, and then REDBYTE_GHDL must name a working GHDL or qualification stops here.
//
//   REDBYTE_REQUIRE_GHDL=1 REDBYTE_GHDL=<ghdl.exe> node scripts/release/ghdl-preflight.mjs
import { spawnSync } from 'node:child_process';

const required = process.env.REDBYTE_REQUIRE_GHDL === '1';
const path = process.env.REDBYTE_GHDL?.trim() ?? '';
const probe = path ? spawnSync(path, ['--version'], { encoding: 'utf8', timeout: 20_000, windowsHide: true }) : null;
const firstLine = `${probe?.stdout ?? ''}`.split(/\r?\n/)[0].trim();
const working = Boolean(probe && probe.status === 0 && /^GHDL\b/.test(firstLine));

if (working) {
  console.log(`[ghdl-preflight] ${firstLine} at ${path}${required ? ' (required)' : ''}`);
} else if (required) {
  const reason = !path ? 'REDBYTE_GHDL is not set' : probe?.error ? `${path}: ${probe.error.message}` : `${path} is not GHDL (exit ${probe?.status}: "${firstLine.slice(0, 80)}")`;
  console.error(`[ghdl-preflight] REDBYTE_REQUIRE_GHDL=1 but ${reason}. Release qualification needs a working GHDL.`);
  process.exitCode = 1;
} else {
  console.log('[ghdl-preflight] GHDL not required (REDBYTE_REQUIRE_GHDL is not 1); GHDL suites report skipped without it.');
}
