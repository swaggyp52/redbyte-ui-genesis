/**
 * ExportMode — Canonical Basys3 export authority.
 *
 * This is the ONLY place where students export to Vivado.
 * All exports go through basys3ExportService.
 * No alternate paths. No side pipelines.
 *
 * When the IDE is in "Export" mode, the right dock shows:
 * - Current export status (errors, warnings)
 * - File tree manifest (what will be exported)
 * - Download buttons for each artifact
 * - Determinism hash for verification
 */

import React, { useMemo } from 'react';
import { useIde } from '../IdeContext';
import { deriveFileTreeManifest } from '../../../export/fileTreeManifest';
import { exportProjectAsBasys3, type Basys3ExportResult } from '../../../fpga/boards/basys3/basys3ExportService';
import { encodeRBProject } from '../../../export/projectFormat';

export interface ExportModeProps {
  // Placeholder for future modal/UI expansion
}

/**
 * ExportMode renders the Basys3 export panel.
 * Shows validation status, file tree, and download controls.
 */
export const ExportMode: React.FC<ExportModeProps> = () => {
  const { projectName, buildProject } = useIde();
  const project = buildProject();

  // Compute export result (memoized to avoid repeated exports)
  const exportResult: Basys3ExportResult = useMemo(() => {
    return exportProjectAsBasys3(project);
  }, [project]);

  const manifest = useMemo(() => deriveFileTreeManifest(project), [project]);

  // Helper to download artifact as file
  const downloadArtifact = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadVhd = () => {
    if (exportResult.bundle?.topVhd) {
      downloadArtifact('top.vhd', exportResult.bundle.topVhd);
    }
  };

  const handleDownloadXdc = () => {
    if (exportResult.bundle?.topXdc) {
      downloadArtifact('top.xdc', exportResult.bundle.topXdc);
    }
  };

  const handleDownloadReadme = () => {
    if (exportResult.bundle?.readme) {
      downloadArtifact('README.txt', exportResult.bundle.readme);
    }
  };

  const handleDownloadZip = () => {
    // TODO: Implement zip download containing all artifacts
    console.log('Zip download not yet implemented');
  };

  return (
    <div data-testid="ide-mode-export" className="absolute top-3 left-3 z-20 max-w-2xl pointer-events-auto">
      <div className="bg-slate-900/95 border border-slate-700 rounded-lg px-4 py-3 text-xs shadow-lg max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wide text-cyan-300 mb-1">Export to Basys3</div>
          <div className="text-sm font-semibold text-white">{projectName}</div>
        </div>

        {/* Status Section */}
        <div className="mb-3 border-t border-slate-700 pt-3">
          <div className="text-[10px] uppercase tracking-wide text-cyan-300 mb-2">Status</div>

          {/* Errors */}
          {exportResult.errors.length > 0 && (
            <div className="mb-2">
              {exportResult.errors.map((error, idx) => (
                <div
                  key={idx}
                  className={`text-[10px] px-2 py-1 rounded mb-1 font-mono ${
                    error.severity === 'error'
                      ? 'bg-red-900/30 text-red-300 border border-red-700/50'
                      : 'bg-amber-900/30 text-amber-300 border border-amber-700/50'
                  }`}
                >
                  <span className="font-bold">[{error.severity}]</span> {error.message}
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {exportResult.warnings.length > 0 && (
            <div className="mb-2">
              {exportResult.warnings.slice(0, 5).map((warning, idx) => (
                <div key={idx} className="text-[10px] px-2 py-1 rounded mb-1 font-mono bg-amber-900/20 text-amber-300">
                  ⚠ {warning}
                </div>
              ))}
              {exportResult.warnings.length > 5 && (
                <div className="text-[10px] text-slate-400 px-2">
                  +{exportResult.warnings.length - 5} more warnings
                </div>
              )}
            </div>
          )}

          {exportResult.success && (
            <div className="text-[10px] px-2 py-1 rounded bg-green-900/30 text-green-300 border border-green-700/50 font-semibold">
              ✓ Ready for Vivado export
            </div>
          )}
        </div>

        {/* Determinism Hash */}
        {exportResult.determinismHash && (
          <div className="mb-3 border-t border-slate-700 pt-3">
            <div className="text-[10px] text-slate-400">
              Determinism Hash
              <br />
              <span className="font-mono text-[9px] text-slate-500">{exportResult.determinismHash.substring(0, 16)}...</span>
            </div>
          </div>
        )}

        {/* File Tree Manifest */}
        <div className="mb-3 border-t border-slate-700 pt-3">
          <div className="text-[10px] uppercase tracking-wide text-cyan-300 mb-2">Export Artifacts</div>
          <div className="space-y-1">
            {manifest.artifacts.map((artifact) => (
              <div key={artifact.path} className="flex items-center justify-between text-[10px] font-mono text-slate-300">
                <span>{artifact.path}</span>
                <span className="text-[9px] text-slate-500">[{artifact.provenance}]</span>
              </div>
            ))}
          </div>
        </div>

        {/* Download Controls */}
        {exportResult.success && exportResult.bundle && (
          <div className="border-t border-slate-700 pt-3">
            <div className="text-[10px] uppercase tracking-wide text-cyan-300 mb-2">Download</div>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={handleDownloadVhd}
                className="px-2 py-1.5 rounded text-[10px] bg-green-700/50 border border-green-600 text-green-300 hover:bg-green-700 transition-colors"
              >
                top.vhd
              </button>
              <button
                type="button"
                onClick={handleDownloadXdc}
                className="px-2 py-1.5 rounded text-[10px] bg-green-700/50 border border-green-600 text-green-300 hover:bg-green-700 transition-colors"
              >
                top.xdc
              </button>
              <button
                type="button"
                onClick={handleDownloadReadme}
                className="px-2 py-1.5 rounded text-[10px] bg-green-700/50 border border-green-600 text-green-300 hover:bg-green-700 transition-colors"
              >
                README.txt
              </button>
              <button
                type="button"
                onClick={handleDownloadZip}
                className="px-2 py-1.5 rounded text-[10px] bg-cyan-700/50 border border-cyan-600 text-cyan-300 hover:bg-cyan-700 transition-colors"
              >
                All (.zip)
              </button>
            </div>
          </div>
        )}

        {!exportResult.success && (
          <div className="border-t border-slate-700 pt-3">
            <div className="text-[10px] text-slate-400">
              Fix errors above before export.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
