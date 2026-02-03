import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useMemo } from 'react';
import { listExamples } from '@redbyte/rb-apps';
import { Icon } from '@redbyte/rb-icons';
const PipelineStep = ({ label, status, sublabel, }) => {
    const dotStyle = {
        width: 10,
        height: 10,
        borderRadius: '50%',
        flexShrink: 0,
        background: status === 'complete'
            ? '#22c55e'
            : status === 'active'
                ? '#3b82f6'
                : 'var(--rb-surface-3, #3f3f46)',
        boxShadow: status === 'active' ? '0 0 6px rgba(59,130,246,0.5)' : 'none',
        animation: status === 'active' ? 'rbPulse 1.5s ease-in-out infinite' : 'none',
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 72 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 6 }, children: [_jsx("span", { style: dotStyle }), _jsx("span", { style: {
                            fontSize: 11,
                            fontWeight: 600,
                            color: status === 'pending' ? 'var(--rb-text-3, #71717a)' : 'var(--rb-text, #e4e4e7)',
                        }, children: label })] }), _jsx("span", { style: { fontSize: 10, color: 'var(--rb-text-3, #71717a)', textAlign: 'center' }, children: sublabel })] }));
};
const PipelineArrow = () => (_jsx("span", { style: {
        fontSize: 11,
        color: 'var(--rb-text-3, #71717a)',
        margin: '0 2px',
        marginBottom: 16,
    }, children: "\u2192" }));
/* ─── State Chip ────────────────────────────────────────────── */
const StateChip = ({ label, value, accent, }) => (_jsxs("div", { style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        borderRadius: 6,
        border: '1px solid var(--rb-border, #333)',
        background: 'var(--rb-surface-1, #1e1e2e)',
        fontSize: 11,
        fontFamily: 'var(--rb-font-mono, monospace)',
    }, children: [_jsx("span", { style: { color: 'var(--rb-text-3, #71717a)', fontWeight: 500 }, children: label }), _jsx("span", { style: { color: accent ? 'var(--rb-accent, #3b82f6)' : 'var(--rb-text, #e4e4e7)', fontWeight: 600 }, children: value })] }));
/* ─── Quick Actions ─────────────────────────────────────────── */
/* ─── Sections ──────────────────────────────────────────────── */
const SECTIONS = [
    {
        title: 'Learning Tools',
        apps: [
            { id: 'logic-playground', label: 'Logic Playground', icon: 'logic', description: 'Freestyle circuit design' },
            { id: 'ece-lab', label: 'ECE Lab', icon: 'chip', description: 'Guided hardware labs' },
            { id: 'virtual-lab', label: 'Virtual Lab', icon: 'tool-build', description: 'Simulated breadboard' },
            { id: 'labs', label: 'Labs', icon: 'book', description: 'Course assignments' },
            { id: 'start-here', label: 'Start Here', icon: 'browser', description: 'Introduction & Basics' },
        ]
    },
    {
        title: 'System Tools',
        apps: [
            { id: 'files', label: 'Files', icon: 'files', description: 'Project management' },
            { id: 'terminal', label: 'Terminal', icon: 'terminal', description: 'Command line interface' },
            { id: 'settings', label: 'Settings', icon: 'settings', description: 'System configuration' },
            { id: 'system-log', label: 'Logs', icon: 'log', description: 'Debug logs' },
        ]
    },
    {
        title: 'Grading & Export',
        apps: [
            { id: 'submission-inspector', label: 'Inspector', icon: 'search', description: 'Verify submissions' },
            { id: 'fpga-proof-viewer', label: 'Proof Viewer', icon: 'shield-check', description: 'Analyze proofs' },
        ]
    }
];
/* ─── App Guide ─────────────────────────────────────────────── */
const APP_GUIDE = [
    { label: 'Logic Playground', desc: 'Build circuits freely' },
    { label: 'Lab', desc: 'Complete guided assignments with verification' },
    { label: 'Virtual Lab', desc: 'Test on 3D simulated boards' },
];
/* ─── Component ─────────────────────────────────────────────── */
export const HomeScreen = ({ onOpenApp, onOpenExample, determinismMode, tickCount, isRecording, hasRecording, hasProofPack, logEntryCount, verificationStatus, }) => {
    const buildStatus = 'complete';
    const buildSublabel = 'Ready';
    const recordStatus = isRecording ? 'active' : hasRecording ? 'complete' : 'pending';
    const recordSublabel = isRecording ? 'Recording...' : hasRecording ? 'Captured' : 'Waiting';
    const verifyStatus = verificationStatus ? 'complete' : 'pending';
    const verifySublabel = verificationStatus === 'pass' ? 'Passed' : verificationStatus === 'fail' ? 'Failed' : 'Untested';
    const exportStatus = hasProofPack ? 'complete' : 'pending';
    const exportSublabel = hasProofPack ? 'Packaged' : 'No Data';
    const starterExamples = useMemo(() => {
        const all = listExamples();
        // Prioritize basic gates and simpler circuits for the start screen
        const priority = ['basic-gates', 'full-adder', 'multiplexer', 'd-latch'];
        return all.filter(e => priority.includes(e.id)).slice(0, 4);
    }, []);
    return (_jsxs("div", { style: {
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            pointerEvents: 'none',
        }, children: [_jsxs("div", { style: {
                    pointerEvents: 'auto',
                    maxWidth: 800,
                    width: '90%',
                    fontFamily: 'var(--rb-font-mono, monospace)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 24,
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    padding: '24px',
                    background: 'rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.1)',
                }, children: [_jsxs("div", { style: { textAlign: 'center', marginBottom: 8 }, children: [_jsx("div", { style: {
                                    fontSize: 22,
                                    fontWeight: 700,
                                    color: 'var(--rb-text, #e4e4e7)',
                                    letterSpacing: '-0.02em',
                                }, children: "RedByte OS" }), _jsx("p", { style: { fontSize: 12, color: 'var(--rb-text-3, #71717a)', marginTop: 4 }, children: "Deterministic Engineering Environment" })] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 24 }, children: SECTIONS.map((section) => (_jsxs("div", { children: [_jsx("h3", { style: {
                                        fontSize: 11,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        color: 'var(--rb-text-3)',
                                        marginBottom: 12,
                                        fontWeight: 600,
                                        borderBottom: '1px solid var(--rb-border-subtle)',
                                        paddingBottom: 4
                                    }, children: section.title }), _jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }, children: section.apps.map((app) => (_jsxs("button", { type: "button", onClick: () => onOpenApp(app.id), style: {
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '16px 8px',
                                            borderRadius: 8,
                                            border: '1px solid transparent',
                                            background: 'var(--rb-surface-2)', // slight bg
                                            color: 'var(--rb-text)',
                                            cursor: 'pointer',
                                            textAlign: 'center',
                                            transition: 'all 0.2s ease',
                                        }, onMouseEnter: (e) => {
                                            e.currentTarget.style.background = 'var(--rb-surface-3)';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        }, onMouseLeave: (e) => {
                                            e.currentTarget.style.background = 'var(--rb-surface-2)';
                                            e.currentTarget.style.transform = 'none';
                                        }, children: [_jsx("div", { style: { color: 'var(--rb-accent)' }, children: _jsx(Icon, { name: app.icon, size: 24 }) }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 2 }, children: [_jsx("span", { style: { fontSize: 12, fontWeight: 600 }, children: app.label }), _jsx("span", { style: { fontSize: 10, color: 'var(--rb-text-2)', lineHeight: 1.2 }, children: app.description })] })] }, app.id))) })] }, section.title))) }), _jsxs("div", { style: {
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'center',
                            gap: 6,
                            padding: '12px 0',
                            marginBottom: 8,
                        }, children: [_jsx(PipelineStep, { label: "Build", status: buildStatus, sublabel: buildSublabel }), _jsx(PipelineArrow, {}), _jsx(PipelineStep, { label: "Record", status: recordStatus, sublabel: recordSublabel }), _jsx(PipelineArrow, {}), _jsx(PipelineStep, { label: "Verify", status: verifyStatus, sublabel: verifySublabel }), _jsx(PipelineArrow, {}), _jsx(PipelineStep, { label: "Export", status: exportStatus, sublabel: exportSublabel })] }), _jsxs("div", { style: {
                            display: 'flex',
                            justifyContent: 'center',
                            gap: 8,
                            marginBottom: 20,
                            flexWrap: 'wrap',
                        }, children: [_jsx(StateChip, { label: "Mode", value: determinismMode.toUpperCase(), accent: true }), _jsx(StateChip, { label: "Ticks", value: String(tickCount) }), _jsx(StateChip, { label: "Log", value: `${logEntryCount} entries` })] }), starterExamples.length > 0 && (_jsxs("div", { children: [_jsx("div", { style: {
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: 'var(--rb-text-3, #71717a)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                    marginBottom: 8,
                                }, children: "Example Circuits" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: starterExamples.map((ex) => (_jsxs("button", { type: "button", onClick: () => onOpenExample(ex.id), style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px 12px',
                                        borderRadius: 8,
                                        border: '1px solid var(--rb-border, #333)',
                                        background: 'var(--rb-surface-1, #1e1e2e)',
                                        color: 'var(--rb-text, #e4e4e7)',
                                        cursor: 'pointer',
                                        fontSize: 12,
                                        fontFamily: 'inherit',
                                        textAlign: 'left',
                                        transition: 'background 150ms',
                                    }, onMouseEnter: (e) => {
                                        e.currentTarget.style.background = 'var(--rb-surface-2, #252538)';
                                    }, onMouseLeave: (e) => {
                                        e.currentTarget.style.background = 'var(--rb-surface-1, #1e1e2e)';
                                    }, children: [_jsxs("div", { children: [_jsx("span", { style: { fontWeight: 600 }, children: ex.name }), _jsx("span", { style: {
                                                        marginLeft: 8,
                                                        color: 'var(--rb-text-3, #71717a)',
                                                        fontSize: 11,
                                                    }, children: ex.description })] }), _jsx("span", { style: {
                                                fontSize: 10,
                                                padding: '2px 6px',
                                                borderRadius: 4,
                                                background: ex.difficulty === 'beginner'
                                                    ? 'rgba(34,197,94,0.15)'
                                                    : 'rgba(59,130,246,0.15)',
                                                color: ex.difficulty === 'beginner'
                                                    ? '#22c55e'
                                                    : '#3b82f6',
                                                fontWeight: 600,
                                                flexShrink: 0,
                                            }, children: ex.difficulty })] }, ex.id))) })] })), _jsxs("div", { style: { marginTop: 16 }, children: [_jsx("div", { style: {
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: 'var(--rb-text-3, #71717a)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.06em',
                                    marginBottom: 6,
                                }, children: "Which app should I use?" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 2 }, children: APP_GUIDE.map((item) => (_jsxs("div", { style: { fontSize: 11, color: 'var(--rb-text-3, #71717a)', lineHeight: 1.6 }, children: [_jsx("span", { style: { color: 'var(--rb-text, #e4e4e7)', fontWeight: 600 }, children: item.label }), ' \u2014 ', item.desc] }, item.label))) })] }), _jsx("div", { style: {
                            textAlign: 'center',
                            marginTop: 16,
                            fontSize: 11,
                            color: 'var(--rb-text-3, #71717a)',
                        }, children: "Ctrl/Cmd+K to search \u00B7 ? for shortcuts" })] }), _jsx("style", { children: `
        @keyframes rbPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      ` })] }));
};
