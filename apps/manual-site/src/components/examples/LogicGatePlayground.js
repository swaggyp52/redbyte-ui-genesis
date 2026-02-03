import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
const gateLogic = {
    AND: (a, b) => a && (b ?? false),
    OR: (a, b) => a || (b ?? false),
    XOR: (a, b) => a !== (b ?? false),
    NAND: (a, b) => !(a && (b ?? false)),
    NOR: (a, b) => !(a || (b ?? false)),
    XNOR: (a, b) => a === (b ?? false),
    NOT: (a) => !a,
};
const gateDescriptions = {
    AND: 'Output is 1 only when both inputs are 1',
    OR: 'Output is 1 when at least one input is 1',
    XOR: 'Output is 1 when inputs are different',
    NAND: 'Output is 0 only when both inputs are 1',
    NOR: 'Output is 0 when at least one input is 1',
    XNOR: 'Output is 1 when inputs are the same',
    NOT: 'Output is the inverse of the input',
};
export default function LogicGatePlayground() {
    const [inputA, setInputA] = useState(false);
    const [inputB, setInputB] = useState(false);
    const [gateType, setGateType] = useState('AND');
    const isUnary = gateType === 'NOT';
    const output = gateLogic[gateType](inputA, isUnary ? undefined : inputB);
    const truthTable = isUnary
        ? [false, true].map((a) => ({ a, b: null, out: gateLogic[gateType](a) }))
        : [
            [false, false],
            [false, true],
            [true, false],
            [true, true],
        ].map(([a, b]) => ({ a, b, out: gateLogic[gateType](a, b) }));
    return (_jsxs("div", { className: "bg-rb-surface border border-rb-border rounded-md overflow-hidden", children: [_jsxs("div", { className: "px-6 py-4 border-b border-rb-border", children: [_jsx("h3", { className: "text-h3 text-rb-text", children: "Logic Gate Playground" }), _jsx("p", { className: "text-sm text-rb-muted mt-1", children: "Toggle inputs and select gates to see how logic flows." })] }), _jsx("div", { className: "p-6", children: _jsxs("div", { className: "grid md:grid-cols-2 gap-8", children: [_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "gate-type", className: "block mb-2 text-sm font-medium text-rb-text", children: "Gate Type" }), _jsx("select", { id: "gate-type", value: gateType, onChange: (e) => setGateType(e.target.value), className: "w-full bg-rb-raised border border-rb-border rounded-md px-4 py-2.5 text-rb-text focus:border-rb-accent focus:outline-none transition-colors", children: Object.keys(gateLogic).map((gate) => (_jsx("option", { value: gate, children: gate }, gate))) }), _jsx("p", { className: "text-xs text-rb-dim mt-2", children: gateDescriptions[gateType] })] }), _jsxs("div", { className: "space-y-3", children: [_jsx(InputToggle, { label: "Input A", value: inputA, onChange: () => setInputA(!inputA) }), !isUnary && (_jsx(InputToggle, { label: "Input B", value: inputB, onChange: () => setInputB(!inputB) }))] }), _jsx("div", { className: "pt-4 border-t border-rb-border", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "font-mono text-sm text-rb-muted", children: "Output" }), _jsx("div", { className: `w-20 h-10 rounded-md flex items-center justify-center font-bold font-mono text-lg transition-all ${output
                                                    ? 'bg-rb-accent text-rb-bg'
                                                    : 'bg-rb-raised border border-rb-border text-rb-dim'}`, children: output ? '1' : '0' })] }) })] }), _jsxs("div", { children: [_jsx("h4", { className: "text-sm font-semibold text-rb-text mb-3", children: "Truth Table" }), _jsx("div", { className: "bg-rb-raised border border-rb-border rounded-md overflow-hidden", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-rb-bg text-xs uppercase tracking-wider", children: [_jsx("th", { className: "px-4 py-3 text-rb-dim font-medium text-left", children: "A" }), !isUnary && _jsx("th", { className: "px-4 py-3 text-rb-dim font-medium text-left", children: "B" }), _jsx("th", { className: "px-4 py-3 text-rb-dim font-medium text-left", children: "Out" })] }) }), _jsx("tbody", { className: "font-mono text-sm", children: truthTable.map((row, i) => {
                                                    const isActive = isUnary
                                                        ? row.a === inputA
                                                        : row.a === inputA && row.b === inputB;
                                                    return (_jsxs("tr", { className: `border-t border-rb-border transition-colors ${isActive ? 'bg-rb-accent-bg' : ''}`, children: [_jsx("td", { className: "px-4 py-2.5 text-rb-muted", children: row.a ? '1' : '0' }), !isUnary && (_jsx("td", { className: "px-4 py-2.5 text-rb-muted", children: row.b ? '1' : '0' })), _jsx("td", { className: `px-4 py-2.5 font-semibold ${row.out ? 'text-rb-accent' : 'text-rb-dim'}`, children: row.out ? '1' : '0' })] }, i));
                                                }) })] }) })] })] }) })] }));
}
function InputToggle({ label, value, onChange }) {
    return (_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "font-mono text-sm text-rb-muted", children: label }), _jsx("button", { type: "button", "aria-label": `Toggle ${label}`, onClick: onChange, className: `w-20 h-10 rounded-md border-2 transition-all font-mono font-semibold ${value
                    ? 'bg-rb-accent border-rb-accent text-rb-bg'
                    : 'bg-rb-raised border-rb-border text-rb-dim hover:border-rb-border-strong'}`, children: value ? '1' : '0' })] }));
}
