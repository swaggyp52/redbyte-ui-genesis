import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React, { useMemo, useRef } from 'react';
import { getWallpaperStyle } from './wallpapers';
export const Desktop = React.memo(({ onOpenApp, wallpaperId, themeVariant }) => {
    const desktopRef = useRef(null);
    const wallpaperStyle = useMemo(() => getWallpaperStyle(wallpaperId, themeVariant), [wallpaperId, themeVariant]);
    const handleContextMenu = (e) => {
        // Future: custom context menu with New File, Open Terminal, Appearance
        // For now, allow default browser context menu
    };
    const handleDoubleClick = () => {
        onOpenApp('logic-playground');
    };
    return (_jsxs("div", { ref: desktopRef, id: "rb-desktop-region", "data-testid": "shell-desktop", role: "region", "aria-label": "Desktop", className: "rb-desktop rb-noise absolute inset-0 overflow-hidden pointer-events-none", style: { ...wallpaperStyle }, children: [_jsx("div", { className: "pointer-events-none absolute inset-0 rb-vignette" }), _jsx("div", { className: "pointer-events-none absolute inset-0 flex items-center justify-center", children: _jsx("div", { className: "text-[120px] font-bold leading-none select-none", style: {
                        color: 'var(--rb-text)',
                        opacity: 0.02,
                        fontFamily: 'var(--rb-font-sans)',
                        letterSpacing: '-0.04em',
                    }, children: "R" }) }), wallpaperId === 'redbyte-field' && (_jsx("div", { className: "pointer-events-none absolute inset-0", children: _jsx("div", { className: "absolute inset-0 rb-anim", style: {
                        opacity: 0.3,
                        backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.04) 1px, transparent 1px), ' +
                            'linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px)',
                        backgroundSize: '120px 120px',
                        animation: 'rb-field-drift 60s linear infinite',
                    } }) })), _jsx("div", { className: "absolute inset-0 pointer-events-auto", style: { zIndex: 0 }, onContextMenu: handleContextMenu, onDoubleClick: handleDoubleClick }), _jsx("div", { className: "absolute bottom-3 left-4 z-10 text-[10px] font-mono pointer-events-auto", style: { color: 'var(--rb-text-2)', opacity: 0.8 }, children: _jsx("span", { className: "px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold", children: "v0.9.0" }) }), _jsx("div", { className: "absolute bottom-3 right-4 z-10 text-right text-[10px] font-mono pointer-events-none", style: { color: 'var(--rb-text-3)', opacity: 0.5 }, children: _jsx("div", { children: "RedByte OS Genesis" }) })] }));
});
Desktop.displayName = 'Desktop';
