// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState } from 'react';
import type { AppProps } from '../types';
import BoardPanel from '../components/BoardPanel';

type ECELabMode = 'sim-only' | 'board-connected' | 'guided-lab';

export const ECELabAppComponent: React.FC<AppProps> = ({ windowId }) => {
    const [mode, setMode] = useState<ECELabMode>('sim-only');

    return (
        <div className="flex flex-col h-full bg-gray-900 text-gray-200">
            {/* App Toolbar / Mode Switcher */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-4">
                    <h1 className="text-sm font-bold text-gray-100 uppercase tracking-tight">ECE Lab</h1>

                    {/* Mode Switcher */}
                    <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700">
                        <button
                            onClick={() => setMode('sim-only')}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${mode === 'sim-only'
                                    ? 'bg-gray-700 text-white shadow-sm'
                                    : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Sim Only
                        </button>
                        <button
                            onClick={() => setMode('board-connected')}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${mode === 'board-connected'
                                    ? 'bg-cyan-900/50 text-cyan-200 shadow-sm border border-cyan-800/50'
                                    : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Board Connected
                        </button>
                        <button
                            onClick={() => setMode('guided-lab')}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${mode === 'guided-lab'
                                    ? 'bg-indigo-900/50 text-indigo-200 shadow-sm border border-indigo-800/50'
                                    : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Guided Lab
                        </button>
                    </div>
                </div>

                {/* Toolbar Actions placeholder */}
                <div className="text-xs text-gray-500">v1.0.0-MVP</div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">

                {/* LEFT PANE: Experiment Canvas (Placeholder) */}
                <div className="flex-1 flex flex-col border-r border-gray-800 bg-gray-900 relative">
                    <div className="absolute inset-0 flex items-center justify-center text-gray-600 flex-col gap-2">
                        <div className="text-4xl opacity-20">⚡</div>
                        <div className="text-sm font-medium">Experiment Canvas</div>
                        <div className="text-xs text-gray-500">
                            {mode === 'sim-only' && 'Build and simulate circuits here (Coming Soon)'}
                            {mode === 'board-connected' && 'Live hardware I/O visualization active'}
                            {mode === 'guided-lab' && 'Lab 1: Instructions & Checkpoints'}
                        </div>
                    </div>
                </div>

                {/* RIGHT PANE: Board Panel */}
                <div className="w-[360px] flex flex-col bg-gray-950 border-l border-gray-800">
                    <BoardPanel />
                </div>
            </div>
        </div>
    );
};
