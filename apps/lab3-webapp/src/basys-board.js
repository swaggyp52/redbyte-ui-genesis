import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
export const BasysBoard = ({ switches, segments, onSwitchToggle, inputValue }) => {
    return (_jsxs("div", { className: "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-cyan-500/30 rounded-2xl p-8 glow-box-cyan", children: [_jsxs("div", { className: "text-center mb-6", children: [_jsx("h3", { className: "font-tech-display text-2xl font-bold text-cyan-400 neon-cyan mb-2", children: "Virtual Basys 3 Board" }), _jsx("p", { className: "font-digital text-sm text-slate-400", children: "Digilent Basys 3 Artix-7 FPGA Trainer Board" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-8", children: [_jsxs("div", { className: "bg-slate-950/50 rounded-xl p-6 border border-slate-700", children: [_jsxs("h4", { className: "font-tech font-semibold text-emerald-400 mb-4 flex items-center gap-2", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-emerald-400 animate-pulse" }), "Input Switches (SW3-SW0)"] }), _jsx("div", { className: "space-y-3", children: [3, 2, 1, 0].map((bit) => (_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("span", { className: "font-digital text-slate-400 w-12", children: `SW${bit}` }), _jsx("button", { onClick: () => onSwitchToggle(bit), className: `relative w-16 h-8 rounded-full transition-all duration-300 ${switches[bit]
                                                ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 glow-box-cyan'
                                                : 'bg-slate-700'}`, title: `Toggle B${bit}`, children: _jsx("div", { className: `absolute top-1 w-6 h-6 rounded-full bg-white shadow-lg transition-all duration-300 ${switches[bit] ? 'left-9' : 'left-1'}` }) }), _jsx("span", { className: `font-digital font-bold text-lg ${switches[bit] ? 'text-cyan-400 neon-cyan' : 'text-slate-600'}`, children: switches[bit] ? '1' : '0' }), _jsx("span", { className: "font-mono text-xs text-slate-500", children: `B${bit}` })] }, bit))) }), _jsx("div", { className: "mt-6 pt-4 border-t border-slate-700", children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("span", { className: "font-digital text-slate-400", children: "Decimal Value:" }), _jsx("span", { className: "font-tech-display text-3xl font-bold text-cyan-400 neon-cyan", children: inputValue })] }) })] }), _jsxs("div", { className: "bg-slate-950/50 rounded-xl p-6 border border-slate-700", children: [_jsxs("h4", { className: "font-tech font-semibold text-emerald-400 mb-4 flex items-center gap-2", children: [_jsx("span", { className: "w-2 h-2 rounded-full bg-emerald-400 animate-pulse" }), "Seven-Segment Display"] }), _jsx("div", { className: "flex justify-center items-center h3/4", children: _jsx(SegmentDisplayEnhanced, { segments: segments, size: "large", inputValue: inputValue }) }), _jsx("div", { className: "mt-4 grid grid-cols-7 gap-1", children: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((seg, i) => (_jsxs("div", { className: "text-center", children: [_jsx("div", { className: `w-full h-2 rounded-sm mb-1 transition-all duration-200 ${segments[i] === 0
                                                ? 'bg-emerald-400 glow-box-emerald segment-animate'
                                                : 'bg-slate-800'}` }), _jsx("span", { className: "font-digital text-xs text-slate-500", children: seg })] }, seg))) })] })] }), _jsxs("div", { className: "mt-6 pt-4 border-t border-slate-700 flex justify-between items-center text-xs font-digital text-slate-500", children: [_jsx("span", { children: "Active-Low Logic (0 = ON, 1 = OFF)" }), _jsx("span", { children: "Constraint File: Basys3_Master.xdc" })] })] }));
};
export const SegmentDisplayEnhanced = ({ segments, size = 'medium', inputValue = 0 }) => {
    const [hoveredSegment, setHoveredSegment] = React.useState(null);
    const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 });
    const wrapperRef = React.useRef(null);
    const sizeMap = {
        small: { width: 60, height: 90, stroke: 6 },
        medium: { width: 100, height: 150, stroke: 10 },
        large: { width: 140, height: 210, stroke: 14 },
    };
    const { width, height, stroke } = sizeMap[size];
    const pad = stroke * 2;
    // Segment metadata: position for tooltip, label, and description
    const segmentMetadata = {
        a: { label: 'a', position: 'top', desc: 'Top horizontal segment' },
        b: { label: 'b', position: 'top-right', desc: 'Top-right vertical segment' },
        c: { label: 'c', position: 'bottom-right', desc: 'Bottom-right vertical segment' },
        d: { label: 'd', position: 'bottom', desc: 'Bottom horizontal segment' },
        e: { label: 'e', position: 'bottom-left', desc: 'Bottom-left vertical segment' },
        f: { label: 'f', position: 'top-left', desc: 'Top-left vertical segment' },
        g: { label: 'g', position: 'middle', desc: 'Middle horizontal segment' },
    };
    // SVG path definitions for each segment (active-low: 0 = lit)
    const segmentPaths = {
        a: `M${pad + 10},${pad} L${width - pad - 10},${pad} L${width - pad - 15},${pad + 8} L${pad + 15},${pad + 8}Z`,
        b: `M${width - pad},${pad + 12} L${width - pad},${height / 2 - 15} L${width - pad - 8},${height / 2 - 10} L${width - pad - 8},${pad + 17}Z`,
        c: `M${width - pad},${height / 2 + 15} L${width - pad},${height - pad - 12} L${width - pad - 8},${height - pad - 17} L${width - pad - 8},${height / 2 + 10}Z`,
        d: `M${pad + 10},${height - pad} L${width - pad - 10},${height - pad} L${width - pad - 15},${height - pad - 8} L${pad + 15},${height - pad - 8}Z`,
        e: `M${pad},${height / 2 + 15} L${pad},${height - pad - 12} L${pad + 8},${height - pad - 17} L${pad + 8},${height / 2 + 10}Z`,
        f: `M${pad},${pad + 12} L${pad},${height / 2 - 15} L${pad + 8},${height / 2 - 10} L${pad + 8},${pad + 17}Z`,
        g: `M${pad + 12},${height / 2} L${width - pad - 12},${height / 2} L${width - pad - 17},${height / 2 - 5} L${width - pad - 17},${height / 2 + 5} L${width - pad - 12},${height / 2 + 10} L${pad + 12},${height / 2 + 10} L${pad + 17},${height / 2 + 5} L${pad + 17},${height / 2 - 5}Z`,
    };
    const segmentNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    // Check if input is in don't-care range (10-15, or A-F in hex)
    const isDontCare = inputValue >= 10 && inputValue <= 15;
    const handleSegmentHover = (name, e) => {
        setHoveredSegment(name);
        const containerRect = wrapperRef.current?.getBoundingClientRect();
        if (!containerRect)
            return;
        setTooltipPos({
            x: e.clientX - containerRect.left,
            y: e.clientY - containerRect.top,
        });
    };
    return (_jsxs("div", { className: "relative inline-block", ref: wrapperRef, children: [isDontCare && (_jsx("div", { className: "absolute inset-0 bg-slate-900/60 rounded-lg flex items-center justify-center z-20 backdrop-blur-sm", children: _jsxs("div", { className: "text-center", children: [_jsx("p", { className: "font-tech text-sm text-amber-300 font-semibold", children: "Don't Care Input" }), _jsxs("p", { className: "font-digital text-xs text-amber-200 mt-1", children: ["Input ", inputValue, " (", String.fromCharCode(65 + (inputValue - 10)), ")"] }), _jsx("p", { className: "font-digital text-xs text-amber-200", children: "No defined output" })] }) })), _jsxs("svg", { width: width, height: height, viewBox: `0 0 ${width} ${height}`, className: `filter drop-shadow-lg transition-opacity duration-300 ${isDontCare ? 'opacity-40' : 'opacity-100'}`, children: [_jsxs("defs", { children: [_jsxs("filter", { id: "segment-glow", children: [_jsx("feGaussianBlur", { stdDeviation: "2", result: "coloredBlur" }), _jsxs("feMerge", { children: [_jsx("feMergeNode", { in: "coloredBlur" }), _jsx("feMergeNode", { in: "SourceGraphic" })] })] }), _jsxs("filter", { id: "segment-glow-bright", children: [_jsx("feGaussianBlur", { stdDeviation: "3", result: "coloredBlur" }), _jsxs("feMerge", { children: [_jsx("feMergeNode", { in: "coloredBlur" }), _jsx("feMergeNode", { in: "SourceGraphic" })] })] })] }), segmentNames.map((name, i) => {
                        const isOn = segments[i] === 0; // Active-low
                        const isHovered = hoveredSegment === name;
                        return (_jsxs("g", { onMouseEnter: (e) => handleSegmentHover(name, e), onMouseLeave: () => setHoveredSegment(null), style: { cursor: 'pointer' }, children: [_jsx("path", { d: segmentPaths[name], fill: isOn ? '#10b981' : '#1e293b', stroke: isOn ? isHovered ? '#34d399' : '#10b981' : '#334155', strokeWidth: isHovered ? 2 : 1, filter: isOn ? isHovered ? 'url(#segment-glow-bright)' : 'url(#segment-glow)' : undefined, className: `transition-all duration-150 ${isOn ? 'segment-animate' : ''}`, opacity: isOn ? isHovered ? 1 : 0.9 : isHovered ? 0.5 : 0.3 }), isHovered && (_jsx("path", { d: segmentPaths[name], fill: "none", stroke: "#34d399", strokeWidth: "2", opacity: "0.4", className: "animate-pulse" }))] }, name));
                    })] }), hoveredSegment && !isDontCare && (_jsxs("div", { className: "absolute bg-slate-950 border border-cyan-500/50 rounded-lg p-3 z-30 shadow-xl whitespace-nowrap text-xs font-digital", style: {
                    left: `${tooltipPos.x + 12}px`,
                    top: `${tooltipPos.y + 12}px`,
                    minWidth: '120px',
                }, children: [_jsxs("div", { className: "font-tech font-semibold text-cyan-400 mb-1", children: ["Segment ", hoveredSegment.toUpperCase()] }), _jsx("div", { className: "text-slate-300 text-xs mb-2", children: segmentMetadata[hoveredSegment].desc }), _jsxs("div", { className: `font-mono font-bold ${segments[segmentNames.indexOf(hoveredSegment)] === 0 ? 'text-emerald-400' : 'text-slate-500'}`, children: ["Value: ", segments[segmentNames.indexOf(hoveredSegment)]] }), _jsx("div", { className: "text-slate-400 text-xs mt-1", children: segments[segmentNames.indexOf(hoveredSegment)] === 0 ? '✓ Lit' : '✗ Dark' })] }))] }));
};
