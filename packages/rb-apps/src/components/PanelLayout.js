import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * A standardized layout container for panels that ensures proper scrolling behavior.
 * Enforces the "Single Scroll Region" pattern:
 * - Root: flex col, min-h-0, h-full (fills parent)
 * - Header: shrink-0 (never collapses)
 * - Body: flex-1, min-h-0, overflow-auto (scrolls internally)
 */
export const PanelLayout = ({ children, header, className = '', headerClassName = '', bodyClassName = '', }) => {
    return (_jsxs("div", { className: `flex flex-col h-full min-h-0 min-w-0 bg-gray-900 ${className}`, children: [header && (_jsx("div", { className: `shrink-0 border-b border-gray-800 p-4 ${headerClassName}`, children: header })), _jsx("div", { className: `flex-1 min-h-0 min-w-0 overflow-auto p-4 ${bodyClassName}`, children: children })] }));
};
