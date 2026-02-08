import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React from 'react';
import { analyzeCircuitHealth } from '../logic/circuitHealth';
const ISSUE_DETAILS = {
    'unconnected-input': {
        why: 'Inputs left floating will read as 0 and can block logic evaluation.',
        suggestion: 'Wire the input to a source or remove the gate if unused.',
        fixHint: 'Connect the input to a switch, input pin, or power source.',
    },
    'floating-output': {
        why: 'Outputs that do not feed anything make it hard to observe behavior.',
        suggestion: 'Connect the output to a Lamp/OUTPUT or another gate.',
        fixHint: 'Wire the output into a Lamp or OUTPUT node.',
    },
    'disconnected-subgraph': {
        why: 'Disconnected groups of nodes do not affect the main circuit.',
        suggestion: 'Connect the subgraph or delete unused nodes.',
        fixHint: 'Connect this group to the main circuit or remove it.',
    },
    'no-inputs': {
        why: 'Without an input source, the circuit cannot be stimulated.',
        suggestion: 'Add a Switch, INPUT, or PowerSource.',
        fixHint: 'Add at least one input source to drive signals.',
    },
    'no-outputs': {
        why: 'Without an output, there is no visible result.',
        suggestion: 'Add a Lamp or OUTPUT node to observe signals.',
        fixHint: 'Add a Lamp or OUTPUT node to observe behavior.',
    },
};
export const CircuitHealthPanel = ({ circuit, onFocusNode, onIssueHover, }) => {
    const health = React.useMemo(() => analyzeCircuitHealth(circuit), [circuit]);
    const [ignoredIssues, setIgnoredIssues] = React.useState(new Set());
    const getIssueId = (issue) => `${issue.type}:${issue.nodeId}:${issue.portName ?? 'none'}`;
    const handleIssueFocus = (issue) => {
        if (onFocusNode) {
            onFocusNode(issue.nodeId, issue.portName);
        }
    };
    const handleIssueHover = (issue) => {
        if (!onIssueHover)
            return;
        if (!issue) {
            onIssueHover(null, null);
            return;
        }
        onIssueHover(issue.nodeId, issue.portName ?? null);
    };
    const toggleIgnore = (issue) => {
        const id = getIssueId(issue);
        setIgnoredIssues((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            }
            else {
                next.add(id);
            }
            return next;
        });
    };
    if (health.isHealthy && circuit.nodes.length > 0) {
        return (_jsxs("div", { className: "p-4 text-sm", children: [_jsxs("div", { className: "flex items-center gap-2 text-green-400", children: [_jsx("span", { className: "text-lg", children: "\u2713" }), _jsx("span", { className: "font-semibold", children: "Circuit looks healthy" })] }), _jsx("p", { className: "text-gray-400 mt-2", children: "All components are properly connected." })] }));
    }
    if (circuit.nodes.length === 0) {
        return (_jsx("div", { className: "p-4 text-sm text-gray-400", children: _jsx("p", { children: "Add components to see circuit health analysis." }) }));
    }
    const visibleIssues = health.issues.filter((issue) => !ignoredIssues.has(getIssueId(issue)));
    // Group issues by severity
    const warnings = visibleIssues.filter((i) => i.severity === 'warning');
    const hints = visibleIssues.filter((i) => i.severity === 'hint');
    const suggestions = Array.from(new Set(visibleIssues
        .map((issue) => ISSUE_DETAILS[issue.type]?.suggestion)
        .filter((item) => Boolean(item))));
    return (_jsxs("div", { className: "p-4 text-sm space-y-4", children: [_jsx("div", { className: "flex items-center gap-2", children: health.hasWarnings ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "text-lg", children: "\u26A0\uFE0F" }), _jsxs("span", { className: "font-semibold text-yellow-400", children: [warnings.length, " warning", warnings.length !== 1 ? 's' : ''] })] })) : (_jsxs(_Fragment, { children: [_jsx("span", { className: "text-lg", children: "\uD83D\uDCA1" }), _jsx("span", { className: "font-semibold text-blue-400", children: "Suggestions" })] })) }), suggestions.length > 0 && (_jsxs("div", { className: "space-y-2", children: [_jsx("h3", { className: "text-xs uppercase tracking-wide text-cyan-300 font-semibold", children: "Fix Suggestions" }), _jsx("ul", { className: "space-y-1 text-xs text-gray-300", children: suggestions.map((suggestion) => (_jsx("li", { className: "bg-gray-800/40 border border-gray-700/50 rounded px-2 py-1", children: suggestion }, suggestion))) })] })), warnings.length > 0 && (_jsxs("div", { className: "space-y-2", children: [_jsx("h3", { className: "text-xs uppercase tracking-wide text-yellow-400 font-semibold", children: "Warnings" }), warnings.map((issue, i) => (_jsxs("div", { className: "w-full text-left p-3 rounded bg-yellow-900/20 border border-yellow-700/30 space-y-2", onMouseEnter: () => handleIssueHover(issue), onMouseLeave: () => handleIssueHover(null), children: [_jsx("div", { className: "text-yellow-300 text-xs font-semibold", children: issue.message }), _jsxs("div", { className: "text-[10px] text-yellow-200/80", children: ["Fix hint: ", ISSUE_DETAILS[issue.type]?.fixHint] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => handleIssueFocus(issue), className: "px-2 py-1 text-[10px] bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-200 rounded transition-colors", type: "button", children: "Focus" }), _jsx("button", { onClick: () => toggleIgnore(issue), className: "px-2 py-1 text-[10px] bg-gray-800/60 hover:bg-gray-700 text-gray-300 rounded transition-colors", type: "button", children: ignoredIssues.has(getIssueId(issue)) ? 'Unignore' : 'Ignore' })] }), _jsxs("details", { className: "text-[10px] text-gray-400", children: [_jsx("summary", { className: "cursor-pointer text-gray-300", children: "Why?" }), _jsx("div", { className: "mt-1", children: ISSUE_DETAILS[issue.type]?.why })] })] }, i)))] })), hints.length > 0 && (_jsxs("div", { className: "space-y-2", children: [_jsx("h3", { className: "text-xs uppercase tracking-wide text-blue-400 font-semibold", children: "Hints" }), hints.map((issue, i) => (_jsxs("div", { className: "w-full text-left p-3 rounded bg-blue-900/20 border border-blue-700/30 space-y-2", onMouseEnter: () => handleIssueHover(issue), onMouseLeave: () => handleIssueHover(null), children: [_jsx("div", { className: "text-blue-300 text-xs font-semibold", children: issue.message }), _jsxs("div", { className: "text-[10px] text-blue-200/80", children: ["Fix hint: ", ISSUE_DETAILS[issue.type]?.fixHint] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => handleIssueFocus(issue), className: "px-2 py-1 text-[10px] bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 rounded transition-colors", type: "button", children: "Focus" }), _jsx("button", { onClick: () => toggleIgnore(issue), className: "px-2 py-1 text-[10px] bg-gray-800/60 hover:bg-gray-700 text-gray-300 rounded transition-colors", type: "button", children: ignoredIssues.has(getIssueId(issue)) ? 'Unignore' : 'Ignore' })] }), _jsxs("details", { className: "text-[10px] text-gray-400", children: [_jsx("summary", { className: "cursor-pointer text-gray-300", children: "Why?" }), _jsx("div", { className: "mt-1", children: ISSUE_DETAILS[issue.type]?.why })] })] }, i)))] }))] }));
};
