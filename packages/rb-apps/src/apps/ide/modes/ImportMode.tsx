/**
 * ImportMode — HDL and XDC import surfaces, plus Vivado zip import (v1.5).
 *
 * When the IDE is in "Import" mode, the right dock shows the import tab
 * where users can paste VHDL/Verilog/XDC or (v1.5) upload a zip of sources.
 *
 * Import mode owns: share link fallback modal, decode error modal.
 */

import React from 'react';
import { useIde } from '../IdeContext';
import { OverlayRoot, OverlayPanel } from '@redbyte/rb-primitives';

export interface ImportModeProps {
  // ── Share link fallback ──
  shareFallbackURL: string | null;
  onCopyShareLink: () => void;
  onCloseShareFallback: () => void;

  // ── Decode error ──
  showDecodeErrorModal: boolean;
  onCloseDecodeError: () => void;
  onClearURLAndReset: () => void;
}

/**
 * ImportMode renders the share-link and decode-error modals.
 * The ImportPanel itself is rendered inside the right dock by the shell.
 * XDC import (xdcImport.ts) and zip import (zipImport.ts) will be added in Milestone 6.
 */
export const ImportMode: React.FC<ImportModeProps> = ({
  shareFallbackURL,
  onCopyShareLink,
  onCloseShareFallback,
  showDecodeErrorModal,
  onCloseDecodeError,
  onClearURLAndReset,
}) => {
  return (
    <>
      {/* Clipboard Fallback Modal */}
      {shareFallbackURL && (
        <OverlayRoot className="bg-black bg-opacity-50 flex items-center justify-center">
          <OverlayPanel className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-2xl w-full mx-4">
            <h3 className="text-lg font-semibold mb-3 text-white">Share Link Ready</h3>
            <p className="text-sm text-gray-300 mb-4">
              Automatic clipboard copy failed. Please copy the link manually:
            </p>
            <input
              type="text"
              readOnly
              value={shareFallbackURL}
              onClick={(e) => e.currentTarget.select()}
              aria-label="Share link"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white font-mono text-sm mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={onCopyShareLink}
                className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded text-white text-sm"
              >
                Copy
              </button>
              <button
                onClick={onCloseShareFallback}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
              >
                Close
              </button>
            </div>
          </OverlayPanel>
        </OverlayRoot>
      )}

      {/* Decode Error Modal */}
      {showDecodeErrorModal && (
        <OverlayRoot className="bg-black bg-opacity-50 flex items-center justify-center">
          <OverlayPanel className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full mx-4" data-testid="ide-mode-import-error">
            <h3 className="text-lg font-semibold mb-3 text-red-400">Invalid Share Link</h3>
            <p className="text-sm text-gray-300 mb-4">
              This share link is invalid or corrupted. The circuit could not be loaded.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={onClearURLAndReset}
                className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded text-white text-sm"
              >
                Clear URL &amp; Start Fresh
              </button>
              <button
                onClick={onCloseDecodeError}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
              >
                Close
              </button>
            </div>
          </OverlayPanel>
        </OverlayRoot>
      )}
    </>
  );
};
