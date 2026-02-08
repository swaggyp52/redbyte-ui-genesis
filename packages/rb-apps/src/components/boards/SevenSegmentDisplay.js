import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Segment layout:
//    AAA
//   F   B
//   F   B
//    GGG
//   E   C
//   E   C
//    DDD  .DP
const Segment = ({ on, type, color, glowColor, style }) => {
    const baseColor = '#1a1210';
    if (type === 'h') {
        // Horizontal segment (A, G, D)
        return (_jsx("div", { className: "absolute transition-all duration-50", style: {
                width: 16,
                height: 3,
                clipPath: 'polygon(2px 0, calc(100% - 2px) 0, 100% 50%, calc(100% - 2px) 100%, 2px 100%, 0 50%)',
                background: on ? color : baseColor,
                boxShadow: on ? `0 0 6px 2px ${glowColor}` : 'none',
                ...style,
            } }));
    }
    // Vertical segment (B, C, E, F)
    return (_jsx("div", { className: "absolute transition-all duration-50", style: {
            width: 3,
            height: 10,
            clipPath: 'polygon(0 2px, 50% 0, 100% 2px, 100% calc(100% - 2px), 50% 100%, 0 calc(100% - 2px))',
            background: on ? color : baseColor,
            boxShadow: on ? `0 0 6px 2px ${glowColor}` : 'none',
            ...style,
        } }));
};
const Digit = ({ segments, enabled, color, glowColor }) => {
    // Parse segments (active low for common anode displays)
    // Bit order: DP-G-F-E-D-C-B-A (MSB to LSB)
    const segA = enabled && !(segments & 0x01);
    const segB = enabled && !(segments & 0x02);
    const segC = enabled && !(segments & 0x04);
    const segD = enabled && !(segments & 0x08);
    const segE = enabled && !(segments & 0x10);
    const segF = enabled && !(segments & 0x20);
    const segG = enabled && !(segments & 0x40);
    const segDP = enabled && !(segments & 0x80);
    return (_jsxs("div", { className: "relative", style: { width: 24, height: 36 }, children: [_jsx("div", { className: "absolute inset-0 rounded-sm", style: {
                    background: 'linear-gradient(135deg, #0a0806 0%, #151210 100%)',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8)',
                } }), _jsx(Segment, { on: segA, type: "h", color: color, glowColor: glowColor, style: { top: 2, left: 4 } }), _jsx(Segment, { on: segB, type: "v", color: color, glowColor: glowColor, style: { top: 4, left: 18 } }), _jsx(Segment, { on: segC, type: "v", color: color, glowColor: glowColor, style: { top: 16, left: 18 } }), _jsx(Segment, { on: segD, type: "h", color: color, glowColor: glowColor, style: { top: 28, left: 4 } }), _jsx(Segment, { on: segE, type: "v", color: color, glowColor: glowColor, style: { top: 16, left: 2 } }), _jsx(Segment, { on: segF, type: "v", color: color, glowColor: glowColor, style: { top: 4, left: 2 } }), _jsx(Segment, { on: segG, type: "h", color: color, glowColor: glowColor, style: { top: 15, left: 4 } }), _jsx("div", { className: "absolute rounded-full transition-all duration-50", style: {
                    width: 3,
                    height: 3,
                    bottom: 3,
                    right: 1,
                    background: segDP ? color : '#1a1210',
                    boxShadow: segDP ? `0 0 4px 2px ${glowColor}` : 'none',
                } })] }));
};
export const SevenSegmentDisplay = ({ segments, anodes, digits = 4, color = 'red', size = 'md', }) => {
    const colors = {
        red: { lit: '#ff2020', glow: 'rgba(255, 32, 32, 0.6)' },
        green: { lit: '#20ff40', glow: 'rgba(32, 255, 64, 0.6)' },
        amber: { lit: '#ffaa00', glow: 'rgba(255, 170, 0, 0.6)' },
        cyan: { lit: '#00ffff', glow: 'rgba(0, 255, 255, 0.6)' },
    };
    const c = colors[color];
    const scale = { sm: 0.7, md: 1, lg: 1.4 }[size];
    return (_jsx("div", { className: "flex gap-1 p-1.5 rounded", style: {
            background: 'linear-gradient(180deg, #0a0806 0%, #151210 100%)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.05)',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
        }, children: Array.from({ length: digits }).map((_, i) => {
            // Each digit is enabled when its anode bit is LOW (active low)
            const enabled = !(anodes & (1 << (digits - 1 - i)));
            return (_jsx(Digit, { segments: segments, enabled: enabled, color: c.lit, glowColor: c.glow }, i));
        }) }));
};
export default SevenSegmentDisplay;
