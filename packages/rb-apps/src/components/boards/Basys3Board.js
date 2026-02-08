import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Basys3Board - Photorealistic FPGA board visualization
 *
 * A stunning, interactive representation of the Digilent Basys3 board
 * with authentic PCB aesthetics, glowing LEDs, tactile switches, and
 * working 7-segment displays.
 */
import { useCallback, useMemo } from 'react';
import { SevenSegmentDisplay } from './SevenSegmentDisplay';
// Parse binary value to bit array
const toBits = (value, width) => {
    if (value === undefined)
        return Array(width).fill(false);
    const num = typeof value === 'string' ? parseInt(value, 2) : value;
    return Array.from({ length: width }, (_, i) => ((num >> (width - 1 - i)) & 1) === 1);
};
// LED component with realistic glow
const LED = ({ on, color = 'green', size = 'sm', label }) => {
    const colors = {
        green: { base: '#1a472a', lit: '#00ff6a', glow: 'rgba(0, 255, 106, 0.8)' },
        red: { base: '#4a1a1a', lit: '#ff3b3b', glow: 'rgba(255, 59, 59, 0.8)' },
        amber: { base: '#4a3a1a', lit: '#ffaa00', glow: 'rgba(255, 170, 0, 0.8)' },
    };
    const c = colors[color];
    const sizeClass = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5';
    return (_jsxs("div", { className: "flex flex-col items-center gap-0.5", children: [_jsx("div", { className: `${sizeClass} rounded-full transition-all duration-75 relative`, style: {
                    background: on
                        ? `radial-gradient(circle at 30% 30%, ${c.lit}, ${c.lit}88)`
                        : `radial-gradient(circle at 30% 30%, ${c.base}aa, ${c.base})`,
                    boxShadow: on
                        ? `0 0 4px 2px ${c.glow}, 0 0 12px 4px ${c.glow}66, inset 0 -1px 2px rgba(0,0,0,0.3)`
                        : 'inset 0 1px 2px rgba(255,255,255,0.1), inset 0 -1px 2px rgba(0,0,0,0.3)',
                    border: `1px solid ${on ? c.lit + '44' : '#333'}`,
                }, children: _jsx("div", { className: "absolute top-0.5 left-0.5 w-1 h-1 rounded-full", style: {
                        background: on
                            ? 'radial-gradient(circle, rgba(255,255,255,0.6), transparent)'
                            : 'radial-gradient(circle, rgba(255,255,255,0.15), transparent)',
                    } }) }), label && (_jsx("span", { className: "text-[6px] font-mono text-[#8b9a7d] tracking-tight", children: label }))] }));
};
// DIP Switch component
const DIPSwitch = ({ on, label, onClick, disabled }) => {
    return (_jsxs("div", { className: "flex flex-col items-center gap-0.5", children: [_jsx("button", { type: "button", onClick: onClick, disabled: disabled, className: `
          w-2 h-5 rounded-sm relative overflow-hidden transition-all duration-100
          ${disabled ? 'cursor-default' : 'cursor-pointer hover:brightness-110 active:scale-95'}
        `, style: {
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05)',
                }, children: _jsx("div", { className: "absolute left-0.5 right-0.5 h-2 rounded-sm transition-all duration-100", style: {
                        top: on ? '2px' : 'calc(100% - 10px)',
                        background: on
                            ? 'linear-gradient(180deg, #00d4ff 0%, #0099cc 100%)'
                            : 'linear-gradient(180deg, #666 0%, #444 100%)',
                        boxShadow: on
                            ? '0 0 4px rgba(0, 212, 255, 0.5), inset 0 1px 0 rgba(255,255,255,0.3)'
                            : 'inset 0 1px 0 rgba(255,255,255,0.1)',
                    } }) }), label && (_jsx("span", { className: "text-[5px] font-mono text-[#8b9a7d] tracking-tight", children: label }))] }));
};
// Push button component
const PushButton = ({ pressed, label, color = 'gray', size = 'sm', onPress, onRelease, disabled }) => {
    const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
    const colors = {
        gray: { base: '#2a2a2a', pressed: '#1a1a1a', ring: '#444' },
        red: { base: '#4a2a2a', pressed: '#3a1a1a', ring: '#664444' },
    };
    const c = colors[color];
    return (_jsx("button", { type: "button", className: `
        ${sizeClass} rounded-full relative transition-all duration-75
        ${disabled ? 'cursor-default' : 'cursor-pointer hover:brightness-110 active:scale-95'}
      `, style: {
            background: `radial-gradient(circle at 50% 40%, ${pressed ? c.pressed : c.base}, #111)`,
            border: `2px solid ${c.ring}`,
            boxShadow: pressed
                ? 'inset 0 2px 4px rgba(0,0,0,0.8)'
                : '0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
            transform: pressed ? 'translateY(1px)' : 'none',
        }, onMouseDown: disabled ? undefined : onPress, onMouseUp: disabled ? undefined : onRelease, onMouseLeave: disabled ? undefined : onRelease, title: label, children: _jsx("div", { className: "absolute top-1 left-1 right-1 h-1.5 rounded-full", style: {
                background: pressed
                    ? 'transparent'
                    : 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 100%)',
            } }) }));
};
// Chip package component
const ChipPackage = ({ label, width = 60, pins = 8 }) => {
    return (_jsxs("div", { className: "relative", style: { width, height: width * 0.6 }, children: [_jsxs("div", { className: "absolute inset-1 rounded-sm", style: {
                    background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
                }, children: [_jsx("div", { className: "absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-[#333]" }), _jsx("div", { className: "absolute inset-0 flex items-center justify-center", children: _jsx("span", { className: "text-[6px] font-mono text-[#666] tracking-wider", children: label }) })] }), Array.from({ length: pins / 2 }).map((_, i) => (_jsx("div", { className: "absolute left-0 w-1 h-0.5 bg-[#888]", style: { top: 4 + i * 6 } }, `l-${i}`))), Array.from({ length: pins / 2 }).map((_, i) => (_jsx("div", { className: "absolute right-0 w-1 h-0.5 bg-[#888]", style: { top: 4 + i * 6 } }, `r-${i}`)))] }));
};
// USB Port component
const USBPort = ({ label }) => {
    return (_jsxs("div", { className: "flex flex-col items-center gap-1", children: [_jsx("div", { className: "w-8 h-3 rounded-sm", style: {
                    background: 'linear-gradient(180deg, #888 0%, #666 100%)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 2px rgba(0,0,0,0.5)',
                }, children: _jsx("div", { className: "w-6 h-1.5 mx-auto mt-0.5 bg-[#333] rounded-sm" }) }), label && (_jsx("span", { className: "text-[5px] font-mono text-[#8b9a7d]", children: label }))] }));
};
export const Basys3Board = ({ ioSnapshot, onInteraction, readOnly = false, scale = 1, }) => {
    // Parse I/O values
    const swBits = useMemo(() => toBits(ioSnapshot?.inputs.SW, 16), [ioSnapshot?.inputs.SW]);
    const btnBits = useMemo(() => toBits(ioSnapshot?.inputs.BTN, 5), [ioSnapshot?.inputs.BTN]);
    const ledBits = useMemo(() => toBits(ioSnapshot?.outputs.LED, 16), [ioSnapshot?.outputs.LED]);
    const segValue = ioSnapshot?.outputs.SEG ?? 0;
    const anValue = ioSnapshot?.outputs.AN ?? 0b1111;
    // Handlers
    const toggleSwitch = useCallback((index) => {
        if (readOnly || !onInteraction)
            return;
        const current = typeof ioSnapshot?.inputs.SW === 'number'
            ? ioSnapshot.inputs.SW
            : parseInt(String(ioSnapshot?.inputs.SW ?? '0'), 2);
        const mask = 1 << (15 - index);
        onInteraction('SW', swBits[index] ? current & ~mask : current | mask);
    }, [ioSnapshot?.inputs.SW, swBits, onInteraction, readOnly]);
    const pressButton = useCallback((bit, pressed) => {
        if (readOnly || !onInteraction)
            return;
        const current = typeof ioSnapshot?.inputs.BTN === 'number'
            ? ioSnapshot.inputs.BTN
            : parseInt(String(ioSnapshot?.inputs.BTN ?? '0'), 2);
        onInteraction('BTN', pressed ? current | (1 << bit) : current & ~(1 << bit));
    }, [ioSnapshot?.inputs.BTN, onInteraction, readOnly]);
    return (_jsxs("div", { className: "relative select-none", style: {
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
        }, children: [_jsxs("div", { className: "relative rounded-lg overflow-hidden", style: {
                    width: 420,
                    height: 300,
                    background: `
            linear-gradient(135deg, #1a5c3a 0%, #134a2d 50%, #0d3820 100%)
          `,
                    boxShadow: `
            0 4px 20px rgba(0,0,0,0.5),
            0 0 0 2px #0a2a18,
            inset 0 0 60px rgba(0,0,0,0.3)
          `,
                }, children: [_jsx("div", { className: "absolute inset-0 opacity-30 pointer-events-none", style: {
                            backgroundImage: `
              repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px),
              repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)
            `,
                        } }), _jsxs("svg", { className: "absolute inset-0 w-full h-full pointer-events-none opacity-20", children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "copper", x1: "0%", y1: "0%", x2: "100%", y2: "100%", children: [_jsx("stop", { offset: "0%", stopColor: "#b87333" }), _jsx("stop", { offset: "100%", stopColor: "#8b5a2b" })] }) }), _jsx("path", { d: "M 20 150 L 80 150 L 80 100 L 150 100", fill: "none", stroke: "url(#copper)", strokeWidth: "1" }), _jsx("path", { d: "M 400 200 L 350 200 L 350 250 L 300 250", fill: "none", stroke: "url(#copper)", strokeWidth: "1" }), _jsx("path", { d: "M 210 20 L 210 60 L 180 60", fill: "none", stroke: "url(#copper)", strokeWidth: "1" })] }), _jsxs("div", { className: "absolute top-3 left-3", children: [_jsx("div", { className: "text-[10px] font-bold tracking-widest text-[#8b9a7d]", children: "DIGILENT" }), _jsx("div", { className: "text-[14px] font-black tracking-tight text-[#c4d4b4] mt-0.5", children: "BASYS 3" })] }), _jsx("div", { className: "absolute top-16 left-1/2 -translate-x-1/2", children: _jsxs("div", { className: "w-24 h-24 rounded relative", style: {
                                background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
                                boxShadow: '0 4px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
                            }, children: [_jsx("div", { className: "absolute top-2 left-2 w-2 h-2 rounded-full bg-[#333]" }), _jsxs("div", { className: "absolute inset-0 flex flex-col items-center justify-center", children: [_jsx("span", { className: "text-[7px] font-mono text-[#666]", children: "XILINX" }), _jsx("span", { className: "text-[8px] font-bold text-[#888] mt-0.5", children: "XC7A35T" }), _jsx("span", { className: "text-[6px] font-mono text-[#555] mt-0.5", children: "ARTIX-7" })] }), _jsx("div", { className: "absolute inset-3 grid grid-cols-6 grid-rows-6 gap-1 opacity-30", children: Array.from({ length: 36 }).map((_, i) => (_jsx("div", { className: "w-1.5 h-1.5 rounded-full bg-[#666]" }, i))) })] }) }), _jsxs("div", { className: "absolute top-4 right-4", children: [_jsx("div", { className: "text-[6px] font-mono text-[#8b9a7d] mb-1 text-center", children: "LEDS" }), _jsx("div", { className: "flex gap-1", children: ledBits.map((on, i) => (_jsx(LED, { on: on, label: `${15 - i}` }, i))) })] }), _jsxs("div", { className: "absolute top-20 right-6", children: [_jsx("div", { className: "text-[6px] font-mono text-[#8b9a7d] mb-1 text-center", children: "7-SEG" }), _jsx(SevenSegmentDisplay, { segments: segValue, anodes: anValue, digits: 4 })] }), _jsxs("div", { className: "absolute bottom-20 right-12", children: [_jsx("div", { className: "text-[6px] font-mono text-[#8b9a7d] mb-2 text-center", children: "BUTTONS" }), _jsxs("div", { className: "grid grid-cols-3 gap-1 w-16", children: [_jsx("div", { className: "col-start-2 flex justify-center", children: _jsx(PushButton, { pressed: btnBits[3], label: "BTNU", onPress: () => pressButton(1, true), onRelease: () => pressButton(1, false), disabled: readOnly }) }), _jsx("div", { className: "flex justify-center items-center", children: _jsx(PushButton, { pressed: btnBits[2], label: "BTNL", onPress: () => pressButton(2, true), onRelease: () => pressButton(2, false), disabled: readOnly }) }), _jsx("div", { className: "flex justify-center items-center", children: _jsx(PushButton, { pressed: btnBits[4], label: "BTNC", color: "red", size: "md", onPress: () => pressButton(0, true), onRelease: () => pressButton(0, false), disabled: readOnly }) }), _jsx("div", { className: "flex justify-center items-center", children: _jsx(PushButton, { pressed: btnBits[1], label: "BTNR", onPress: () => pressButton(3, true), onRelease: () => pressButton(3, false), disabled: readOnly }) }), _jsx("div", { className: "col-start-2 flex justify-center", children: _jsx(PushButton, { pressed: btnBits[0], label: "BTND", onPress: () => pressButton(4, true), onRelease: () => pressButton(4, false), disabled: readOnly }) })] })] }), _jsxs("div", { className: "absolute bottom-6 left-1/2 -translate-x-1/2", children: [_jsx("div", { className: "text-[6px] font-mono text-[#8b9a7d] mb-1 text-center", children: "SWITCHES" }), _jsx("div", { className: "flex gap-0.5 p-1 rounded", style: {
                                    background: 'linear-gradient(180deg, #111 0%, #1a1a1a 100%)',
                                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
                                }, children: swBits.map((on, i) => (_jsx(DIPSwitch, { on: on, label: `${15 - i}`, onClick: () => toggleSwitch(i), disabled: readOnly }, i))) })] }), _jsxs("div", { className: "absolute bottom-4 left-4 flex gap-3", children: [_jsx(USBPort, { label: "PROG" }), _jsx(USBPort, { label: "UART" })] }), _jsx("div", { className: "absolute top-1/2 left-2 -translate-y-1/2", children: ['JA', 'JB', 'JC'].map((label, i) => (_jsxs("div", { className: "mb-2", children: [_jsx("div", { className: "text-[5px] font-mono text-[#8b9a7d] mb-0.5", children: label }), _jsx("div", { className: "w-6 h-4 rounded-sm grid grid-cols-4 gap-0.5 p-0.5", style: {
                                        background: '#1a1a1a',
                                        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
                                    }, children: Array.from({ length: 8 }).map((_, j) => (_jsx("div", { className: "w-1 h-1 rounded-full bg-[#444]" }, j))) })] }, label))) }), _jsxs("div", { className: "absolute bottom-4 right-4", children: [_jsx("div", { className: "text-[5px] font-mono text-[#8b9a7d] mb-0.5 text-center", children: "VGA" }), _jsx("div", { className: "w-10 h-6 rounded-sm", style: {
                                    background: 'linear-gradient(180deg, #0044aa 0%, #003388 100%)',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
                                }, children: _jsx("div", { className: "grid grid-cols-5 grid-rows-3 gap-0.5 p-1", children: Array.from({ length: 15 }).map((_, i) => (_jsx("div", { className: "w-0.5 h-0.5 rounded-full bg-[#888]" }, i))) }) })] }), _jsxs("div", { className: "absolute top-3 right-3 flex items-center gap-1", children: [_jsx(LED, { on: true, color: "green", size: "sm" }), _jsx("span", { className: "text-[5px] font-mono text-[#8b9a7d]", children: "PWR" })] }), _jsx("div", { className: "absolute bottom-2 right-24 text-[5px] font-mono text-[#5a6a4d]", children: "REV E" }), _jsx("div", { className: "absolute top-1 left-1 w-3 h-3 border-t border-l border-[#8b9a7d] opacity-40" }), _jsx("div", { className: "absolute top-1 right-1 w-3 h-3 border-t border-r border-[#8b9a7d] opacity-40" }), _jsx("div", { className: "absolute bottom-1 left-1 w-3 h-3 border-b border-l border-[#8b9a7d] opacity-40" }), _jsx("div", { className: "absolute bottom-1 right-1 w-3 h-3 border-b border-r border-[#8b9a7d] opacity-40" })] }), ioSnapshot?.tick !== undefined && (_jsxs("div", { className: "absolute -bottom-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full", style: {
                    background: 'linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%)',
                    border: '1px solid #2a2a4a',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                }, children: [_jsx("span", { className: "text-[10px] font-mono text-gray-500", children: "TICK " }), _jsx("span", { className: "text-[11px] font-mono font-bold text-cyan-400", children: ioSnapshot.tick })] }))] }));
};
export default Basys3Board;
