/**
 * Build Open Project ZIP from an in-repo IDE example or lab starter (for Vivado certification).
 *
 * Usage:
 *   pnpm exec tsx scripts/vivado-cert-export-ide-example.ts <example-id>
 *
 * Example IDs include `signal-tour`, `logic-gates`, `two-bit-counter`, and lab starter ids like `lab1-gates`.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IDE_EXAMPLES } from '../packages/rb-apps/src/apps/ide/examplesCatalog';
import { LAB_STARTERS } from '../packages/rb-apps/src/apps/ide/labStarters';
import type { IdeExampleDefinition } from '../packages/rb-apps/src/apps/ide/examplesCatalog';
import type { RBProject } from '../packages/rb-apps/src/export/projectFormat';
import { encodeRBProject } from '../packages/rb-apps/src/export/projectFormat';
import { exportBasys3Bundle } from '../packages/rb-apps/src/fpga/boards/basys3/basys3Bundle';
import {
  buildVivadoProjectFolderZip,
  deriveVivadoProjectSlug,
  resolveVivadoPart,
} from '../packages/rb-apps/src/fpga/vivado/vivadoProjectFolder';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

function findExample(id: string): IdeExampleDefinition | undefined {
  const fromCatalog = IDE_EXAMPLES.find((e) => e.id === id);
  if (fromCatalog) return fromCatalog;
  const fromLab = LAB_STARTERS.find((l) => l.id === id || l.example.id === id);
  return fromLab?.example;
}

function exampleToRbProject(ex: IdeExampleDefinition): RBProject {
  const now = '2026-04-23T12:00:00.000Z';
  return {
    kind: 'rb-project',
    version: 1,
    createdAt: now,
    updatedAt: now,
    name: ex.name,
    description: ex.summary,
    circuit: ex.circuit,
    ioMapping: {
      inputs: ex.ioRows
        .filter((r) => r.direction === 'in')
        .map((r) => ({
          id: r.id,
          nodeId: r.nodeId,
          port: r.port,
          label: r.label,
          pin: r.pin,
        })),
      outputs: ex.ioRows
        .filter((r) => r.direction === 'out')
        .map((r) => ({
          id: r.id,
          nodeId: r.nodeId,
          port: r.port,
          label: r.label,
          pin: r.pin,
        })),
    },
    vectors: ex.vectors,
    fpga: { board: 'basys3', part: 'xc7a35tcpg236-1', top: 'top' },
    meta: {
      projectId: ex.id,
      sourceExampleId: ex.id,
      tags: [...ex.tags, 'cert-export'],
    },
  };
}

async function main() {
  const id = process.argv[2]?.trim();
  if (!id) {
    console.error('usage: pnpm exec tsx scripts/vivado-cert-export-ide-example.ts <example-id>');
    process.exit(1);
  }

  const ex = findExample(id);
  if (!ex) {
    console.error(`unknown example id: ${id}`);
    process.exit(1);
  }

  const project = exampleToRbProject(ex);
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

  const outDir = join(repoRoot, 'out/vivado-cert/examples', id);
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
  console.log(`[vivado-cert-example] example: ${id}`);
  console.log(`[vivado-cert-example] zip: ${zipPath}`);
  console.log(`[vivado-cert-example] xpr: ${xpr}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
