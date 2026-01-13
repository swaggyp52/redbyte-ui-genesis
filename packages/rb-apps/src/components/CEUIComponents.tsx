/**
 * Classroom Edition UI Components
 * 
 * - Reset Workspace Modal
 * - Example Gallery/Launcher
 * - Export/Submit Bundle Dialog
 */

import React, { useState, useCallback } from 'react';
import { getCEConfig } from '@redbyte/rb-utils';
import { clearAutosaveStorage } from '../utils/ceAutosave';
import type { Circuit } from '@redbyte/rb-logic-core';

/**
 * Reset Workspace Confirmation Modal
 */
interface ResetWorkspaceModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ResetWorkspaceModal: React.FC<ResetWorkspaceModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  const handleConfirm = () => {
    clearAutosaveStorage();
    onConfirm();
    // Reload page to reset app state
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-md">
        <h2 className="text-xl font-bold mb-4 text-cyan-400">Reset Workspace?</h2>
        <p className="text-gray-300 mb-2">
          This will:
        </p>
        <ul className="text-sm text-gray-400 mb-6 space-y-1">
          <li>• Clear all saved circuits and state</li>
          <li>• Close any open windows</li>
          <li>• Return to a fresh workspace</li>
        </ul>
        <p className="text-sm text-gray-400 mb-6">
          <strong>This action cannot be undone.</strong>
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 rounded font-medium transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Example Definition for CE Mode
 * Week 0-2 universal curriculum pack
 */
export interface CEExample {
  id: string;
  title: string;
  description: string;
  week: 0 | 1 | 2;
  category: 'orientation' | 'combinational' | 'selection' | 'sequential';
  circuit: Circuit;
  presetProbes?: Array<{ nodeId: string; port: string; label: string }>;
  suggestedTickRate?: number;
  docLink?: string;
}

/**
 * Example Gallery Modal
 */
interface ExampleGalleryModalProps {
  isOpen: boolean;
  examples: CEExample[];
  onSelectExample: (example: CEExample) => void;
  onClose: () => void;
}

export const ExampleGalleryModal: React.FC<ExampleGalleryModalProps> = ({
  isOpen,
  examples,
  onSelectExample,
  onClose,
}) => {
  const [selectedWeek, setSelectedWeek] = useState<0 | 1 | 2 | 'all'>('all');

  const filtered =
    selectedWeek === 'all' ? examples : examples.filter((e) => e.week === selectedWeek);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-cyan-400">Example Gallery</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Week Filter */}
        <div className="flex gap-2 mb-4">
          {['all', 0, 1, 2].map((week) => (
            <button
              key={week}
              onClick={() => setSelectedWeek(week as any)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                selectedWeek === week
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {week === 'all' ? 'All' : `Week ${week}`}
            </button>
          ))}
        </div>

        {/* Examples Grid */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid gap-3">
            {filtered.map((example) => (
              <button
                key={example.id}
                onClick={() => {
                  onSelectExample(example);
                  onClose();
                }}
                className="text-left p-4 bg-gray-700 hover:bg-gray-600 border border-gray-600 hover:border-cyan-500 rounded transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-cyan-400">{example.title}</h3>
                  <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400">
                    Week {example.week}
                  </span>
                </div>
                <p className="text-sm text-gray-300 mb-2">{example.description}</p>
                <p className="text-xs text-gray-500">
                  {example.circuit.nodes.length} nodes •{' '}
                  {example.circuit.connections.length} connections
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Export/Submit Bundle Dialog
 */
interface ExportBundleModalProps {
  isOpen: boolean;
  circuit: Circuit;
  exampleName?: string;
  onClose: () => void;
}

export const ExportBundleModal: React.FC<ExportBundleModalProps> = ({
  isOpen,
  circuit,
  exampleName,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const generateBundle = useCallback(() => {
    const bundle = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      exampleName: exampleName || 'Circuit',
      circuit,
      metadata: {
        nodeCount: circuit.nodes.length,
        connectionCount: circuit.connections.length,
      },
    };

    return JSON.stringify(bundle, null, 2);
  }, [circuit, exampleName]);

  const handleDownload = () => {
    const bundle = generateBundle();
    const blob = new Blob([bundle], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `circuit-${exampleName || 'export'}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    const bundle = generateBundle();
    navigator.clipboard.writeText(bundle).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-cyan-400">Export Circuit</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="mb-4 p-3 bg-gray-900 border border-gray-600 rounded text-sm text-gray-300">
          <p className="font-mono break-all">
            circuit-{exampleName || 'export'}-{Date.now()}.json
          </p>
        </div>

        <p className="text-sm text-gray-400 mb-6">
          Download your circuit as a JSON bundle, or copy it to submit to your LMS or share.
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleCopy}
            className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
              copied
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {copied ? 'Copied!' : 'Copy JSON'}
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium transition-colors"
          >
            Download
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-3 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};

/**
 * CE Control Bar Button
 * Simple button to trigger reset/examples/export
 */
interface CEControlButtonProps {
  action: 'reset' | 'examples' | 'export';
  onClick: () => void;
}

export const CEControlButton: React.FC<CEControlButtonProps> = ({
  action,
  onClick,
}) => {
  const config = getCEConfig();
  if (!config.enabled) return null;

  const labels = {
    reset: 'Reset',
    examples: 'Examples',
    export: 'Export',
  };

  const colors = {
    reset: 'bg-red-600 hover:bg-red-500',
    examples: 'bg-cyan-600 hover:bg-cyan-500',
    export: 'bg-blue-600 hover:bg-blue-500',
  };

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm ${colors[action]} text-white rounded font-medium transition-colors`}
      title={labels[action]}
    >
      {labels[action]}
    </button>
  );
};
