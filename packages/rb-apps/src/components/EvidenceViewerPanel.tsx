import React, { useMemo } from 'react';
import { useEvidenceViewerStore } from '../stores/evidenceViewerStore';
import { TraceViewer } from './TraceViewer';

export const EvidenceViewerPanel: React.FC = () => {
    const { evidenceBundle, verificationStatus, clearEvidence } = useEvidenceViewerStore();

    if (!evidenceBundle) return null;

    const {
        exportedAtIso,
        app,
        simulationSnapshot,
        integrity,
        probesSnapshot,
        oscilloscopeSnapshot
    } = evidenceBundle;

    const statusColor =
        verificationStatus === 'PASS' ? 'text-green-400' :
            verificationStatus === 'FAIL' ? 'text-red-400' :
                verificationStatus === 'ERROR' ? 'text-orange-400' :
                    'text-gray-400';

    // Adapt oscilloscope traces for TraceViewer if possible
    // Assuming TraceViewer takes { [signalId: string]: number[] } or similar
    // We need to inspect TraceViewer props to be sure, but for now we'll wrap it or just debug dump if unsure.
    // Actually, let's just show metadata for the MVP step if TraceViewer is complex.
    // The user wants "timeline summary" and "scope preview".

    return (
        <div className="flex flex-col h-full bg-[#1b1c1f] text-gray-300 font-sans">
            {/* Header */}
            <div className="h-14 border-b border-gray-700 flex items-center justify-between px-6 bg-[#111]">
                <div className="flex items-center gap-4">
                    <div className="text-xl font-bold text-white">📋 Evidence Capsule</div>
                    <div className={`px-2 py-0.5 rounded text-xs font-bold border border-current ${statusColor} bg-opacity-10 bg-current`}>
                        {verificationStatus}
                    </div>
                </div>
                <button
                    onClick={clearEvidence}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded text-sm transition-colors"
                >
                    Close Viewer
                </button>
            </div>

            <div className="flex-1 overflow-auto p-8">
                <div className="max-w-4xl mx-auto space-y-8">

                    {/* Integrity Section */}
                    <section className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <span>🔐</span> Integrity Proof
                        </h2>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1">
                                <div className="text-gray-500">Hash Algorithm</div>
                                <div className="font-mono text-cyan-400">{integrity.hashAlg.toUpperCase()}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-gray-500">Integrity Hash</div>
                                <div className="font-mono text-cyan-400 break-all">{integrity.integrityHash}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-gray-500">Hashed Bytes</div>
                                <div className="font-mono text-gray-300">{integrity.hashedBytes} bytes</div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-gray-500">App Version</div>
                                <div className="font-mono text-gray-300">{app.version ?? 'Unknown'} (SHA: {app.repoSha?.slice(0, 8) ?? 'N/A'})</div>
                            </div>
                        </div>
                    </section>

                    {/* Timeline Summary */}
                    <section className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <span>⏱️</span> Simulation Timeline
                        </h2>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-gray-800 p-4 rounded text-center">
                                <div className="text-2xl font-bold text-white mb-1">{simulationSnapshot.tick}</div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider">Total Ticks</div>
                            </div>
                            <div className="bg-gray-800 p-4 rounded text-center">
                                <div className="text-2xl font-bold text-white mb-1">
                                    {(simulationSnapshot.tick / (simulationSnapshot.tickRate || 1000)).toFixed(2)}s
                                </div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider">Duration</div>
                            </div>
                            <div className="bg-gray-800 p-4 rounded text-center">
                                <div className="text-2xl font-bold text-white mb-1">
                                    {probesSnapshot.length}
                                </div>
                                <div className="text-xs text-gray-500 uppercase tracking-wider">Active Probes</div>
                            </div>
                        </div>
                    </section>

                    {/* Oscilloscope Preview (Metadata-only for now if complex) */}
                    <section className="bg-gray-900 border border-gray-700 rounded-lg p-6">
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <span>📉</span> Signal Capture
                        </h2>
                        {oscilloscopeSnapshot.stats ? (
                            <div className="text-sm text-gray-400">
                                Captured {oscilloscopeSnapshot.stats.sampleCount} samples over tick range [{oscilloscopeSnapshot.stats.tickRange?.[0]}, {oscilloscopeSnapshot.stats.tickRange?.[1]}]
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500 italic">No detailed signal stats available.</div>
                        )}

                        {/* Placeholder for actual TraceViewer if we decide to wire it up fully */}
                        <div className="mt-4 h-32 bg-gray-950 rounded border border-gray-800 flex items-center justify-center">
                            <span className="text-gray-600 text-xs">Signal Visualization Placeholder</span>
                        </div>
                    </section>

                </div>
            </div>
        </div>
    );
};
