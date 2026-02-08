import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@redbyte/rb-icons';
import { isCEMode } from '../utils/ceMode';
import styles from './HomeApp.module.css';
const RECENT_KEY = 'rb:home:recent';
const MAX_RECENT = 5;
function loadRecent() {
    try {
        const raw = localStorage.getItem(RECENT_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
    }
    catch {
        return [];
    }
}
function pushRecent(entry) {
    const list = loadRecent().filter((r) => r.appId !== entry.appId || r.label !== entry.label);
    list.unshift({ ...entry, ts: Date.now() });
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}
const CE_MISSIONS = [
    {
        id: 'ce-labs',
        title: 'My Labs',
        description: 'View assignments, build circuits, run test vectors, and submit evidence.',
        iconName: 'book',
        primary: true,
        action: (open) => open('labs'),
    },
    {
        id: 'ce-practice',
        title: 'Practice',
        description: 'Open a blank circuit to experiment freely.',
        iconName: 'logic',
        action: (open) => open('logic-playground'),
    },
    {
        id: 'ce-examples',
        title: 'Examples',
        description: 'Browse pre-built circuits to learn from.',
        iconName: 'circuit-board',
        action: (open) => open('logic-playground', { showExamples: true }),
    },
];
const STUDIO_MISSIONS = [
    {
        id: 'studio-build',
        title: 'Build a Full Adder',
        description: 'Open the classic full adder example and explore how carry propagation works.',
        iconName: 'logic',
        primary: true,
        action: (open) => open('logic-playground', { initialExampleId: '08_full-adder', dockTab: 'learn' }),
    },
    {
        id: 'studio-labs',
        title: 'Run a Lab',
        description: 'Guided assignments with step-by-step verification and hardware integration.',
        iconName: 'book',
        action: (open) => open('labs'),
    },
    {
        id: 'studio-learn',
        title: 'Learn Logic',
        description: 'Step-by-step guided examples: NOT gates, adders, latches, and more.',
        iconName: 'graduation-cap',
        action: (open) => open('logic-playground', { dockTab: 'learn', dockSubview: 'lessons' }),
    },
    {
        id: 'studio-export',
        title: 'Export Work',
        description: 'Review and inspect submission bundles, or start a new export.',
        iconName: 'file-export',
        action: (open) => open('submission-inspector'),
    },
];
function timeAgo(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1)
        return 'just now';
    if (mins < 60)
        return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)
        return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}
const HomeAppContent = ({ onOpenApp }) => {
    const ceMode = isCEMode();
    const missions = ceMode ? CE_MISSIONS : STUDIO_MISSIONS;
    const [recent, setRecent] = useState(loadRecent);
    // Refresh recent list when window regains focus (other apps may have updated it)
    useEffect(() => {
        const handler = () => setRecent(loadRecent());
        window.addEventListener('focus', handler);
        return () => window.removeEventListener('focus', handler);
    }, []);
    const handleMission = useCallback((mission) => {
        if (!onOpenApp)
            return;
        pushRecent({ appId: mission.id, label: mission.title, iconId: mission.iconName });
        setRecent(loadRecent());
        mission.action(onOpenApp);
    }, [onOpenApp]);
    const handleRecent = useCallback((entry) => {
        // Find the matching mission and re-execute its action
        const mission = missions.find((m) => m.id === entry.appId);
        if (mission && onOpenApp) {
            mission.action(onOpenApp);
        }
    }, [missions, onOpenApp]);
    return (_jsx("div", { className: styles.container, "data-testid": "home-screen", children: _jsxs("div", { className: styles.inner, children: [_jsxs("header", { className: styles.brand, children: [_jsx("h1", { className: styles.title, children: ceMode ? 'Welcome to Your Lab' : 'RedByte' }), _jsx("p", { className: styles.tagline, children: ceMode
                                ? 'Build, simulate, and submit digital logic circuits.'
                                : 'The operating system for computer engineering education.' })] }), _jsx("div", { className: styles.grid, children: missions.map((mission) => (_jsxs("button", { type: "button", className: mission.primary ? styles.cardPrimary : styles.card, onClick: () => handleMission(mission), "data-testid": `home-mission-${mission.id}`, children: [_jsx("div", { className: styles.cardIcon, children: _jsx(Icon, { name: mission.iconName, size: 18 }) }), _jsx("div", { className: styles.cardTitle, children: mission.title }), _jsx("p", { className: styles.cardBody, children: mission.description })] }, mission.id))) }), recent.length > 0 && (_jsxs("div", { className: styles.recentSection, children: [_jsx("h2", { className: styles.recentTitle, children: "Recent" }), _jsx("div", { className: styles.recentList, children: recent.map((entry, i) => (_jsxs("button", { type: "button", className: styles.recentItem, onClick: () => handleRecent(entry), children: [_jsx(Icon, { name: entry.iconId, size: 14 }), _jsx("span", { className: styles.recentItemName, children: entry.label }), _jsx("span", { className: styles.recentItemMeta, children: timeAgo(entry.ts) })] }, `${entry.appId}-${i}`))) })] })), _jsxs("div", { className: styles.footer, children: ["RedByte OS Genesis \u00B7 ", import.meta.env.MODE] })] }) }));
};
export const HomeApp = {
    manifest: {
        id: 'home',
        name: 'Home',
        iconId: 'neon-wave',
        category: 'system',
        singleton: true,
        defaultSize: {
            width: 640,
            height: 520,
        },
    },
    component: HomeAppContent,
};
