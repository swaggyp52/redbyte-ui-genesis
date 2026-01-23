// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
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
    if (!ioSnapshot) {
        return (
            <div className={`flex items-center justify-center p-8 text-gray-500 text-sm ${className}`}>
                No hardware data available. Connect a device to compare.
            </div>
        );
    }

    if (checks.length === 0) {
        return (
            <div className={`flex items-center justify-center p-8 text-gray-500 text-sm ${className}`}>
                No mapped signals to compare.
            </div>
        );
    }

    return (
        <div className={`flex flex-col h-full bg-gray-950 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-800 bg-gray-900">
                <h2 className="text-sm font-semibold text-gray-200">Comparison</h2>
                <div className="text-xs text-gray-500 font-mono">
                    TICK: <span className="text-cyan-400">{ioSnapshot.tick ?? '-'}</span>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-800 text-xs text-gray-400 sticky top-0">
                        <tr>
                            <th className="p-2 font-medium border-b border-gray-700">Signal</th>
                            <th className="p-2 font-medium border-b border-gray-700">Expected (Sim)</th>
                            <th className="p-2 font-medium border-b border-gray-700">Observed (HW)</th>
                            <th className="p-2 font-medium border-b border-gray-700 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-gray-800">
                        {checks.map((check) => (
                            <tr key={check.signalName} className="hover:bg-gray-900/50">
                                <td className="p-2 text-gray-300 font-mono">{check.signalName}</td>
                                <td className="p-2 text-gray-400 font-mono">{check.expected}</td>
                                <td className="p-2 text-gray-400 font-mono">{check.observed}</td>
                                <td className="p-2 text-center">
                                    <span
                                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${check.pass
                                            ? 'bg-green-900/30 text-green-400 border border-green-800'
                                            : 'bg-red-900/30 text-red-400 border border-red-800'
                                            }`}
                                    >
                                        {check.pass ? 'PASS' : 'FAIL'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
