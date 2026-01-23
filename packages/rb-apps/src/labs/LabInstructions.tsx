// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState } from 'react';
import { useLabStore } from './labStore';
import { LAB_1_CONTENT, LAB_2_CONTENT, LABS } from './labContent';
import { useHardwareStore } from '../stores/hardwareStore';
import { getSignalMap } from './signalMap'; // Need SignalMap (relative import might need adjustment)
import { exportEvidenceCapsule } from '../utils/evidenceExport';

// Simple parser for our specific lab content format
const SimpleMarkdown: React.FC<{ content: string }> = ({ content }) => {
    const lines = content.split('\n');
    return (
        <div className="space-y-1 text-sm">
            {lines.map((line, i) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={i} className="h-2" />; // Spacer

                // Headers
                if (trimmed.startsWith('# ')) {
                    return (
                        <h1 key={i} className="text-xl font-bold text-gray-100 mb-4 pb-2 border-b border-gray-700">
                            {trimmed.slice(2)}
                        </h1>
                    );
                }
                if (trimmed.startsWith('## ')) {
                    return (
                        <h2 key={i} className="text-lg font-semibold text-gray-200 mt-4 mb-2">
                            {trimmed.slice(3)}
                        </h2>
                    );
                }

                // Lists
                if (trimmed.match(/^\d+\./)) {
                    return (
                        <div key={i} className="flex gap-2 ml-2 text-gray-300">
                            <span className="font-mono text-gray-500 select-none">{trimmed.split(' ')[0]}</span>
                            <span>{renderInline(trimmed.replace(/^\d+\.\s*/, ''))}</span>
                        </div>
                    );
                }
                if (trimmed.startsWith('* ')) {
                    return (
                        <div key={i} className="flex gap-2 ml-4 text-gray-300">
                            <span className="text-gray-500">•</span>
                            <span>{renderInline(trimmed.slice(2))}</span>
                        </div>
                    );
                }

                // Default paragraph
                return (
                    <p key={i} className="text-gray-400 leading-relaxed">
                        {renderInline(trimmed)}
                    </p>
                );
            })}
        </div>
    );
};

// Helper to render bold text
function renderInline(text: string): React.ReactNode {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index} className="text-cyan-400 font-bold">{part.slice(2, -2)}</strong>;
        }
        return part;
    });
}

// Sub-component for Checkpoint Verification
const CheckpointVerifier: React.FC<{ signal: string, expected: number, stepIndex: number }> = ({ signal, expected, stepIndex }) => {
    const ioSnapshot = useHardwareStore(s => s.ioSnapshot);
    const capabilities = useHardwareStore(s => s.capabilities);
    const markComplete = useLabStore(s => s.markComplete);
    const [error, setError] = useState<string | null>(null);

    const handleVerify = () => {
        if (!ioSnapshot || !capabilities) {
            setError("No snapshot yet—connect first");
            return;
        }

        // Resolve signal to IO
        // Note: signalMap is in ../labs/signalMap
        // We need to import it properly. Assuming import is correct or adjusted.
        // It resides in current directory? No, 'getSignalMap' was imported from './signalMap'.
        // Wait, 'signalMap' is in 'packages/rb-apps/src/labs/signalMap'.
        // This file is in 'packages/rb-apps/src/labs/'.
        // So import { getSignalMap } from './signalMap' is correct.

        const map = getSignalMap(capabilities.boardId);
        const loc = map[signal];
        if (!loc) {
            setError(`Signal ${signal} not mapped.`);
            return;
        }

        // Get value
        let observed = -1;
        if (loc.group === 'LED') {
            const val = typeof ioSnapshot.outputs.LED === 'number'
                ? ioSnapshot.outputs.LED
                : parseInt(String(ioSnapshot.outputs.LED), 2);
            observed = (val >> loc.bit) & 1;
        } else if (loc.group === 'SW') {
            // Maybe we verify switch state too?
            const val = typeof ioSnapshot.inputs.SW === 'number'
                ? ioSnapshot.inputs.SW
                : parseInt(String(ioSnapshot.inputs.SW), 2);
            observed = (val >> loc.bit) & 1;
        }

        if (observed === expected) {
            markComplete(stepIndex);
            setError(null);
            // Optional: You could set a 'success message' state here if you want ephemeral feedback
        } else {
            setError(`Verification failed. Observed: ${observed}, Expected: ${expected}`);
        }
    };

    return (
        <div>

            <button
                onClick={handleVerify}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded shadow-sm border border-gray-600"
            >
                VERIFY NOW
            </button>
            {error && <div className="mt-2 text-xs text-red-400 font-mono animate-pulse">{error}</div>}
        </div>
    );
};

// Sub-component for Export
const ExportButton: React.FC = () => {
    const activeLabId = useLabStore(s => s.activeLabId);
    const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

    const handleExport = async () => {
        setStatus('saving');
        const filename = `${activeLabId}-evidence-${Date.now()}.json`;
        const ok = await exportEvidenceCapsule(filename);
        setStatus(ok ? 'done' : 'error');
    };

    return (
        <button
            onClick={handleExport}
            disabled={status === 'done'}
            className={`px-6 py-2 rounded-lg font-bold text-sm shadow-md transition-all ${status === 'done'
                ? 'bg-green-600 text-white cursor-default'
                : 'bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105'
                }`}
        >
            {status === 'idle' && 'Export Evidence Capsule'}
            {status === 'saving' && 'Saving...'}
            {status === 'done' && '✓ Saved to Files'}
            {status === 'error' && 'Retry Export'}
        </button>
    );
};

export const LabInstructions: React.FC = () => {
    const activeLabId = useLabStore(s => s.activeLabId);
    const setActiveLab = useLabStore(s => s.setActiveLab);
    const currentStepIndex = useLabStore(s => s.currentStepIndex);
    const completedSteps = useLabStore(s => s.completedSteps);
    const nextStep = useLabStore(s => s.nextStep);
    const prevStep = useLabStore(s => s.prevStep);

    const content = LABS[activeLabId] || LABS['lab-1'];
    const step = content[currentStepIndex];
    if (!step) return null;

    const isFirst = currentStepIndex === 0;
    const isLast = currentStepIndex === content.length - 1;
    const isCompleted = completedSteps.includes(currentStepIndex);

    return (
        <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
            {/* Header / Progress */}
            <div className="p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-400">LAB:</span>
                        <select
                            value={activeLabId}
                            onChange={(e) => setActiveLab(e.target.value)}
                            className="bg-gray-800 text-xs text-white border border-gray-600 rounded px-2 py-0.5 focus:outline-none focus:border-indigo-500"
                            title="Select Lab"
                        >
                            <option value="lab-1">Lab 1: Intro</option>
                            <option value="lab-2">Lab 2: Logic</option>
                        </select>
                    </div>
                    <span>Step {currentStepIndex + 1} of {content.length}</span>
                </div>
                <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                    <div
                        className="bg-indigo-500 h-full transition-all duration-300 ease-out"
                        style={{ width: `${((currentStepIndex + 1) / content.length) * 100}%` }}
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 scrollbar-thin scrollbar-thumb-gray-700">
                <SimpleMarkdown content={step.markdown} />

                {/* Checkpoint Status Indicator */}
                {step.checkpoint && (
                    <div className={`mt-8 p-4 rounded-lg border ml-1 transition-colors ${isCompleted
                        ? 'border-green-800 bg-green-900/20'
                        : 'border-yellow-800 bg-yellow-900/10'}`
                    }>
                        <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${isCompleted ? 'text-green-400' : 'text-yellow-500'}`}>
                            Checkpoint
                        </div>
                        <div className="text-sm text-gray-300 mb-2">
                            {step.checkpoint.description}
                        </div>
                        <div className="text-xs font-mono text-gray-500 mb-3">
                            Signal: <span className="text-cyan-400">{step.checkpoint.signal}</span>
                            {' '} Expect: <span className="text-white">{step.checkpoint.expectedValue}</span>
                        </div>

                        {isCompleted ? (
                            <div className="mt-2 flex items-center text-green-400 text-sm font-medium">
                                <span className="mr-2">✓</span> Verified
                            </div>
                        ) : (
                            <CheckpointVerifier
                                signal={step.checkpoint.signal}
                                expected={step.checkpoint.expectedValue}
                                stepIndex={currentStepIndex}
                            />
                        )}
                    </div>
                )}

                {/* Export Evidence (Contextual on last step) */}
                {step.id === 'completion' && (
                    <div className="mt-8 p-6 bg-indigo-900/20 border border-indigo-800 rounded-xl text-center">
                        <h3 className="text-lg font-bold text-indigo-200 mb-2">Lab Completed</h3>
                        <p className="text-sm text-gray-400 mb-4">Export your trace and progress report.</p>
                        <ExportButton />
                    </div>
                )}
            </div>

            {/* Navigation */}
            <div className="p-4 border-t border-gray-800 flex justify-between bg-gray-900">
                <button
                    onClick={prevStep}
                    disabled={isFirst}
                    className={`px-4 py-2 text-xs font-medium rounded transition-colors ${isFirst
                        ? 'text-gray-600 cursor-not-allowed'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                        }`}
                >
                    Back
                </button>
                <button
                    onClick={nextStep}
                    disabled={isLast}
                    className={`px-4 py-2 text-xs font-medium rounded transition-colors shadow-lg ${isLast
                        ? 'text-gray-600 bg-gray-800 cursor-not-allowed opacity-0' // Hide next on last step used to be hidden
                        : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-900/20'
                        }`}
                >
                    Next Step →
                </button>
            </div>
        </div>
    );
};
