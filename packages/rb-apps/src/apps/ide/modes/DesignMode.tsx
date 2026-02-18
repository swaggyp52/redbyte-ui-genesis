/**
 * DesignMode — 2D schematic editor and component palette.
 *
 * When the IDE is in "Design" mode, the left palette is visible, the canvas is
 * editable, and the right dock is collapsed to give maximum canvas space.
 *
 * Design mode owns: palette, drag-drop, chip library, quick-add, tutorial overlay,
 * starter instructions panel, and example notes.
 */

import React, { useState, useCallback } from 'react';
import { useIde } from '../IdeContext';
import { EnhancedPalette } from '../../../components/EnhancedPalette';
import { QuickAddPalette } from '../../../components/QuickAddPalette';
import { SaveChipModal } from '../../../components/SaveChipModal';
import { ChipLibraryModal } from '../../../components/ChipLibraryModal';
import type { RecognizedPattern } from '../../../patterns/patternMatcher';

export interface DesignModeProps {
  // ── Palette ──
  primitiveNodes: Record<string, readonly string[]>;
  compositeNodes: readonly string[];
  chips: Array<{ id: string; name: string; ports: unknown[] }>;
  onNodeDragStart: (nodeType: string, e?: React.DragEvent) => void;
  onAddNode: (nodeType: string, position?: { x: number; y: number }) => void;
  onChipLibraryOpen: () => void;
  getChipMetadata: (nodeType: string) => unknown;
  getNodeDescription: (nodeType: string) => string | undefined;
  isReplayMode: boolean;

  // ── Quick add ──
  showQuickAdd: boolean;
  onCloseQuickAdd: () => void;
  quickAddPosition: { x: number; y: number } | null;

  // ── Chip modals ──
  showChipLibrary: boolean;
  onCloseChipLibrary: () => void;
  allChips: Array<{ id: string; name: string; ports: unknown[] }>;
  onSelectChip: (chipId: string) => void;
  onDeleteChip: (chipId: string) => void;

  // ── Save chip ──
  showSaveChipModal: boolean;
  onCloseSaveChipModal: () => void;
  recognizedPattern: RecognizedPattern | null;
  onSaveChip: (name: string, pattern: RecognizedPattern) => void;
}

/**
 * DesignMode renders the left palette sidebar and design-specific modals.
 * The canvas and split-view are rendered by the shell (always visible).
 */
export const DesignMode: React.FC<DesignModeProps> = ({
  primitiveNodes,
  compositeNodes,
  chips,
  onNodeDragStart,
  onAddNode,
  onChipLibraryOpen,
  getChipMetadata,
  getNodeDescription,
  isReplayMode,
  showQuickAdd,
  onCloseQuickAdd,
  quickAddPosition,
  showChipLibrary,
  onCloseChipLibrary,
  allChips,
  onSelectChip,
  onDeleteChip,
  showSaveChipModal,
  onCloseSaveChipModal,
  recognizedPattern,
  onSaveChip,
}) => {
  return (
    <>
      {/* Left Sidebar - Component Palette */}
      <EnhancedPalette
        primitiveNodes={primitiveNodes}
        compositeNodes={compositeNodes}
        chips={chips}
        onNodeDragStart={onNodeDragStart}
        onAddNode={onAddNode}
        onChipLibraryOpen={onChipLibraryOpen}
        getChipMetadata={getChipMetadata}
        getNodeDescription={getNodeDescription}
        isReplayMode={isReplayMode}
      />

      {/* Quick Add Palette (Space key) */}
      {showQuickAdd && (
        <QuickAddPalette
          onSelect={(nodeType) => {
            onAddNode(nodeType, quickAddPosition ?? undefined);
            onCloseQuickAdd();
          }}
          onClose={onCloseQuickAdd}
          position={quickAddPosition}
        />
      )}

      {/* Save Chip Modal */}
      {showSaveChipModal && recognizedPattern && (
        <SaveChipModal
          isOpen={showSaveChipModal}
          onClose={onCloseSaveChipModal}
          pattern={recognizedPattern}
          onSave={onSaveChip}
        />
      )}

      {/* Chip Library Modal */}
      {showChipLibrary && (
        <ChipLibraryModal
          isOpen={showChipLibrary}
          onClose={onCloseChipLibrary}
          chips={allChips}
          onSelect={onSelectChip}
          onDelete={onDeleteChip}
        />
      )}
    </>
  );
};
