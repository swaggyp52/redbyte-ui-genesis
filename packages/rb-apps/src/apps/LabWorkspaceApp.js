import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Lab Workspace App — Unified Lab Environment (Vertical Slice)
 *
 * Three synchronized modes:
 * - Design: Build circuits (reuses LogicPlayground canvas)
 * - Verify: Run checkpoint verifications
 * - Deploy: Map to board + test I/O
 *
 * VERTICAL SLICE: Simplified implementation to prove the loop.
 * Full integration with LogicPlayground deferred until loop is validated.
 */
import { useState, useEffect, useRef } from 'react';
import { useLabEngineStore } from '@redbyte/rb-lab-engine';
import { DesignMode } from '../components/DesignMode';
import { VerifyMode } from '../components/VerifyMode';
import { DeployMode } from '../components/DeployMode';
import { IntegrityBadge } from '../components/IntegrityBadge';
// Lab 0 content (inline for vertical slice)
const lab0Content = {
    labId: 'lab0-mux-switches',
    title: 'Switch-Controlled MUX → LEDs',
    description: 'Build a 2-to-1 multiplexer, verify its truth table, then map it to board switches and LEDs.',
    steps: [
        {
            id: 'step1',
            title: 'Build 2-to-1 Multiplexer',
            description: 'Create a 2-to-1 multiplexer using AND, OR, and NOT gates.',
            hints: ['Y = (A AND NOT SEL) OR (B AND SEL)'],
            estimatedMinutes: 10,
        },
        {
            id: 'step2',
            title: 'Verify Truth Table',
            description: 'Test all input combinations.',
            estimatedMinutes: 3,
        },
        {
            id: 'step3',
            title: 'Map to Board',
            description: 'Map your MUX to board switches and LEDs.',
            estimatedMinutes: 5,
        },
    ],
    checkpoints: [
        {
            id: 'cp1-truth-table',
            stepId: 'step2',
            type: 'truth-table',
            spec: {
                inputs: ['A', 'B', 'SEL'],
                outputs: ['Y'],
                expectedTable: [
                    { A: 0, B: 0, SEL: 0, Y: 0 },
                    { A: 1, B: 0, SEL: 0, Y: 1 },
                    { A: 0, B: 1, SEL: 0, Y: 0 },
                    { A: 1, B: 1, SEL: 0, Y: 1 },
                    { A: 0, B: 0, SEL: 1, Y: 0 },
                    { A: 1, B: 0, SEL: 1, Y: 0 },
                    { A: 0, B: 1, SEL: 1, Y: 1 },
                    { A: 1, B: 1, SEL: 1, Y: 1 },
                ],
            },
        },
        {
            id: 'cp2-board-io',
            stepId: 'step3',
            type: 'board-io',
            spec: {
                inputSwitches: [false, true, false],
                expectedLEDs: [true],
                ticksToStabilize: 2,
            },
        },
    ],
};
const LabWorkspaceAppComponent = ({ windowId }) => {
    const [mode, setMode] = useState('design');
    const [integrityStatus, setIntegrityStatus] = useState(null);
    const fileInputRef = useRef(null);
    const { project, loadProject, exportCapsule, importCapsule } = useLabEngineStore();
    // Initialize with Lab 0 project
    useEffect(() => {
        if (!project) {
            const initialProject = {
                schemaVersion: '1.0',
                projectId: `lab0-${Date.now()}`,
                name: lab0Content.title,
                description: lab0Content.description,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                circuit: {
                    schemaVersion: '1.0',
                    nodes: [],
                    connections: [],
                },
                simulation: {
                    tickRate: 20,
                    currentTick: 0,
                    probes: [],
                },
                labSpec: lab0Content, // Type assertion for vertical slice
                evidence: {
                    actions: [],
                    snapshots: [],
                },
            };
            loadProject(initialProject);
        }
    }, [project, loadProject]);
    const handleExport = async () => {
        try {
            const blob = await exportCapsule();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${project?.name ?? 'lab'}-evidence.zip`;
            a.click();
            URL.revokeObjectURL(url);
        }
        catch (err) {
            console.error('Export failed:', err);
            alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    };
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };
    const handleImportFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        try {
            const result = await importCapsule(file);
            setIntegrityStatus(result.integrity);
            if (result.integrity.status === 'verified') {
                alert('✅ Evidence capsule verified! Project loaded successfully.');
            }
            else {
                alert(`⚠️ ${result.integrity.message}\n\nModified files: ${result.integrity.details?.modifiedFiles?.join(', ') ?? 'unknown'}`);
            }
        }
        catch (err) {
            console.error('Import failed:', err);
            alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
            setIntegrityStatus(null);
        }
        // Reset input so same file can be selected again
        e.target.value = '';
    };
    if (!project) {
        return (_jsx("div", { style: { padding: 20, fontFamily: 'monospace' }, children: "Loading Lab 0..." }));
    }
    return (_jsxs("div", { style: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            fontFamily: 'var(--rb-font-mono, monospace)',
            background: 'var(--rb-surface-0, #18181b)',
            color: 'var(--rb-text, #e4e4e7)',
        }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    gap: 4,
                    padding: 8,
                    borderBottom: '1px solid var(--rb-border, #333)',
                    background: 'var(--rb-surface-1, #1e1e2e)',
                }, children: [['design', 'verify', 'deploy'].map((m) => (_jsx("button", { onClick: () => setMode(m), style: {
                            padding: '8px 16px',
                            borderRadius: 6,
                            border: '1px solid var(--rb-border, #333)',
                            background: mode === m ? 'var(--rb-accent, #3b82f6)' : 'var(--rb-surface-2, #252538)',
                            color: mode === m ? 'white' : 'var(--rb-text, #e4e4e7)',
                            cursor: 'pointer',
                            fontWeight: mode === m ? 600 : 400,
                            fontSize: 13,
                            textTransform: 'capitalize',
                        }, children: m }, m))), _jsx("div", { style: { flex: 1 } }), integrityStatus && (_jsx(IntegrityBadge, { status: integrityStatus.status })), _jsx("input", { ref: fileInputRef, type: "file", accept: ".zip", onChange: handleImportFile, style: { display: 'none' }, "aria-label": "Import evidence capsule file" }), _jsx("button", { onClick: handleImportClick, style: {
                            padding: '8px 16px',
                            borderRadius: 6,
                            border: '1px solid var(--rb-border, #333)',
                            background: 'var(--rb-surface-2, #252538)',
                            color: 'var(--rb-text, #e4e4e7)',
                            cursor: 'pointer',
                            fontSize: 13,
                            marginRight: 8,
                        }, children: "Import Capsule" }), _jsx("button", { onClick: handleExport, style: {
                            padding: '8px 16px',
                            borderRadius: 6,
                            border: '1px solid var(--rb-border, #333)',
                            background: 'var(--rb-surface-2, #252538)',
                            color: 'var(--rb-text, #e4e4e7)',
                            cursor: 'pointer',
                            fontSize: 13,
                        }, children: "Export Capsule" })] }), _jsxs("div", { style: { flex: 1, overflow: 'hidden' }, children: [mode === 'design' && _jsx(DesignMode, { windowId: windowId }), mode === 'verify' && _jsx(VerifyMode, {}), mode === 'deploy' && _jsx(DeployMode, {})] }), _jsxs("div", { style: {
                    padding: 8,
                    fontSize: 11,
                    borderTop: '1px solid var(--rb-border, #333)',
                    background: 'var(--rb-surface-1, #1e1e2e)',
                    color: 'var(--rb-text-3, #71717a)',
                }, children: [project.name, " \u00B7 Tick ", project.simulation.currentTick, " \u00B7 ", project.evidence.actions.length, " actions recorded"] })] }));
};
export const LabWorkspaceApp = {
    manifest: {
        id: 'lab-workspace',
        name: 'Lab Workspace',
        iconId: '⎔',
        category: 'logic',
        defaultSize: { width: 900, height: 650 },
        persistence: 'session',
        hidden: true,
    },
    component: LabWorkspaceAppComponent,
};
