// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useRef, useState } from 'react';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { ChipPort } from '../stores/chipStore';
import type { RecognizedPattern } from '../patterns/patternMatcher';
import { suggestChipPorts, validateChipPorts } from '../utils/chipUtils';

interface SaveChipModalProps {
  circuit: Circuit;
  recognizedPattern: RecognizedPattern | null;
  onSave: (
    name: string,
    description: string,
    layer: number,
    inputs: ChipPort[],
    outputs: ChipPort[]
  ) => void;
  onCancel: () => void;
}

export const SaveChipModal: React.FC<SaveChipModalProps> = ({
  circuit,
  recognizedPattern,
  onSave,
  onCancel,
}) => {
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Initialize with pattern data if available
  const [name, setName] = useState(recognizedPattern?.name || 'My Chip');
  const [description, setDescription] = useState(recognizedPattern?.description || '');
  const [layer, setLayer] = useState(recognizedPattern?.layer || 1);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect ports from circuit
  const suggestedPorts = suggestChipPorts(circuit);
  const [inputs] = useState<ChipPort[]>(suggestedPorts.inputs);
  const [outputs] = useState<ChipPort[]>(suggestedPorts.outputs);

  useEffect(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, []);

  const handleSave = () => {
    // Validate inputs
    if (!name.trim()) {
      setError('Chip name is required');
      return;
    }

    if (inputs.length === 0 && outputs.length === 0) {
      setError('Chip must have at least one input or output port');
      return;
    }

    const validation = validateChipPorts(circuit, inputs, outputs);
    if (!validation.valid) {
      setError(validation.errors.join(', '));
      return;
    }

    onSave(name.trim(), description.trim(), layer, inputs, outputs);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    } else if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      handleSave();
    }
  };

  const layerColors: Record<number, string> = {
    0: 'bg-gray-500',
    1: 'bg-blue-500',
    2: 'bg-green-500',
    3: 'bg-amber-500',
    4: 'bg-red-500',
    5: 'bg-purple-500',
    6: 'bg-pink-500',
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-[500px] p-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h3 className="text-lg font-semibold text-white mb-4">Save as Chip</h3>

        {recognizedPattern && (
          <div className="mb-4 px-3 py-2 bg-cyan-900/30 border border-cyan-700/50 rounded text-sm text-cyan-300">
            Recognized pattern: <span className="font-semibold">{recognizedPattern.name}</span>
          </div>
        )}

        <div className="space-y-4 mb-4">
          {/* Name */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">Chip Name</label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-cyan-500"
              placeholder="XOR Gate"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:outline-none focus:border-cyan-500 resize-none"
              rows={2}
              placeholder="What does this chip do?"
            />
          </div>

          {/* Layer */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">Layer</label>
            <div className="flex gap-2">
              {[0, 1, 2, 3, 4, 5, 6].map((l) => (
                <button
                  key={l}
                  onClick={() => setLayer(l)}
                  className={`px-3 py-1 rounded text-sm font-semibold transition-all ${
                    layer === l
                      ? `${layerColors[l]} text-white`
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Port Summary */}
          <div>
            <label className="block text-sm text-slate-300 mb-2">Ports (auto-detected)</label>
            <div className="bg-slate-800 border border-slate-600 rounded p-3 text-sm">
              <div className="flex gap-4">
                <div className="flex-1">
                  <span className="text-cyan-400 font-semibold">Inputs:</span>{' '}
                  <span className="text-white">
                    {inputs.length > 0 ? inputs.map((i) => i.name).join(', ') : 'None'}
                  </span>
                </div>
                <div className="flex-1">
                  <span className="text-amber-400 font-semibold">Outputs:</span>{' '}
                  <span className="text-white">
                    {outputs.length > 0 ? outputs.map((o) => o.name).join(', ') : 'None'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded bg-slate-800 hover:bg-slate-700 text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm rounded bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
          >
            Save Chip
          </button>
        </div>

        <div className="mt-3 text-xs text-slate-500 text-center">
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Ctrl+Enter</kbd> Save{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Esc</kbd> Cancel
        </div>
      </div>
    </div>
  );
};
