// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useMemo } from 'react';
import type { IOSnapshot } from '../services/hardwareClient';

export interface CompareSignalCheck {
    signalName: string;
    expected: number | string;
    observed: number | string;
    pass: boolean;
}

interface CompareViewProps {
    className?: string;
    ioSnapshot: IOSnapshot | null;
    checks: CompareSignalCheck[];
}

export const CompareView: React.FC<CompareViewProps> = ({
    className = '',
    ioSnapshot,
    checks
}) => {
    const stats = useMemo(() => {
        const total = checks.length;
        const passing = checks.filter(c => c.pass).length;
        const failing = total - passing;
        const percent = total > 0 ? Math.round((passing / total) * 100) : 0;
        return { total, passing, failing, percent };
    }, [checks]);

    if (!ioSnapshot && checks.length === 0) {
        return (
            <div className={`flex flex-col items-center justify-center h-full text-gray-500 text-xs font-mono p-8 text-center ${className}`}>
                <div className="mb-2 text-cyan-900 opacity-50 text-4xl">⇄</div>
                <div>NO SIGNALS MAPPED</div>
                <div className="text-[10px] mt-1 opacity-50">Select a board to view signals</div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full ${className}`} style={{ background: '#05080a' }}>
            {/* Header / Stats */}
            <div className="p-3 border-b border-[#1a2a3a] bg-[#081018]">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-bold text-gray-200 tracking-wider">SIGNAL COMPARISON</h2>
                    <div className="text-[10px] font-mono text-gray-500">
                        TICK: <span className="text-cyan-400">{ioSnapshot ? ioSnapshot.tick : '---'}</span>
                    </div>
                </div>

                <div className="flex gap-2">
                    <div className="flex-1 bg-[#0a1520] border border-[#1a2a3a] rounded p-2 flex flex-col items-center">
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Match</span>
                        <span className="text-lg font-mono text-[#00ff88] font-bold" style={{ textShadow: '0 0 10px rgba(0,255,136,0.3)' }}>
                            {stats.percent}%
                        </span>
                    </div>
                    <div className="flex-1 bg-[#0a1520] border border-[#1a2a3a] rounded p-2 flex flex-col items-center">
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Check</span>
                        <span className="text-lg font-mono text-cyan-400 font-bold">
                            {stats.total}
                        </span>
                    </div>
                    <div className="flex-1 bg-[#0a1520] border border-[#1a2a3a] rounded p-2 flex flex-col items-center">
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Fail</span>
                        <span className={`text-lg font-mono font-bold ${stats.failing > 0 ? 'text-red-500' : 'text-gray-600'}`} style={stats.failing > 0 ? { textShadow: '0 0 10px rgba(255,0,0,0.3)' } : {}}>
                            {stats.failing}
                        </span>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-[#0a1520] text-[10px] text-gray-500 sticky top-0 z-10 font-bold tracking-wider uppercase">
                        <tr>
                            <th className="p-2 border-b border-[#1a2a3a]">Signal</th>
                            <th className="p-2 border-b border-[#1a2a3a] text-right">Sim</th>
                            <th className="p-2 border-b border-[#1a2a3a] text-right">HW</th>
                            <th className="p-2 border-b border-[#1a2a3a] text-center">Stat</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs font-mono divide-y divide-[#1a2a3a]">
                        {checks.map((check) => {
                            const isMismatch = !check.pass;
                            return (
                                <tr key={check.signalName} className={`transition-colors hover:bg-[#102030] ${isMismatch ? 'bg-[#2a1010] bg-opacity-30' : ''}`}>
                                    <td className="p-2 text-cyan-300 font-semibold">{check.signalName}</td>
                                    <td className="p-2 text-right text-gray-400">{check.expected}</td>
                                    <td className="p-2 text-right text-gray-400">{check.observed}</td>
                                    <td className="p-2 text-center">
                                        {isMismatch ? (
                                            <span className="inline-block w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(255,0,0,0.8)]" title="Mismatch" />
                                        ) : (
                                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00ff88] opacity-30" title="Match" />
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {(!ioSnapshot) && (
                    <div className="p-4 text-center text-[10px] text-orange-400 bg-orange-950/20 border-t border-orange-900/30">
                        ⚠ Hardware not connected
                    </div>
                )}
            </div>
        </div>
    );
};
