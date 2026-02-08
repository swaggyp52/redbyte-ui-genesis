import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React from 'react';
import styles from './StartHereApp.module.css';
export const StartHereAppContent = ({ onOpenApp }) => {
    const playgroundExampleId = '04_4bit-counter';
    const handleOpenPlayground = () => {
        onOpenApp?.('logic-playground', { initialExampleId: playgroundExampleId });
    };
    const handleOpenLab = () => {
        // Phase 5.1: Direct student to Lab 1 (Intro to Digital Logic) by default
        onOpenApp?.('ece-lab', { labId: 'lab-1', initialTab: 'hardware' });
    };
    const handleOpenVirtualLab = () => {
        onOpenApp?.('ece-lab', {});
    };
    const handleOpenInspector = () => {
        onOpenApp?.('submission-inspector', { loadSample: true });
    };
    return (_jsxs("div", { className: styles.container, children: [_jsxs("header", { className: styles.header, children: [_jsx("h1", { className: styles.title, children: "Start Here" }), _jsx("p", { className: styles.subtitle, children: "Three quick paths to see RedByte working end to end." })] }), _jsxs("div", { className: styles.grid, children: [_jsxs("button", { type: "button", className: styles.card, onClick: handleOpenPlayground, children: [_jsx("div", { className: styles.cardTitle, children: "Logic Playground" }), _jsx("p", { className: styles.cardBody, children: "2D digital circuits \u2014 drag gates, wires. Best for logic design and truth tables." }), _jsx("div", { className: styles.cardAction, children: "Open Playground" })] }), _jsxs("button", { type: "button", className: styles.card, onClick: handleOpenVirtualLab, children: [_jsx("div", { className: styles.cardTitle, children: "Virtual Lab" }), _jsx("p", { className: styles.cardBody, children: "Unified lab surface \u2014 2D circuit editor (canonical) with optional 3D read-only visualization." }), _jsx("div", { className: styles.cardAction, children: "Open Virtual Lab" })] }), _jsxs("button", { type: "button", className: styles.card, onClick: handleOpenLab, children: [_jsx("div", { className: styles.cardTitle, children: "Lab Assignment" }), _jsx("p", { className: styles.cardBody, children: "Course lab wrapper \u2014 pick template, run vectors, submit capsule." }), _jsx("div", { className: styles.cardAction, children: "Open Lab Assignment" })] })] }), _jsxs("section", { className: styles.labMapSection, children: [_jsx("h2", { className: styles.labMapTitle, children: "Lab Map" }), _jsxs("ul", { className: styles.labMapList, children: [_jsxs("li", { children: [_jsx("strong", { children: "Logic Playground" }), " \u2014 2D circuits + truth tables + replay"] }), _jsxs("li", { children: [_jsx("strong", { children: "Virtual Lab" }), " \u2014 2D canonical editor + optional 3D read-only view"] }), _jsxs("li", { children: [_jsx("strong", { children: "Lab Assignment" }), " \u2014 Course lab wrapper + template + submit"] }), _jsxs("li", { children: [_jsx("strong", { children: "Lab Examiner" }), " \u2014 Read-only inspection + integrity verification"] })] }), _jsxs("p", { className: styles.labMapFiles, children: [_jsx("code", { children: ".rb-lab.zip" }), " = evidence capsule"] })] }), _jsxs("div", { className: "mt-6 pt-4 border-t border-white/5 text-[9px] text-gray-600 font-mono text-center", children: ["RedByte OS Genesis \u00B7 ", import.meta.env.MODE, " \u00B7 ", _jsx(BuildInfo, {})] })] }));
};
const BuildInfo = () => {
    const [info, setInfo] = React.useState('Loading...');
    React.useEffect(() => {
        fetch('/build.json').then(r => r.json()).then(d => setInfo(`${d.sha} (${d.env})`)).catch(() => setInfo('dev-mode'));
    }, []);
    return _jsx("span", { children: info });
};
export const StartHereApp = {
    manifest: {
        id: 'start-here',
        name: 'Start Here',
        iconId: 'cpu',
        category: 'system',
        defaultSize: {
            width: 720,
            height: 520,
        },
    },
    component: StartHereAppContent,
};
