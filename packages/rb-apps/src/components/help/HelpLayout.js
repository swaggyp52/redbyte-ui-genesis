import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * HelpLayout - Two-column layout for Help app
 * Provides consistent sidebar + content structure
 */
export const HelpLayout = ({ sidebar, children }) => {
    return (_jsxs("div", { className: "flex h-full bg-slate-900 text-gray-200 font-sans", children: [_jsx("div", { className: "w-[280px] border-r border-slate-700 p-6 overflow-y-auto", children: sidebar }), _jsx("div", { className: "flex-1 overflow-y-auto p-8", children: children })] }));
};
