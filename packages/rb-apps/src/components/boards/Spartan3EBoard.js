import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Spartan3EBoard - Photorealistic Spartan-3E Starter Kit visualization
 *
 * A faithful representation of the classic Xilinx Spartan-3E Starter Kit
 * with its distinctive red PCB, character LCD, rotary encoder, and LED bar.
 */
import { useCallback, useMemo } from 'react';
// Parse binary value to bit array
const toBits = (value, width) => {
    if (value === undefined)
        return Array(width).fill(false);
    const num = typeof value === 'string' ? parseInt(value, 2) : value;
    return Array.from({ length: width }, (_, i) => ((num >> (width - 1 - i)) & 1) === 1);
};
// LED component with realistic glow
const LED = ({ on, color = 'green', label }) => {
    const colors = {
        green: { base: '#1a3a1a', lit: '#00ff6a', glow: 'rgba(0, 255, 106, 0.8)' },
        red: { base: '#3a1a1a', lit: '#ff3b3b', glow: 'rgba(255, 59, 59, 0.8)' },
        amber: { base: '#3a2a1a', lit: '#ffaa00', glow: 'rgba(255, 170, 0, 0.8)' },
        yellow: { base: '#3a3a1a', lit: '#ffff00', glow: 'rgba(255, 255, 0, 0.8)' },
    };
    const c = colors[color];
    return (_jsxs("div", { className: "flex flex-col items-center gap-0.5", children: [_jsx("div", { className: "w-3 h-3 rounded-full transition-all duration-75 relative", style: {
                    background: on
                        ? `radial-gradient(circle at 30% 30%, ${c.lit}, ${c.lit}88)`
                        : `radial-gradient(circle at 30% 30%, ${c.base}aa, ${c.base})`,
                    boxShadow: on
                        ? `0 0 6px 3px ${c.glow}, 0 0 15px 5px ${c.glow}44, inset 0 -1px 2px rgba(0,0,0,0.3)`
                        : 'inset 0 1px 2px rgba(255,255,255,0.1), inset 0 -1px 2px rgba(0,0,0,0.3)',
                    border: `1px solid ${on ? c.lit + '44' : '#444'}`,
                }, children: _jsx("div", { className: "absolute top-0.5 left-0.5 w-1 h-1 rounded-full", style: {
                        background: on
                            ? 'radial-gradient(circle, rgba(255,255,255,0.6), transparent)'
                            : 'radial-gradient(circle, rgba(255,255,255,0.15), transparent)',
                    } }) }), label && (_jsx("span", { className: "text-[6px] font-mono text-[#d4a574] tracking-tight", children: label }))] }));
};
// Slide Switch component (classic toggle style)
const SlideSwitch = ({ on, label, onClick, disabled }) => {
    return (_jsxs("div", { className: "flex flex-col items-center gap-1", children: [_jsxs("button", { type: "button", onClick: onClick, disabled: disabled, className: `
          w-4 h-6 rounded relative overflow-hidden transition-all duration-100
          ${disabled ? 'cursor-default' : 'cursor-pointer hover:brightness-110'}
        `, style: {
                    background: 'linear-gradient(180deg, #333 0%, #1a1a1a 100%)',
                    border: '1px solid #444',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05)',
                }, children: [_jsx("div", { className: "absolute left-0.5 right-0.5 h-2.5 rounded-sm transition-all duration-100", style: {
                            top: on ? '3px' : 'calc(100% - 13px)',
                            background: on
                                ? 'linear-gradient(180deg, #00cc77 0%, #009955 100%)'
                                : 'linear-gradient(180deg, #777 0%, #555 100%)',
                            boxShadow: on
                                ? '0 0 4px rgba(0, 204, 119, 0.5), inset 0 1px 0 rgba(255,255,255,0.3)'
                                : 'inset 0 1px 0 rgba(255,255,255,0.1)',
                        } }), _jsx("span", { className: "absolute top-1 left-1/2 -translate-x-1/2 text-[4px] font-bold text-[#666]", children: "1" }), _jsx("span", { className: "absolute bottom-1 left-1/2 -translate-x-1/2 text-[4px] font-bold text-[#666]", children: "0" })] }), label && (_jsx("span", { className: "text-[6px] font-mono text-[#d4a574]", children: label }))] }));
};
// Push button (square momentary)
const PushButton = ({ pressed, label, onPress, onRelease, disabled }) => {
    return (_jsxs("div", { className: "flex flex-col items-center gap-1", children: [_jsx("button", { type: "button", className: `
          w-5 h-5 rounded relative transition-all duration-75
          ${disabled ? 'cursor-default' : 'cursor-pointer'}
        `, style: {
                    background: pressed
                        ? 'linear-gradient(180deg, #1a1a1a 0%, #2a2a2a 100%)'
                        : 'linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 100%)',
                    border: '1px solid #555',
                    boxShadow: pressed
                        ? 'inset 0 2px 4px rgba(0,0,0,0.8)'
                        : '0 2px 4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
                    transform: pressed ? 'translateY(1px)' : 'none',
                }, onMouseDown: disabled ? undefined : onPress, onMouseUp: disabled ? undefined : onRelease, onMouseLeave: disabled ? undefined : onRelease, children: _jsx("div", { className: "absolute inset-1 rounded-sm", style: {
                        background: pressed
                            ? 'linear-gradient(180deg, #222 0%, #333 100%)'
                            : 'linear-gradient(180deg, #444 0%, #333 100%)',
                    } }) }), _jsx("span", { className: "text-[5px] font-mono text-[#d4a574] text-center leading-tight", children: label })] }));
};
// Character LCD component
const CharacterLCD = ({ text = '', rows = 2, cols = 16 }) => {
    // Split text into rows
    const lines = text.split('\n').slice(0, rows);
    return (_jsx("div", { className: "rounded p-1.5", style: {
            background: 'linear-gradient(180deg, #3a5a3a 0%, #2a4a2a 100%)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.05)',
            border: '2px solid #1a1a1a',
        }, children: _jsx("div", { className: "p-1 rounded-sm", style: {
                background: '#7a9a5a',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
            }, children: Array.from({ length: rows }).map((_, rowIdx) => (_jsx("div", { className: "flex", children: Array.from({ length: cols }).map((_, colIdx) => {
                    const char = lines[rowIdx]?.[colIdx] || ' ';
                    return (_jsx("div", { className: "w-2 h-3 flex items-center justify-center", style: {
                            color: '#1a3a1a',
                            textShadow: '0 0 2px rgba(0,0,0,0.3)',
                        }, children: _jsx("span", { className: "text-[7px] font-mono font-bold", children: char }) }, colIdx));
                }) }, rowIdx))) }) }));
};
// Rotary Encoder component
const RotaryEncoder = ({ label }) => {
    return (_jsxs("div", { className: "flex flex-col items-center gap-1", children: [_jsx("div", { className: "w-8 h-8 rounded-full relative", style: {
                    background: 'linear-gradient(135deg, #444 0%, #222 100%)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
                    border: '2px solid #555',
                }, children: _jsxs("div", { className: "absolute inset-1 rounded-full", style: {
                        background: 'linear-gradient(135deg, #666 0%, #333 100%)',
                        boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.2)',
                    }, children: [_jsx("div", { className: "absolute top-1 left-1/2 w-0.5 h-2 -translate-x-1/2 rounded-full", style: { background: '#ccc' } }), Array.from({ length: 12 }).map((_, i) => (_jsx("div", { className: "absolute w-0.5 h-1 bg-[#444]", style: {
                                top: '50%',
                                left: '50%',
                                transform: `rotate(${i * 30}deg) translateY(-10px) translateX(-50%)`,
                                transformOrigin: 'center bottom',
                            } }, i)))] }) }), label && (_jsx("span", { className: "text-[6px] font-mono text-[#d4a574]", children: label }))] }));
};
export const Spartan3EBoard = ({ ioSnapshot, onInteraction, readOnly = false, scale = 1, }) => {
    // Parse I/O values
    const swBits = useMemo(() => toBits(ioSnapshot?.inputs.SW, 4), [ioSnapshot?.inputs.SW]);
    const btnBits = useMemo(() => toBits(ioSnapshot?.inputs.BTN, 4), [ioSnapshot?.inputs.BTN]);
    const ledBits = useMemo(() => toBits(ioSnapshot?.outputs.LED, 8), [ioSnapshot?.outputs.LED]);
    // Handlers
    const toggleSwitch = useCallback((index) => {
        if (readOnly || !onInteraction)
            return;
        const current = typeof ioSnapshot?.inputs.SW === 'number'
            ? ioSnapshot.inputs.SW
            : parseInt(String(ioSnapshot?.inputs.SW ?? '0'), 2);
        const mask = 1 << (3 - index);
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
                    width: 380,
                    height: 280,
                    background: `
            linear-gradient(135deg, #8b2020 0%, #6b1515 50%, #4a1010 100%)
          `,
                    boxShadow: `
            0 4px 20px rgba(0,0,0,0.5),
            0 0 0 2px #3a0a0a,
            inset 0 0 60px rgba(0,0,0,0.3)
          `,
                }, children: [_jsx("div", { className: "absolute inset-0 opacity-20 pointer-events-none", style: {
                            backgroundImage: `
              repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px),
              repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)
            `,
                        } }), _jsxs("svg", { className: "absolute inset-0 w-full h-full pointer-events-none opacity-15", children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "copper-s3e", x1: "0%", y1: "0%", x2: "100%", y2: "100%", children: [_jsx("stop", { offset: "0%", stopColor: "#dda020" }), _jsx("stop", { offset: "100%", stopColor: "#aa7010" })] }) }), _jsx("path", { d: "M 20 140 L 70 140 L 70 100 L 120 100", fill: "none", stroke: "url(#copper-s3e)", strokeWidth: "1" }), _jsx("path", { d: "M 360 180 L 310 180 L 310 220 L 260 220", fill: "none", stroke: "url(#copper-s3e)", strokeWidth: "1" })] }), _jsxs("div", { className: "absolute top-3 left-3", children: [_jsx("div", { className: "text-[8px] font-bold tracking-widest text-[#d4a574]", children: "XILINX" }), _jsx("div", { className: "text-[12px] font-black tracking-tight text-[#ffccaa] mt-0.5", children: "SPARTAN-3E" }), _jsx("div", { className: "text-[7px] font-mono text-[#d4a574] mt-0.5", children: "STARTER KIT" })] }), _jsx("div", { className: "absolute top-14 left-1/2 -translate-x-1/2", children: _jsxs("div", { className: "w-20 h-20 rounded relative", style: {
                                background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
                                boxShadow: '0 4px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
                            }, children: [_jsx("div", { className: "absolute top-2 left-2 w-2 h-2 rounded-full bg-[#333]" }), _jsxs("div", { className: "absolute inset-0 flex flex-col items-center justify-center", children: [_jsx("span", { className: "text-[6px] font-mono text-[#666]", children: "XILINX" }), _jsx("span", { className: "text-[7px] font-bold text-[#888] mt-0.5", children: "XC3S500E" }), _jsx("span", { className: "text-[5px] font-mono text-[#555] mt-0.5", children: "SPARTAN-3E" })] })] }) }), _jsxs("div", { className: "absolute top-6 right-6", children: [_jsx("div", { className: "text-[5px] font-mono text-[#d4a574] mb-1", children: "LCD" }), _jsx(CharacterLCD, { text: "REDBYTE OS\\nSPARTAN-3E" })] }), _jsxs("div", { className: "absolute top-40 left-1/2 -translate-x-1/2", children: [_jsx("div", { className: "text-[6px] font-mono text-[#d4a574] mb-1 text-center", children: "LEDS" }), _jsx("div", { className: "flex gap-2", children: ledBits.map((on, i) => (_jsx(LED, { on: on, color: "green", label: `LD${7 - i}` }, i))) })] }), _jsxs("div", { className: "absolute bottom-16 right-8", children: [_jsx("div", { className: "text-[5px] font-mono text-[#d4a574] mb-1 text-center", children: "BUTTONS" }), _jsxs("div", { className: "grid grid-cols-3 gap-2 w-20", children: [_jsx("div", { className: "col-start-2 flex justify-center", children: _jsx(PushButton, { pressed: btnBits[1], label: "N", onPress: () => pressButton(2, true), onRelease: () => pressButton(2, false), disabled: readOnly }) }), _jsx("div", { className: "flex justify-center items-center", children: _jsx(PushButton, { pressed: btnBits[3], label: "W", onPress: () => pressButton(0, true), onRelease: () => pressButton(0, false), disabled: readOnly }) }), _jsx("div", {}), _jsx("div", { className: "flex justify-center items-center", children: _jsx(PushButton, { pressed: btnBits[0], label: "E", onPress: () => pressButton(3, true), onRelease: () => pressButton(3, false), disabled: readOnly }) }), _jsx("div", { className: "col-start-2 flex justify-center", children: _jsx(PushButton, { pressed: btnBits[2], label: "S", onPress: () => pressButton(1, true), onRelease: () => pressButton(1, false), disabled: readOnly }) })] })] }), _jsxs("div", { className: "absolute bottom-8 left-8", children: [_jsx("div", { className: "text-[5px] font-mono text-[#d4a574] mb-1 text-center", children: "SW" }), _jsx("div", { className: "flex gap-2", children: swBits.map((on, i) => (_jsx(SlideSwitch, { on: on, label: `${3 - i}`, onClick: () => toggleSwitch(i), disabled: readOnly }, i))) })] }), _jsx("div", { className: "absolute bottom-16 left-24", children: _jsx(RotaryEncoder, { label: "ROT" }) }), _jsxs("div", { className: "absolute top-3 right-3 flex items-center gap-1", children: [_jsx(LED, { on: true, color: "green" }), _jsx("span", { className: "text-[5px] font-mono text-[#d4a574]", children: "PWR" })] }), _jsxs("div", { className: "absolute top-8 right-3 flex items-center gap-1", children: [_jsx(LED, { on: true, color: "amber" }), _jsx("span", { className: "text-[5px] font-mono text-[#d4a574]", children: "DONE" })] }), _jsxs("div", { className: "absolute bottom-4 left-4", children: [_jsx("div", { className: "text-[4px] font-mono text-[#d4a574] mb-0.5", children: "RS232" }), _jsx("div", { className: "w-10 h-5 rounded-sm", style: {
                                    background: 'linear-gradient(180deg, #888 0%, #666 100%)',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
                                } })] }), _jsxs("div", { className: "absolute bottom-4 right-4", children: [_jsx("div", { className: "text-[4px] font-mono text-[#d4a574] mb-0.5", children: "JTAG" }), _jsx("div", { className: "w-8 h-3 rounded-sm grid grid-cols-7 gap-0.5 p-0.5", style: {
                                    background: '#1a1a1a',
                                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
                                }, children: Array.from({ length: 14 }).map((_, j) => (_jsx("div", { className: "w-0.5 h-0.5 rounded-full bg-[#444]" }, j))) })] }), _jsx("div", { className: "absolute top-36 left-6", children: _jsxs("div", { className: "w-10 h-6 rounded-sm relative", style: {
                                background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                            }, children: [_jsx("div", { className: "absolute top-0.5 left-0.5 w-1 h-1 rounded-full bg-[#333]" }), _jsx("div", { className: "absolute inset-0 flex items-center justify-center", children: _jsx("span", { className: "text-[4px] font-mono text-[#555]", children: "FLASH" }) })] }) }), _jsx("div", { className: "absolute bottom-2 right-20 text-[5px] font-mono text-[#8a4a4a]", children: "REV D" }), _jsx("div", { className: "absolute top-1 left-1 w-3 h-3 border-t border-l border-[#d4a574] opacity-40" }), _jsx("div", { className: "absolute top-1 right-1 w-3 h-3 border-t border-r border-[#d4a574] opacity-40" }), _jsx("div", { className: "absolute bottom-1 left-1 w-3 h-3 border-b border-l border-[#d4a574] opacity-40" }), _jsx("div", { className: "absolute bottom-1 right-1 w-3 h-3 border-b border-r border-[#d4a574] opacity-40" })] }), ioSnapshot?.tick !== undefined && (_jsxs("div", { className: "absolute -bottom-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full", style: {
                    background: 'linear-gradient(180deg, #2a1a1a 0%, #1a0f0f 100%)',
                    border: '1px solid #4a2a2a',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                }, children: [_jsx("span", { className: "text-[10px] font-mono text-gray-500", children: "TICK " }), _jsx("span", { className: "text-[11px] font-mono font-bold text-amber-400", children: ioSnapshot.tick })] }))] }));
};
export default Spartan3EBoard;
