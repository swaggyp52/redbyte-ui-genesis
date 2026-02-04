import { jsx as _jsx } from "react/jsx-runtime";
// Copyright Â© 2025 Connor Angiel â€” RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { Suspense } from 'react';
// IMPORTANT: keep @redbyte/rb-logic-3d out of the boot graph.
// Virtual Lab is 3D-heavy and must only load when explicitly opened.
const VirtualLabAppLazy = React.lazy(async () => {
    if (import.meta.env.DEV) {
        console.log('[lazy] Loading VirtualLabAppImpl (logic-3d stack)');
    }
    const mod = await import('./VirtualLabAppImpl');
    return { default: mod.default };
});
const VirtualLabAppStub = (props) => (_jsx(Suspense, { fallback: _jsx("div", { className: "h-full w-full flex items-center justify-center text-[11px] text-gray-400 bg-[#111]", children: "Loading Virtual Lab\u2026" }), children: _jsx(VirtualLabAppLazy, { ...props }) }));
export const VirtualLabApp = {
    manifest: {
        id: 'virtual-lab',
        name: 'Virtual Lab',
        iconId: 'tool-build',
        category: 'tools',
        defaultSize: { width: 1200, height: 800 },
        minSize: { width: 800, height: 600 },
    },
    component: VirtualLabAppStub,
};

