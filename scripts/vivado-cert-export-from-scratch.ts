/**
 * Export Open Project ZIP from from-scratch certification fixtures (blank-shaped RBProject).
 *
 * Usage:
 *   pnpm exec tsx scripts/vivado-cert-export-from-scratch.ts <fixture-id>
 *
 * Fixture IDs: fs-comb-switch-and-basys3 | fs-seq-two-bit-counter-basys3
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FROM_SCRATCH_BASYS3_CERT_FIXTURE_IDS,
  getFromScratchBasys3CertProjectById,
} from '../packages/rb-apps/src/apps/ide/fixtures/fromScratchBasys3CertProjects';
import { encodeRBProject } from '../packages/rb-apps/src/export/projectFormat';
import { exportBasys3Bundle } from '../packages/rb-apps/src/fpga/boards/basys3/basys3Bundle';
import {
  buildVivadoProjectFolderZip,
  deriveVivadoProjectSlug,
  resolveVivadoPart,
} from '../packages/rb-apps/src/fpga/vivado/vivadoProjectFolder';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

function parseFixtureId(raw: string): (typeof FROM_SCRATCH_BASYS3_CERT_FIXTURE_IDS)[number] {
  const id = raw.trim() as (typeof FROM_SCRATCH_BASYS3_CERT_FIXTURE_IDS)[number];
  if (!FROM_SCRATCH_BASYS3_CERT_FIXTURE_IDS.includes(id)) {
    console.error(
      `unknown fixture id: ${raw}\nexpected one of: ${FROM_SCRATCH_BASYS3_CERT_FIXTURE_IDS.join(', ')}`,
    );
    process.exit(1);
  }
  return id;
}

async function main() {
  const raw = process.argv[2]?.trim();
  if (!raw) {
    console.error(
      `usage: pnpm exec tsx scripts/vivado-cert-export-from-scratch.ts <fixture-id>\n` +
        `fixtures: ${FROM_SCRATCH_BASYS3_CERT_FIXTURE_IDS.join(' | ')}`,
    );
    process.exit(1);
  }

  const fixtureId = parseFixtureId(raw);
  const project = getFromScratchBasys3CertProjectById(fixtureId);
  const bundle = exportBasys3Bundle(project.circuit, project.ioMapping!);
  if (!bundle.valid) {
    console.error('exportBasys3Bundle invalid:', bundle.warnings.join('; '));
    process.exit(1);
  }

  const slug = deriveVivadoProjectSlug(project.meta?.projectId ?? project.name);
  const manifestText = encodeRBProject(project);
  const zipBytes = await buildVivadoProjectFolderZip({
    artifacts: [
      { path: 'project.rbproj.json', content: manifestText },
      { path: 'top.vhd', content: bundle.topVhd },
      { path: 'top.xdc', content: bundle.topXdc },
    ],
    projectName: project.name,
    projectSlug: slug,
    topModule: project.fpga?.top ?? 'top',
    part: resolveVivadoPart(project.fpga?.part),
  });

  const outDir = join(repoRoot, 'out/vivado-cert/from-scratch', fixtureId);
  const zipPath = join(outDir, `${slug}.zip`);
  const unpackDir = join(outDir, 'unpacked');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(zipPath, Buffer.from(zipBytes));

  mkdirSync(unpackDir, { recursive: true });
  execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${unpackDir.replace(/'/g, "''")}' -Force`,
    ],
    { stdio: 'inherit' },
  );

  const xpr = join(unpackDir, slug, `${slug}.xpr`);
  console.log(`[vivado-cert-from-scratch] fixture: ${fixtureId} (meta.projectKind=${project.meta?.projectKind})`);
  console.log(`[vivado-cert-from-scratch] zip: ${zipPath}`);
  console.log(`[vivado-cert-from-scratch] xpr: ${xpr}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
