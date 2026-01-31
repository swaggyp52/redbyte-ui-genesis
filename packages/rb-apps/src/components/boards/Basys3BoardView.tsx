
import React, { useState } from 'react';
import {
    BASYS3_WIDTH, BASYS3_HEIGHT,
    SWITCH_POSITIONS, LED_POSITIONS, BUTTON_POSITIONS,
    type ElementPosition
} from './Basys3Layout';

export interface Basys3BoardViewProps {
    width?: number;
    height?: number;

    // State (from Store)
    switches: boolean[]; // 16 bools
    leds: boolean[];     // 16 bools
    buttons: Record<string, boolean>; // BTNC, etc.

    // Mapping Info (for tooltips/highlights)
    mappedSignals: {
        switches: Record<number, string>; // index -> signalName
        leds: Record<number, string>;     // index -> signalName
        buttons: Record<string, string>;  // id -> signalName
    };

    // Callbacks
    onToggleSwitch: (index: number) => void;
    onPressButton: (id: string, down: boolean) => void;
    onInspectLED: (index: number) => void; // Open inspector
}

export const Basys3BoardView: React.FC<Basys3BoardViewProps> = ({
    width = 800,
    height = 500,
    switches,
    leds,
    buttons,
    mappedSignals,
    onToggleSwitch,
    onPressButton,
    onInspectLED
}) => {
    // Internal tooltip state
    const [hoveredElement, setHoveredElement] = useState<{ type: string; index: number | string; x: number; y: number } | null>(null);

    // Scaling to fit container
    const viewBox = `0 0 ${BASYS3_WIDTH} ${BASYS3_HEIGHT}`;

    return (
        <div className="relative w-full h-full flex items-center justify-center bg-gray-900 overflow-hidden select-none">
            <svg
                viewBox={viewBox}
                className="w-full h-full max-w-4xl max-h-[80vh]"
                style={{ filter: 'drop-shadow(0 20px 50px rgba(0,0,0,0.5))' }}
            >
                {/* Board PCB Background */}
                <rect
                    x={20} y={20}
                    width={BASYS3_WIDTH - 40}
                    height={BASYS3_HEIGHT - 40}
                    rx={15}
                    fill="#1a4731" // PCB Green
                    stroke="#113022"
                    strokeWidth={4}
                />
                <text x={BASYS3_WIDTH / 2} y={80} textAnchor="middle" fill="#aaa" fontFamily="monospace" fontSize={24} fontWeight="bold">
                    BASYS3 VIRTUAL
                </text>

                {/* --- Switches --- */}
                {Object.entries(SWITCH_POSITIONS).map(([idxStr, pos]) => {
                    const i = parseInt(idxStr);
                    const isOn = switches[i];
                    const signal = mappedSignals.switches[i];

                    return (
                        <g
                            key={`sw-${i}`}
                            transform={`translate(${pos.x}, ${pos.y})`}
                            onClick={() => onToggleSwitch(i)}
                            onMouseEnter={() => setHoveredElement({ type: 'SWITCH', index: i, x: pos.x, y: pos.y })}
                            onMouseLeave={() => setHoveredElement(null)}
                            style={{ cursor: 'pointer' }}
                        >
                            {/* Label */}
                            <text y={35} textAnchor="middle" fill="#888" fontSize={10} fontFamily="monospace">SW{i}</text>

                            {/* Switch Body */}
                            <rect x={-10} y={-20} width={20} height={40} fill="#333" stroke="#111" />

                            {/* Toggle Lever */}
                            <rect
                                x={-8}
                                y={isOn ? -25 : -5}
                                width={16}
                                height={25}
                                fill="#ddd"
                                rx={2}
                                style={{ transition: 'y 0.1s ease-out' }}
                            />

                            {/* Active Indicator (Mapped) */}
                            {signal && (
                                <circle cx={0} cy={25} r={2} fill="#3b82f6" opacity={0.8} />
                            )}
                        </g>
                    );
                })}

                {/* --- LEDs --- */}
                {Object.entries(LED_POSITIONS).map(([idxStr, pos]) => {
                    const i = parseInt(idxStr);
                    const isLit = leds[i];
                    const signal = mappedSignals.leds[i];

                    return (
                        <g
                            key={`led-${i}`}
                            transform={`translate(${pos.x}, ${pos.y})`}
                            onClick={() => onInspectLED(i)}
                            onMouseEnter={() => setHoveredElement({ type: 'LED', index: i, x: pos.x, y: pos.y })}
                            onMouseLeave={() => setHoveredElement(null)}
                            style={{ cursor: 'pointer' }}
                        >
                            {/* Label */}
                            <text y={-20} textAnchor="middle" fill="#888" fontSize={10} fontFamily="monospace">LD{i}</text>

                            {/* LED Base */}
                            <rect x={-5} y={-5} width={10} height={10} fill="#222" />

                            {/* Light */}
                            <circle
                                r={isLit ? 6 : 4}
                                fill={isLit ? '#22c55e' : '#1e3a2a'}
                                stroke={isLit ? '#4ade80' : '#111'}
                                strokeWidth={isLit ? 2 : 1}
                            />

                            {/* Glow Effect */}
                            {isLit && (
                                <circle r={10} fill="url(#led-glow)" opacity={0.6} pointerEvents="none" />
                            )}
                        </g>
                    );
                })}

                {/* Buttons (Simplistic) */}
                {Object.entries(BUTTON_POSITIONS).map(([id, pos]) => {
                    const isPressed = buttons[id];
                    return (
                        <g
                            key={id}
                            transform={`translate(${pos.x}, ${pos.y})`}
                            onMouseDown={() => onPressButton(id, true)}
                            onMouseUp={() => onPressButton(id, false)}
                            onMouseLeave={() => onPressButton(id, false)}
                            style={{ cursor: 'pointer' }}
                        >
                            <circle r={18} fill="#222" stroke="#111" strokeWidth={2} />
                            <circle r={14} fill={isPressed ? "#444" : "#111"} />
                            <text y={4} textAnchor="middle" fill="#666" fontSize={10} pointerEvents="none">{pos.label}</text>
                        </g>
                    )
                })}

                {/* Shared Defs */}
                <defs>
                    <radialGradient id="led-glow">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                    </radialGradient>
                </defs>
            </svg>

            {/* Tooltip Overlay */}
            {hoveredElement && (
                <div
                    className="absolute pointer-events-none bg-black/90 text-white text-xs px-2 py-1 rounded border border-gray-700 shadow-xl z-50 flex flex-col gap-0.5"
                    style={{
                        // Simplified positioning logic (center screen usually, but let's try to track projected position if possible)
                        // Since SVG scales, exact pixel tracking is hard without `getBoundingClientRect`.
                        // For a board view, a fixed display in corner is often cleaner than a floating tooltip.
                        bottom: 20,
                        left: '50%',
                        transform: 'translateX(-50%)'
                    }}
                >
                    <div className="font-bold text-gray-400 uppercase tracking-wider">{hoveredElement.type} {hoveredElement.index}</div>
                    {hoveredElement.type === 'SWITCH' && (
                        <div>
                            Signal: <span className="text-blue-400">{mappedSignals.switches[hoveredElement.index as number] || 'Unmapped'}</span>
                            <span className="mx-2 text-gray-600">|</span>
                            Value: <span className={switches[hoveredElement.index as number] ? 'text-green-400' : 'text-gray-400'}>{switches[hoveredElement.index as number] ? '1 (ON)' : '0 (OFF)'}</span>
                        </div>
                    )}
                    {hoveredElement.type === 'LED' && (
                        <div>
                            Signal: <span className="text-blue-400">{mappedSignals.leds[hoveredElement.index as number] || 'Unmapped'}</span>
                            <span className="mx-2 text-gray-600">|</span>
                            State: <span className={leds[hoveredElement.index as number] ? 'text-green-400' : 'text-gray-400'}>{leds[hoveredElement.index as number] ? 'HIGH' : 'LOW'}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
