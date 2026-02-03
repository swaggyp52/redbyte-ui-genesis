import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import CopyButton from './CopyButton';
export default function CodeBlock({ code, copyText }) {
    const value = copyText ?? code;
    return (_jsxs("div", { className: "bg-rb-raised border border-rb-border rounded-md p-4 overflow-x-auto relative pr-16", children: [_jsx("div", { className: "absolute top-3 right-3", children: _jsx(CopyButton, { value: value }) }), _jsx("pre", { className: "text-sm text-rb-text font-mono whitespace-pre-wrap", children: _jsx("code", { children: code }) })] }));
}
