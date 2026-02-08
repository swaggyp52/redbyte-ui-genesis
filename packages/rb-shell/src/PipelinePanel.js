import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React from 'react';
/* ─── Sub-components ───────────────────────────────────────── */
const DOT_SIZE = 8;
const stepColors = {
    complete: 'var(--rb-ui-accent)',
    active: 'var(--rb-ui-accent)',
    pending: 'var(--rb-ui-surface-3)',
};
const Step = ({ step }) => {
    const isClickable = !!step.onClick;
    const Tag = isClickable ? 'button' : 'div';
    return (_jsxs(Tag, { ...(isClickable ? { type: 'button', onClick: step.onClick } : {}), style: {
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 8px',
            borderRadius: 4,
            border: 'none',
            background: isClickable ? 'transparent' : 'transparent',
            cursor: isClickable ? 'pointer' : 'default',
            fontFamily: 'var(--rb-ui-font-mono)',
        }, title: isClickable ? `Go to ${step.label}` : undefined, children: [_jsx("span", { style: {
                    width: DOT_SIZE,
                    height: DOT_SIZE,
                    borderRadius: '50%',
                    background: stepColors[step.state],
                    flexShrink: 0,
                    boxShadow: step.state === 'active' ? '0 0 6px var(--rb-ui-accent)' : 'none',
                    animation: step.state === 'active' ? 'rbPipelinePulse 1.5s ease-in-out infinite' : 'none',
                } }), _jsx("span", { style: {
                    fontSize: 11,
                    fontWeight: 600,
                    color: step.state === 'pending' ? 'var(--rb-ui-text-3)' : 'var(--rb-ui-text)',
                }, children: step.label }), _jsx("span", { style: { fontSize: 10, color: 'var(--rb-ui-text-3)' }, children: step.sublabel })] }));
};
const Arrow = () => (_jsx("span", { style: { fontSize: 10, color: 'var(--rb-ui-text-3)', userSelect: 'none' }, children: "\u2192" }));
/* ─── Main Component ───────────────────────────────────────── */
export const PipelinePanel = ({ hasCircuit, hasRecording, isRecording, verificationStatus, hasExport, onGoToRecord, onGoToVerify, onGoToExport, }) => {
    const steps = [
        {
            label: 'Build',
            state: hasCircuit ? 'complete' : 'pending',
            sublabel: hasCircuit ? '' : 'no circuit',
        },
        {
            label: 'Record',
            state: isRecording ? 'active' : hasRecording ? 'complete' : 'pending',
            sublabel: isRecording ? 'recording...' : hasRecording ? '' : 'not recorded',
            onClick: onGoToRecord,
        },
        {
            label: 'Verify',
            state: verificationStatus === 'pass' ? 'complete' : verificationStatus === 'fail' ? 'active' : 'pending',
            sublabel: verificationStatus === 'pass' ? 'proven' : verificationStatus === 'fail' ? 'diverged' : '',
            onClick: hasRecording && !isRecording ? onGoToVerify : undefined,
        },
        {
            label: 'Export',
            state: hasExport ? 'complete' : 'pending',
            sublabel: hasExport ? '' : '',
            onClick: verificationStatus === 'pass' ? onGoToExport : undefined,
        },
    ];
    return (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: 'var(--rb-ui-surface-1)',
                    border: '1px solid var(--rb-ui-border)',
                }, children: steps.map((step, i) => (_jsxs(React.Fragment, { children: [i > 0 && _jsx(Arrow, {}), _jsx(Step, { step: step })] }, step.label))) }), _jsx("style", { children: `
        @keyframes rbPipelinePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      ` })] }));
};
