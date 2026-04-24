/**
 * Writes a deterministic Open Project (folder) ZIP for Vivado certification rehearsal,
 * using the classroom golden combinational fixture (SW0 ∧ SW1 → LED0).
 *
 * Avoids `buildExportViewModel` so this script runs under `tsx` without Vite's `import.meta.env`
 * (see `scripts/lab8-vivado-export.ts` note on `@redbyte/rb-utils`).
 *
 * Usage:
 *   pnpm exec tsx scripts/vivado-cert-export-open-project.ts
 *
 * Outputs:
 *   out/vivado-cert/golden-basys3-switch-and.zip
 *   out/vivado-cert/golden-basys3-switch-and-unpacked/
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeRBProject, encodeRBProject, type RBProject } from '../packages/rb-apps/src/export/projectFormat';
import { exportBasys3Bundle } from '../packages/rb-apps/src/fpga/boards/basys3/basys3Bundle';
import {
  buildVivadoProjectFolderZip,
  deriveVivadoProjectSlug,
  resolveVivadoPart,
} from '../packages/rb-apps/src/fpga/vivado/vivadoProjectFolder';
import type { IoMapping } from '@redbyte/rb-utils';

type GoldenFixture = RBProject & { classroom?: { board?: string; ioMapping?: IoMapping } };

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const fixturePath = join(
  repoRoot,
  'packages/rb-apps/src/fixtures/classroom/golden-basys3-switch-and.rbproj',
);
const outDir = join(repoRoot, 'out/vivado-cert');
const zipName = 'golden-basys3-switch-and.zip';
const zipPath = join(outDir, zipName);
const unpackDir = join(outDir, 'golden-basys3-switch-and-unpacked');

function liftGoldenToProject(raw: GoldenFixture): RBProject {
  const base = decodeRBProject(encodeRBProject(raw)) as GoldenFixture;
  const ioMapping = base.ioMapping ?? base.classroom?.ioMapping;
  if (!ioMapping) {
    throw new Error('golden-basys3-switch-and: missing ioMapping / classroom.ioMapping');
  }
  return {
    ...base,
    ioMapping,
    fpga: base.fpga ?? { board: 'basys3', part: 'xc7a35tcpg236-1', top: 'top' },
    vectors: base.vectors ?? [],
    meta: {
      ...base.meta,
      projectId: base.meta?.projectId ?? 'golden-basys3-switch-and',
    },
  };
}

async function main() {
  const raw = JSON.parse(readFileSync(fixturePath, 'utf8')) as GoldenFixture;
  const project = liftGoldenToProject(raw);

  const bundle = exportBasys3Bundle(project.circuit, project.ioMapping!);
  if (!bundle.valid) {
    throw new Error(`exportBasys3Bundle invalid: ${bundle.warnings.join('; ')}`);
  }

  const slug = deriveVivadoProjectSlug(project.meta?.projectId ?? project.name);
  const topModule = project.fpga?.top ?? 'top';
  const manifestText = encodeRBProject(project);

  const zipBytes = await buildVivadoProjectFolderZip({
    artifacts: [
      { path: 'project.rbproj.json', content: manifestText },
      { path: 'top.vhd', content: bundle.topVhd },
      { path: 'top.xdc', content: bundle.topXdc },
    ],
    projectName: project.name,
    projectSlug: slug,
    topModule,
    part: resolveVivadoPart(project.fpga?.part),
  });

  mkdirSync(outDir, { recursive: true });
  writeFileSync(zipPath, Buffer.from(zipBytes));

  mkdirSync(unpackDir, { recursive: true });
  const ps = [
    '-NoProfile',
    '-Command',
    `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${unpackDir.replace(/'/g, "''")}' -Force`,
  ];
  execFileSync('powershell.exe', ps, { stdio: 'inherit' });

  const xpr = join(unpackDir, slug, `${slug}.xpr`);
  console.log(`[vivado-cert-export] wrote: ${zipPath}`);
  console.log(`[vivado-cert-export] unpacked to: ${unpackDir}`);
  console.log(`[vivado-cert-export] batch Tcl xpr path:\n  ${xpr}`);
}

main().catch((e) => {
  console.error('[vivado-cert-export] FAIL:', e instanceof Error ? e.message : e);
  process.exit(1);
});
