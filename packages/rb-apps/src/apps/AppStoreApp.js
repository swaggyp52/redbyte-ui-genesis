import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { useEffect, useState } from 'react';
import { Icon } from '@redbyte/rb-icons';
const AppStoreComponent = ({ onOpenApp }) => {
    const [apps, setApps] = useState([]);
    // Lazy load apps from registry to avoid circular import
    useEffect(() => {
        (async () => {
            const { listApps } = await import('../AppRegistry');
            setApps(listApps());
        })();
    }, []);
    const openApp = (app) => {
        onOpenApp?.(app.manifest.id);
    };
    return (_jsxs("div", { className: "h-full p-6 overflow-y-auto", style: { background: 'var(--rb-surface-0)', color: 'var(--rb-text)' }, children: [_jsx("h1", { className: "text-xl font-semibold mb-2", style: { color: 'var(--rb-text)' }, children: "Apps" }), _jsx("p", { className: "mb-6 text-sm", style: { color: 'var(--rb-text-2)' }, children: "Browse and launch installed applications." }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3", children: apps.map((app) => (_jsxs("button", { type: "button", className: "group rounded-lg p-4 text-left transition-colors", style: {
                        background: 'var(--rb-surface-1)',
                        border: '1px solid var(--rb-border)',
                    }, onClick: () => openApp(app), children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-lg", style: { background: 'var(--rb-surface-2)', border: '1px solid var(--rb-border)' }, children: _jsx(Icon, { name: app.manifest.iconId ?? 'folder', size: 20 }) }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "font-medium text-sm", style: { color: 'var(--rb-text)' }, children: app.manifest.name }), _jsx("div", { className: "text-xs", style: { color: 'var(--rb-text-3)' }, children: app.manifest.category })] }), _jsx("span", { className: "text-xs", style: { color: 'var(--rb-accent)' }, children: "Launch" })] }), app.manifest.description && (_jsx("div", { className: "mt-2 text-xs leading-relaxed line-clamp-2", style: { color: 'var(--rb-text-2)' }, children: app.manifest.description }))] }, app.manifest.id))) })] }));
};
export const AppStoreApp = {
    manifest: {
        id: 'app-store',
        name: 'Apps',
        iconId: 'grid',
        category: 'system',
        defaultSize: { width: 800, height: 600 },
        minSize: { width: 600, height: 400 },
    },
    component: AppStoreComponent,
};
