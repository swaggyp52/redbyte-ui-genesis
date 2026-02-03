import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export default function CounterCircuit() {
    const [count, setCount] = useState(0);
    const [history, setHistory] = useState([0]);
    const clock = () => {
        const newCount = (count + 1) % 16;
        setCount(newCount);
        setHistory(prev => [...prev, newCount].slice(-8));
    };
    const reset = () => {
        setCount(0);
        setHistory([0]);
    };
    const toBinary = (num) => num.toString(2).padStart(4, '0');
    return (_jsxs("div", { className: "bg-rb-surface border border-rb-border rounded-md overflow-hidden", children: [_jsxs("div", { className: "px-6 py-4 border-b border-rb-border", children: [_jsx("h3", { className: "text-h3 text-rb-text", children: "4-Bit Counter" }), _jsx("p", { className: "text-sm text-rb-muted mt-1", children: "Sequential logic: registers store state and update on clock edges." })] }), _jsx("div", { className: "p-6", children: _jsxs("div", { className: "grid md:grid-cols-2 gap-8", children: [_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "text-center py-4", children: [_jsx("div", { className: "text-xs uppercase tracking-wider text-rb-dim mb-2", children: "Current Value" }), _jsx("div", { className: "text-6xl font-bold font-mono text-rb-accent tabular-nums", children: count }), _jsx("div", { className: "text-lg font-mono text-rb-muted mt-2 tracking-widest", children: toBinary(count) })] }), _jsxs("div", { className: "flex gap-3 justify-center", children: [_jsxs("button", { type: "button", onClick: clock, className: "btn btn-primary flex items-center gap-2", children: [_jsx("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "currentColor", children: _jsx("path", { d: "M8 2v4h4V2H8zM8 10v4h4v-4H8zM2 2v4h4V2H2zM2 10v4h4v-4H2z" }) }), "Clock Pulse"] }), _jsx("button", { type: "button", onClick: reset, className: "btn btn-secondary", children: "Reset" })] }), _jsx("div", { className: "flex justify-center gap-2", children: toBinary(count).split('').map((bit, i) => (_jsxs("div", { className: "text-center", children: [_jsxs("div", { className: "text-xs text-rb-dim mb-1", children: ["Q", 3 - i] }), _jsx("div", { className: `w-14 h-14 flex items-center justify-center rounded-md text-xl font-bold font-mono border-2 transition-all ${bit === '1'
                                                    ? 'bg-rb-accent border-rb-accent text-rb-bg'
                                                    : 'bg-rb-raised border-rb-border text-rb-dim'}`, children: bit })] }, i))) })] }), _jsxs("div", { children: [_jsx("h4", { className: "text-sm font-semibold text-rb-text mb-3", children: "Clock History" }), _jsx("div", { className: "space-y-1.5", children: history.slice().reverse().map((val, i) => {
                                        const tick = history.length - i;
                                        const isCurrent = i === 0;
                                        return (_jsxs("div", { className: `flex items-center justify-between p-3 rounded-md font-mono text-sm transition-all ${isCurrent
                                                ? 'bg-rb-accent-bg border border-rb-accent'
                                                : 'bg-rb-raised border border-rb-border'}`, children: [_jsxs("span", { className: `text-xs ${isCurrent ? 'text-rb-accent' : 'text-rb-dim'}`, children: ["t=", tick] }), _jsx("span", { className: `tracking-widest ${isCurrent ? 'text-rb-text' : 'text-rb-muted'}`, children: toBinary(val) }), _jsx("span", { className: `font-semibold ${isCurrent ? 'text-rb-accent' : 'text-rb-text'}`, children: val })] }, tick));
                                    }) }), _jsx("p", { className: "text-xs text-rb-dim mt-4 leading-relaxed", children: "Each clock pulse increments the counter. When it reaches 15 (1111), it wraps to 0. This is how binary counters work in real hardware." })] })] }) })] }));
}
