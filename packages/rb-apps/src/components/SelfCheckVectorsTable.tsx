// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// SelfCheckVectorsTable.tsx: Displays pass/fail status for each test vector.

import React from 'react';

export interface VectorResult {
    id: string;
    name: string;
    pass: boolean;
    error?: string;
    observed?: any;
    expected?: any;
}

interface Props {
    results: VectorResult[];
}

export const SelfCheckVectorsTable: React.FC<Props> = ({ results }) => {
    return (
        <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">Verification Vectors</h3>
                <div className="flex gap-4 text-[10px] font-bold">
                    <div className="flex items-center gap-1.5 text-green-500">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        <span>{results.filter(r => r.pass).length} PASSED</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-red-500">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        <span>{results.filter(r => !r.pass).length} FAILED</span>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-slate-950/50 text-slate-500 text-[10px] uppercase font-black tracking-tighter">
                            <th className="px-6 py-3">Vector</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Observed Output</th>
                            <th className="px-6 py-3">Expected</th>
                            <th className="px-6 py-3">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                        {results.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-600 font-medium italic">
                                    Run a self-check to populate vectors.
                                </td>
                            </tr>
                        ) : (
                            results.map((r) => (
                                <tr key={r.id} className="hover:bg-indigo-500/5 transition-colors group">
                                    <td className="px-6 py-4 font-mono text-xs font-bold text-white">{r.name}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight shadow-sm
                      ${r.pass
                                                ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                                                : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                            }`}
                                        >
                                            {r.pass ? 'Success' : 'Failure'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs opacity-70 group-hover:opacity-100 transition-opacity">
                                        {r.observed ? JSON.stringify(r.observed) : '0x0'}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs opacity-70 group-hover:opacity-100 transition-opacity">
                                        {r.expected ? JSON.stringify(r.expected) : '0x0'}
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-500 truncate max-w-[200px]">
                                        {r.error || 'Identity mapping verified'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
