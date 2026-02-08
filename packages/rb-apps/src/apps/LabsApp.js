import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React from 'react';
import { LABS } from '../labs/labContent';
import { Icon } from '@redbyte/rb-icons';
const LabsAppComponent = ({ onOpenApp }) => {
    const [labProgress, setLabProgress] = React.useState({});
    // In a real implementation, we would pull status from useLabStore or persistence
    // For now, we'll mock it or just show "Start" vs "Continue" based on checking if autosave exists
    // const { activeLabId } = useLabStore(); 
    const handleOpenLab = (labId) => {
        onOpenApp?.('ece-lab', { labId });
    };
    const labIds = Object.keys(LABS);
    return (_jsx("div", { className: "flex flex-col h-full bg-[var(--rb-surface-0)] text-[var(--rb-text)] p-6 overflow-y-auto", children: _jsxs("div", { className: "max-w-4xl mx-auto w-full", children: [_jsxs("header", { className: "mb-8", children: [_jsx("h1", { className: "text-3xl font-bold mb-2", children: "Guided Labs" }), _jsx("p", { className: "text-[var(--rb-text-2)] text-lg", children: "Interactive hardware and logic design assignments with automated verification." })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: labIds.map((labId, index) => {
                        const content = LABS[labId];
                        // Extract title from the first step if available, or use ID
                        const firstStep = Array.isArray(content) ? content[0] : null;
                        const title = firstStep ? firstStep.title : `Lab ${index + 1}`;
                        // Simple description extraction (naïve) from markdown
                        const description = firstStep
                            ? firstStep.markdown.split('\n').find(l => l.trim().length > 0 && !l.startsWith('#'))?.trim()
                            : 'Start your journey into digital logic.';
                        return (_jsxs("div", { className: "flex flex-col p-5 rounded-xl border border-[var(--rb-border)] bg-[var(--rb-surface-1)] hover:border-[var(--rb-accent)] transition-colors group", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("div", { className: "h-10 w-10 rounded-lg bg-[var(--rb-surface-2)] flex items-center justify-center text-[var(--rb-accent)] group-hover:scale-110 transition-transform", children: _jsx(Icon, { name: "book", size: 20 }) }), _jsx("span", { className: "text-xs font-mono px-2 py-1 rounded bg-[var(--rb-surface-2)] text-[var(--rb-text-2)] uppercase tracking-wider", children: labId })] }), _jsx("h3", { className: "text-lg font-bold mb-2 group-hover:text-[var(--rb-accent)] transition-colors", children: title }), _jsx("p", { className: "text-sm text-[var(--rb-text-2)] mb-6 flex-1 line-clamp-3", children: description || 'No description available.' }), _jsxs("button", { onClick: () => handleOpenLab(labId), className: "mt-auto py-2 px-4 rounded-lg bg-[var(--rb-surface-3)] hover:bg-[var(--rb-accent)] hover:text-white transition-colors font-medium text-sm flex items-center justify-center gap-2", children: [_jsx(Icon, { name: "code", size: 16 }), _jsx("span", { children: "Open Lab" })] })] }, labId));
                    }) }), labIds.length === 0 && (_jsx("div", { className: "text-center py-12 text-[var(--rb-text-3)]", children: "No labs available currently. Check back later!" }))] }) }));
};
export const LabsApp = {
    manifest: {
        id: 'labs',
        name: 'Labs',
        iconId: 'book',
        category: 'tools',
        description: 'Central hub for all guided lab assignments.',
        defaultSize: { width: 900, height: 600 },
        singleton: true,
    },
    component: LabsAppComponent,
};
