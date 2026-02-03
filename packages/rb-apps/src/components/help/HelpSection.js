import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const sectionTitles = {
    concept: 'Concept',
    build: 'Build',
    simulate: 'Simulate',
    explain: 'Explain',
    reflect: 'Reflect',
};
/**
 * HelpSection - Standardized section for Concept/Build/Simulate/Explain/Reflect
 * Provides consistent heading style and spacing
 */
export const HelpSection = ({ kind, children, className = '' }) => {
    return (_jsxs("div", { className: `mt-6 first:mt-0 ${className}`, children: [_jsx("h3", { className: "text-cyan-400 mb-2", children: sectionTitles[kind] }), _jsx("div", { className: "text-gray-200", children: children })] }));
};
