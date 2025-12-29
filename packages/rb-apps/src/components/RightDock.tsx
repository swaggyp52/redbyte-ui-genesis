// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState } from 'react';
import type { Circuit, CircuitEngine } from '@redbyte/rb-logic-core';
import { PropertyInspector } from './PropertyInspector';

/**
 * Logic Playground vNext Right Dock
 *
 * Tabbed panel with:
 * - Inspector (selected node details, pin values, state)
 * - Probes/Scope (quick probe list + open scope)
 * - Chips (saved chips browse/insert)
 *
 * States: Collapsed / Peek / Expanded
 * Never overlaps the main stage
 */

export type RightDockTab = 'inspector' | 'probes' | 'chips';
export type RightDockState = 'collapsed' | 'peek' | 'expanded';

interface RightDockProps {
  circuit: Circuit;
  engine: CircuitEngine;
  isRunning: boolean;
  onNodeUpdate?: (nodeId: string, updates: any) => void;
  onConnectionDelete?: (connectionId: string) => void;

  // Probes tab
  probes?: Array<{ nodeId: string; portName: string }>;
  onProbeAdd?: (nodeId: string, portName: string) => void;
  onProbeRemove?: (nodeId: string, portName: string) => void;
  onOpenScope?: () => void;

  // Chips tab
  chips?: Array<{ id: string; name: string; description?: string }>;
  onChipInsert?: (chipId: string) => void;
  onChipDelete?: (chipId: string) => void;
  onChipEdit?: (chipId: string) => void;

  // State control
  initialTab?: RightDockTab;
  initialState?: RightDockState;
  onStateChange?: (state: RightDockState) => void;
}

export const RightDock: React.FC<RightDockProps> = ({
  circuit,
  engine,
  isRunning,
  onNodeUpdate,
  onConnectionDelete,
  probes = [],
  onProbeAdd,
  onProbeRemove,
  onOpenScope,
  chips = [],
  onChipInsert,
  onChipDelete,
  onChipEdit,
  initialTab = 'inspector',
  initialState = 'expanded',
  onStateChange,
}) => {
  const [activeTab, setActiveTab] = useState<RightDockTab>(initialTab);
  const [dockState, setDockState] = useState<RightDockState>(initialState);

  const handleStateToggle = () => {
    const nextState: RightDockState =
      dockState === 'collapsed' ? 'peek' : dockState === 'peek' ? 'expanded' : 'collapsed';
    setDockState(nextState);
    onStateChange?.(nextState);
  };

  if (dockState === 'collapsed') {
    return (
      <div className="w-12 border-l border-gray-700 bg-gray-900 flex flex-col items-center py-4 gap-4">
        {/* Collapsed tabs - vertical icons */}
        <button
          onClick={() => {
            setActiveTab('inspector');
            setDockState('peek');
          }}
          className="p-2 rounded hover:bg-gray-800 transition-colors"
          title="Inspector"
        >
          <span className="text-xl">🔍</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('probes');
            setDockState('peek');
          }}
          className="p-2 rounded hover:bg-gray-800 transition-colors"
          title="Probes"
        >
          <span className="text-xl">📊</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('chips');
            setDockState('peek');
          }}
          className="p-2 rounded hover:bg-gray-800 transition-colors"
          title="Chips"
        >
          <span className="text-xl">🧩</span>
        </button>
      </div>
    );
  }

  const width = dockState === 'peek' ? 'w-80' : 'w-96';

  return (
    <div className={`${width} border-l border-gray-700 bg-gray-900 flex flex-col transition-all duration-200`}>
      {/* Tab Bar */}
      <div className="h-10 border-b border-gray-700 bg-gray-850 flex items-center px-2 gap-1">
        <button
          onClick={() => setActiveTab('inspector')}
          className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-all ${
            activeTab === 'inspector'
              ? 'bg-cyan-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <span className="mr-1.5">🔍</span>
          Inspector
        </button>
        <button
          onClick={() => setActiveTab('probes')}
          className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-all ${
            activeTab === 'probes'
              ? 'bg-cyan-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <span className="mr-1.5">📊</span>
          Probes
        </button>
        <button
          onClick={() => setActiveTab('chips')}
          className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-all ${
            activeTab === 'chips'
              ? 'bg-cyan-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          <span className="mr-1.5">🧩</span>
          Chips
        </button>

        {/* Dock state toggle */}
        <button
          onClick={handleStateToggle}
          className="px-2 py-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
          title={dockState === 'peek' ? 'Expand' : 'Collapse'}
        >
          {dockState === 'peek' ? '→' : '←'}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'inspector' && (
          <PropertyInspector
            circuit={circuit}
            engine={engine}
            isRunning={isRunning}
            onNodeUpdate={onNodeUpdate}
            onConnectionDelete={onConnectionDelete}
          />
        )}

        {activeTab === 'probes' && (
          <div className="h-full p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-300">Signal Probes</h3>
              {onOpenScope && (
                <button
                  onClick={onOpenScope}
                  className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-500 rounded transition-colors"
                >
                  Open Scope
                </button>
              )}
            </div>

            {probes.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-2">📊</div>
                <div className="text-sm">No probes added</div>
                <div className="text-xs text-gray-500 mt-2">
                  Right-click a node output to add probe
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {probes.map((probe, i) => (
                  <div
                    key={`${probe.nodeId}-${probe.portName}`}
                    className="bg-gray-800/50 rounded p-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium text-white">{probe.portName}</div>
                      <div className="text-xs text-gray-400 font-mono truncate">{probe.nodeId}</div>
                    </div>
                    {onProbeRemove && (
                      <button
                        onClick={() => onProbeRemove(probe.nodeId, probe.portName)}
                        className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'chips' && (
          <div className="h-full p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">Saved Chips</h3>

            {chips.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-2">🧩</div>
                <div className="text-sm">No saved chips</div>
                <div className="text-xs text-gray-500 mt-2">
                  Build a circuit and save it as a chip
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {chips.map((chip) => (
                  <div
                    key={chip.id}
                    className="bg-gray-800/50 rounded p-3 hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => onChipInsert?.(chip.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-sm font-medium text-white">{chip.name}</div>
                      <div className="flex gap-1">
                        {onChipEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onChipEdit(chip.id);
                            }}
                            className="px-2 py-1 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20 rounded transition-colors"
                          >
                            Edit
                          </button>
                        )}
                        {onChipDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onChipDelete(chip.id);
                            }}
                            className="px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    {chip.description && (
                      <div className="text-xs text-gray-400">{chip.description}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
