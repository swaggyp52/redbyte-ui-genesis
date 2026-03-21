// Copyright © 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * FileTree — Display the export file tree manifest.
 * Shows canonical artifacts that will be generated during export.
 */

import React from 'react';
import type { FileTreeManifest, FileTreeEntry } from '../export/fileTreeManifest';

export interface FileTreeProps {
  manifest: FileTreeManifest;
}

const provenanceColor = (provenance: string): string => {
  switch (provenance) {
    case 'generated':
      return 'text-green-400';
    case 'user':
      return 'text-blue-400';
    case 'imported':
      return 'text-purple-400';
    default:
      return 'text-gray-400';
  }
};

const FileTreeEntry: React.FC<{ entry: FileTreeEntry }> = ({ entry }) => {
  const isSubmodule = entry.path.startsWith('submodules/');
  const fileName = isSubmodule ? entry.path.split('/')[1] : entry.path;

  return (
    <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 py-1 px-2 hover:bg-slate-800/50">
      <div className="flex items-center gap-2 flex-1 truncate">
        {isSubmodule && <span className="text-slate-600">├─</span>}
        <span className="truncate">{fileName}</span>
      </div>
      <span className={`ml-2 text-[10px] whitespace-nowrap ${provenanceColor(entry.provenance)}`}>
        {entry.provenance}
      </span>
      {entry.pipelineName && (
        <span className="ml-1 text-[9px] text-slate-500 whitespace-nowrap">{entry.pipelineName}</span>
      )}
    </div>
  );
};

export const FileTree: React.FC<FileTreeProps> = ({ manifest }) => {
  // Group artifacts by directory
  const topLevel = manifest.artifacts.filter((a) => !a.path.includes('/'));
  const submodules = manifest.artifacts.filter((a) => a.path.startsWith('submodules/'));

  return (
    <div className="mt-3 border-t border-slate-700">
      <div className="text-[10px] uppercase tracking-wide text-cyan-300 mt-2 mb-1 px-2">Export Artifacts</div>
      <div className="space-y-0.5">
        {/* Top-level artifacts */}
        {topLevel.length > 0 && (
          <div className="py-0.5">
            {topLevel.map((entry) => (
              <FileTreeEntry key={entry.path} entry={entry} />
            ))}
          </div>
        )}

        {/* Submodules section */}
        {submodules.length > 0 && (
          <div className="py-0.5 border-t border-slate-700/50">
            <div className="text-[10px] text-slate-500 px-2 py-1">Custom Modules</div>
            {submodules.map((entry) => (
              <FileTreeEntry key={entry.path} entry={entry} />
            ))}
          </div>
        )}

        {topLevel.length === 0 && submodules.length === 0 && (
          <div className="text-[10px] text-slate-500 px-2 py-1">(no artifacts)</div>
        )}
      </div>
    </div>
  );
};
