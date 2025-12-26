// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useMemo } from 'react';
import type { ChipDefinition } from '../stores/chipStore';

export interface ChipLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  chips: ChipDefinition[];
  onSelectChip: (chipId: string) => void;
  onDeleteChip?: (chipId: string) => void;
  onDragStart?: (chipName: string, e?: React.DragEvent) => void;
}

export const ChipLibraryModal: React.FC<ChipLibraryModalProps> = ({
  isOpen,
  onClose,
  chips,
  onSelectChip,
  onDeleteChip,
  onDragStart,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLayer, setSelectedLayer] = useState<number | null>(null);

  // Filter chips by search query and layer
  const filteredChips = useMemo(() => {
    return chips.filter((chip) => {
      const matchesSearch =
        searchQuery === '' ||
        chip.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chip.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesLayer = selectedLayer === null || chip.layer === selectedLayer;

      return matchesSearch && matchesLayer;
    });
  }, [chips, searchQuery, selectedLayer]);

  // Group chips by layer
  const chipsByLayer = useMemo(() => {
    const grouped: Record<number, ChipDefinition[]> = {};
    filteredChips.forEach((chip) => {
      if (!grouped[chip.layer]) {
        grouped[chip.layer] = [];
      }
      grouped[chip.layer].push(chip);
    });
    return grouped;
  }, [filteredChips]);

  // Get unique layers
  const layers = useMemo(() => {
    const layerSet = new Set(chips.map((c) => c.layer));
    return Array.from(layerSet).sort((a, b) => a - b);
  }, [chips]);

  const handleSelectChip = (chipId: string) => {
    onSelectChip(chipId);
    onClose();
  };

  const handleDeleteChip = (e: React.MouseEvent, chipId: string) => {
    e.stopPropagation();
    if (onDeleteChip && confirm('Delete this chip? This action cannot be undone.')) {
      onDeleteChip(chipId);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Chip Library</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Search and Filters */}
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Search chips..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={selectedLayer ?? ''}
              onChange={(e) => setSelectedLayer(e.target.value === '' ? null : Number(e.target.value))}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Layers</option>
              {layers.map((layer) => (
                <option key={layer} value={layer}>
                  Layer {layer}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Chip List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filteredChips.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              {chips.length === 0 ? (
                <>
                  <p className="text-lg mb-2">No chips saved yet</p>
                  <p className="text-sm">
                    Build a circuit and click "Save as Chip" to create your first reusable component!
                  </p>
                </>
              ) : (
                <p>No chips match your search</p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(chipsByLayer)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([layer, layerChips]) => (
                  <div key={layer}>
                    <h3 className="text-sm font-semibold text-gray-400 mb-3">Layer {layer}</h3>
                    <div className="space-y-2">
                      {layerChips.map((chip) => (
                        <div
                          key={chip.id}
                          draggable={!!onDragStart}
                          onDragStart={(e) => {
                            if (onDragStart) {
                              e.stopPropagation();
                              onDragStart(chip.name, e);
                              // Close modal after drag starts successfully
                              setTimeout(() => onClose(), 100);
                            }
                          }}
                          onDragEnd={() => {
                            // Ensure modal stays closed after drag
                          }}
                          onClick={(e) => {
                            // Prevent click if dragging
                            handleSelectChip(chip.id);
                          }}
                          className="bg-gray-700 hover:bg-gray-650 rounded-lg p-4 cursor-move transition-colors group"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-white font-medium">{chip.name}</h4>
                                <span className="text-xs text-gray-400">L{chip.layer}</span>
                              </div>
                              <p className="text-sm text-gray-400 mb-2">{chip.description}</p>
                              <div className="flex gap-4 text-xs text-gray-500">
                                <span>{chip.inputs.length} inputs</span>
                                <span>{chip.outputs.length} outputs</span>
                                <span>
                                  {chip.subcircuit.nodes.length} gates
                                </span>
                              </div>
                            </div>
                            {onDeleteChip && (
                              <button
                                onClick={(e) => handleDeleteChip(e, chip.id)}
                                className="text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-4"
                                aria-label="Delete chip"
                              >
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-between items-center">
          <div className="text-sm text-gray-400">
            {filteredChips.length} {filteredChips.length === 1 ? 'chip' : 'chips'}
            {selectedLayer !== null && ` in Layer ${selectedLayer}`}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
