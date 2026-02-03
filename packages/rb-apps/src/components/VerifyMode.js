import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Verify Mode — Checkpoint Verification Runner
 *
 * Shows lab steps + checkpoints, runs verification, displays results.
 */
import { useState } from 'react';
import { useLabEngineStore } from '@redbyte/rb-lab-engine';
export const VerifyMode = () => {
    const { project, verifyCheckpoint } = useLabEngineStore();
    const [verifying, setVerifying] = useState(null);
    const [results, setResults] = useState({});
    if (!project || !project.labSpec) {
        return (_jsx("div", { style: { padding: 20 }, children: _jsx("p", { children: "No lab specification loaded." }) }));
    }
    const handleVerify = async (checkpointId) => {
        setVerifying(checkpointId);
        try {
            const result = await verifyCheckpoint(checkpointId);
            setResults((prev) => ({ ...prev, [checkpointId]: result }));
        }
        catch (err) {
            console.error('Verification failed:', err);
            setResults((prev) => ({
                ...prev,
                [checkpointId]: {
                    passed: false,
                    headline: `✗ Error: ${err instanceof Error ? err.message : String(err)}`,
                    failures: [{ message: String(err) }],
                    evidence: { expected: null, actual: null },
                },
            }));
        }
        finally {
            setVerifying(null);
        }
    };
    return (_jsxs("div", { style: { display: 'flex', height: '100%' }, children: [_jsxs("div", { style: {
                    width: 250,
                    borderRight: '1px solid var(--rb-border, #333)',
                    background: 'var(--rb-surface-1, #1e1e2e)',
                    padding: 16,
                    overflow: 'auto',
                }, children: [_jsx("h3", { style: { marginTop: 0, fontSize: 14, fontWeight: 600 }, children: "Lab Steps" }), project.labSpec.steps.map((step, idx) => (_jsxs("div", { style: {
                            padding: 8,
                            marginBottom: 8,
                            borderRadius: 4,
                            border: '1px solid var(--rb-border, #333)',
                            background: 'var(--rb-surface-2, #252538)',
                        }, children: [_jsxs("div", { style: { fontSize: 12, fontWeight: 600 }, children: [idx + 1, ". ", step.title] }), _jsxs("div", { style: { fontSize: 10, color: 'var(--rb-text-3, #71717a)', marginTop: 4 }, children: [step.estimatedMinutes, " min"] })] }, step.id)))] }), _jsxs("div", { style: { flex: 1, padding: 20, overflow: 'auto' }, children: [_jsx("h2", { style: { marginTop: 0, fontSize: 16, fontWeight: 600 }, children: "Verify Mode \u2014 Run Checkpoints" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 16 }, children: project.labSpec.checkpoints.map((checkpoint) => {
                            const result = results[checkpoint.id];
                            const isVerifying = verifying === checkpoint.id;
                            return (_jsxs("div", { style: {
                                    padding: 16,
                                    borderRadius: 8,
                                    border: '1px solid var(--rb-border, #333)',
                                    background: 'var(--rb-surface-1, #1e1e2e)',
                                }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }, children: [_jsxs("div", { children: [_jsxs("div", { style: { fontSize: 14, fontWeight: 600 }, children: [checkpoint.type === 'truth-table' && '📊 Truth Table Verification', checkpoint.type === 'board-io' && '🎛 Board I/O Verification'] }), _jsxs("div", { style: { fontSize: 11, color: 'var(--rb-text-3, #71717a)', marginTop: 4 }, children: ["Checkpoint ID: ", checkpoint.id] })] }), _jsx("button", { onClick: () => handleVerify(checkpoint.id), disabled: isVerifying, style: {
                                                    padding: '8px 16px',
                                                    borderRadius: 6,
                                                    border: '1px solid var(--rb-accent, #3b82f6)',
                                                    background: isVerifying ? 'var(--rb-surface-2, #252538)' : 'var(--rb-accent, #3b82f6)',
                                                    color: isVerifying ? 'var(--rb-text-3, #71717a)' : 'white',
                                                    cursor: isVerifying ? 'not-allowed' : 'pointer',
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                }, children: isVerifying ? 'Verifying...' : 'Verify' })] }), result && (_jsxs("div", { style: {
                                            padding: 12,
                                            borderRadius: 6,
                                            background: result.passed
                                                ? 'rgba(34, 197, 94, 0.1)'
                                                : 'rgba(239, 68, 68, 0.1)',
                                            border: `1px solid ${result.passed ? '#22c55e' : '#ef4444'}`,
                                        }, children: [_jsx("div", { style: {
                                                    fontSize: 13,
                                                    fontWeight: 600,
                                                    color: result.passed ? '#22c55e' : '#ef4444',
                                                    marginBottom: 8,
                                                }, children: result.headline }), result.failures.length > 0 && (_jsxs("div", { style: { fontSize: 11, color: 'var(--rb-text-2, #a1a1aa)' }, children: [_jsx("div", { style: { fontWeight: 600, marginBottom: 4 }, children: "Failures:" }), _jsx("ul", { style: { margin: 0, paddingLeft: 20 }, children: result.failures.map((failure, idx) => (_jsx("li", { children: failure.message }, idx))) })] }))] }))] }, checkpoint.id));
                        }) })] })] }));
};
