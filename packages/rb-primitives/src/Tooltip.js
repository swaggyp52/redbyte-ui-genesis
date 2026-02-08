import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React, { useId, useState } from 'react';
export const Tooltip = ({ content, children }) => {
    const [isVisible, setIsVisible] = useState(false);
    const tooltipId = useId();
    return (_jsxs("div", { className: "relative inline-block", children: [React.cloneElement(children, {
                onMouseEnter: () => setIsVisible(true),
                onMouseLeave: () => setIsVisible(false),
                onFocus: () => setIsVisible(true),
                onBlur: () => setIsVisible(false),
                'aria-describedby': isVisible ? tooltipId : undefined,
            }), isVisible && (_jsxs("div", { role: "tooltip", id: tooltipId, className: "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-[var(--rb-spacing-2)] px-[var(--rb-spacing-3)] py-[var(--rb-spacing-2)] bg-[var(--rb-color-neutral-900)] text-white text-[var(--rb-font-size-sm)] rounded-[var(--rb-radius-md)] shadow-[var(--rb-shadow-lg)] whitespace-nowrap pointer-events-none", children: [content, _jsx("div", { className: "absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-l-transparent border-r-4 border-r-transparent border-t-4 border-t-[var(--rb-color-neutral-900)]" })] }))] }));
};
