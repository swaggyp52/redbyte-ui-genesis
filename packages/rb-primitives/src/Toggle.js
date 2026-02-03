import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React from 'react';
export const Toggle = React.forwardRef(({ label, className, ...props }, ref) => {
    return (_jsxs("label", { className: "inline-flex items-center gap-[var(--rb-spacing-2)] cursor-pointer", children: [_jsxs("div", { className: "relative", children: [_jsx("input", { ref: ref, type: "checkbox", className: "sr-only peer", ...props }), _jsx("div", { className: "w-11 h-6 bg-[var(--rb-color-neutral-300)] rounded-[var(--rb-radius-full)] peer peer-checked:bg-[var(--rb-color-accent-500)] transition-colors duration-[var(--rb-duration-fast)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--rb-color-accent-500)]" }), _jsx("div", { className: "absolute left-1 top-1 bg-white w-4 h-4 rounded-[var(--rb-radius-full)] transition-transform duration-[var(--rb-duration-fast)] peer-checked:translate-x-5" })] }), label && _jsx("span", { className: "text-[var(--rb-font-size-base)]", children: label })] }));
});
Toggle.displayName = 'Toggle';
