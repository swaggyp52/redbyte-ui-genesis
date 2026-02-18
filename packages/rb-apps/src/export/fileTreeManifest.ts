// Copyright © 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * File Tree Manifest: Canonical listing of export artifacts with provenance.
 *
 * Represents the structured file tree that students see when exporting to Vivado:
 * - top.vhd (generated from circuit netlist)
 * - top.xdc (generated from ioMapping + Basys3 board)
 * - testbench.vhd (generated from test vectors, if present)
 * - README.txt (generated from project metadata)
 * - submodules/* (custom chips and HDL modules)
 */

import type { RBProject, SubmoduleEntry } from './projectFormat';
import { compareCodepoint } from './codepointSort';

export type FileProvenance = 'generated' | 'user' | 'imported';

export interface FileTreeEntry {
  path: string; // e.g., 'top.vhd', 'submodules/my_decoder.vhd'
  type: 'vhdl' | 'xdc' | 'testbench' | 'readme' | 'custom';
  provenance: FileProvenance;
  pipelineName?: string; // e.g., 'basys3-export', 'hdl-import', 'user-edit'
  sizeBytes?: number;
  checksumSha256?: string;
}

export interface FileTreeManifest {
  version: 1;
  projectName: string;
  createdAt: string;
  artifacts: FileTreeEntry[];
}

/**
 * Derive file tree manifest from RBProject.
 * Shows what artifacts will be generated during export.
 */
export const deriveFileTreeManifest = (project: RBProject): FileTreeManifest => {
  const artifacts: FileTreeEntry[] = [];

  const now = new Date().toISOString();

  // Always include generated top-level artifacts
  artifacts.push({
    path: 'top.vhd',
    type: 'vhdl',
    provenance: 'generated',
    pipelineName: 'basys3-export',
  });

  artifacts.push({
    path: 'top.xdc',
    type: 'xdc',
    provenance: 'generated',
    pipelineName: 'basys3-export',
  });

  artifacts.push({
    path: 'README.txt',
    type: 'readme',
    provenance: 'generated',
    pipelineName: 'basys3-export',
  });

  // Include testbench if test vectors are present
  if (project.vectors && project.vectors.length > 0) {
    artifacts.push({
      path: 'testbench.vhd',
      type: 'testbench',
      provenance: 'generated',
      pipelineName: 'basys3-export',
    });
  }

  // Include submodules if present
  const sortedSubmodules = project.submodules
    ? [...project.submodules].sort((a, b) => compareCodepoint(a.id, b.id))
    : [];

  for (const sub of sortedSubmodules) {
    const ext = sub.type === 'custom-chip' ? 'vhd' : 'vhd';
    artifacts.push({
      path: `submodules/${sub.name}.${ext}`,
      type: 'custom',
      provenance: 'generated',
      pipelineName: 'basys3-export',
    });
  }

  // Sort artifacts by path for deterministic ordering
  artifacts.sort((a, b) => compareCodepoint(a.path, b.path));

  return {
    version: 1,
    projectName: project.name,
    createdAt: now,
    artifacts,
  };
};
