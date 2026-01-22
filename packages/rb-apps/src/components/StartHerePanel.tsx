// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState } from 'react';

interface StartHerePanelProps {
    isOpen: boolean;
    onClose: () => void;
    onLoadExample: (exampleId: string) => void;
    onOpenOscilloscope: () => void;
}

// TODO: Import from docs/INSTRUCTOR_QUICKSTART.md when module system supports it
// For now, steps are hardcoded based on the instructor script
const TUTORIAL_STEPS = [
    {
        number: 1,
        title: 'Welcome to Logic Playground',
        description: 'Build, simulate, and understand digital logic circuits visually and interactively.',
    },
    {
        number: 2,
        title: 'Component Palette',
        description: 'Drag components from the left sidebar onto the canvas to build your circuit.',
    },
    {
        number: 3,
        title: 'Wiring Components',
        description: 'Click a port on one component, then click a port on another to connect them with a wire.',
    },
    {
        number: 4,
        title: 'Toggle Switches',
        description: 'Click on switches to change their state between 0 (OFF) and 1 (ON).',
    },
    {
        number: 5,
        title: 'Run Simulation',
        description: 'Press the Play button in the top toolbar to start the simulation and see signals flow.',
    },
    {
        number: 6,
        title: 'Observe Signal Flow',
        description: 'Watch as signals propagate through wires and gates in real-time.',
    },
    {
        number: 7,
        title: 'Try an Example',
        description: 'Load the D Flip-Flop example to see a working sequential circuit in action.',
    },
    {
        number: 8,
        title: 'Use the Oscilloscope',
        description: 'Add probes to signals and view them over time in the oscilloscope view.',
    },
    {
        number: 9,
        title: 'Keyboard Shortcuts',
        description: 'Press ? to see all available keyboard shortcuts for faster workflow.',
    },
    {
        number: 10,
        title: 'Save Your Work',
        description: 'Circuits auto-save every 5 seconds, or press Ctrl+S to save manually.',
    },
];

export const StartHerePanel: React.FC<StartHerePanelProps> = ({
    isOpen,
    onClose,
    onLoadExample,
    onOpenOscilloscope,
}) => {
    const [dontShowAgain, setDontShowAgain] = useState(false);

    const handleClose = () => {
        if (dontShowAgain) {
            localStorage.setItem('rb-start-here-dismissed', 'true');
        }
        onClose();
    };

    const handleLoadExample = () => {
        if (dontShowAgain) {
            localStorage.setItem('rb-start-here-dismissed', 'true');
        }
        onLoadExample('11_d-flipflop');
    };

    const handleOpenOscilloscope = () => {
        if (dontShowAgain) {
            localStorage.setItem('rb-start-here-dismissed', 'true');
        }
        onOpenOscilloscope();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-gradient-to-br from-gray-900 to-gray-950 border-2 border-cyan-500 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-800 bg-gradient-to-r from-cyan-900/20 to-purple-900/20 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400 mb-1">
                            🚀 Start Here
                        </h1>
                        <p className="text-gray-300 text-sm">
                            Your quick guide to building digital logic circuits
                        </p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                {/* Tutorial Steps */}
                <div className="p-6 overflow-y-auto max-h-[50vh]">
                    <div className="space-y-3">
                        {TUTORIAL_STEPS.map((step) => (
                            <div
                                key={step.number}
                                className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-cyan-500/50 transition-all"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-600/20 border border-cyan-500 flex items-center justify-center text-cyan-400 font-bold text-sm">
                                        {step.number}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white font-semibold mb-1">{step.title}</h3>
                                        <p className="text-gray-400 text-sm">{step.description}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Quick Actions */}
                    <div className="mt-6 p-4 bg-cyan-900/20 border border-cyan-500/30 rounded-lg">
                        <h3 className="text-cyan-400 font-bold mb-3 flex items-center gap-2">
                            <span>⚡</span> Quick Actions
                        </h3>
                        <div className="space-y-2">
                            <button
                                onClick={handleLoadExample}
                                className="w-full px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-semibold text-white transition-all shadow-lg text-left flex items-center gap-2"
                            >
                                <span>📘</span>
                                <span>Load D Flip-Flop Example</span>
                            </button>
                            <button
                                onClick={handleOpenOscilloscope}
                                className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg font-semibold text-white transition-all shadow-lg text-left flex items-center gap-2"
                            >
                                <span>📊</span>
                                <span>Open Oscilloscope + Probe Mode</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 bg-gray-900/50 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={dontShowAgain}
                            onChange={(e) => setDontShowAgain(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-2 focus:ring-cyan-500"
                        />
                        <span>Don't show this again</span>
                    </label>
                    <button
                        onClick={handleClose}
                        className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold text-white transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
