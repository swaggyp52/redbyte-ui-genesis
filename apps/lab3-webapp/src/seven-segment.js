import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const SevenSegmentDisplay = ({ seg, size = 100 }) => {
    const [a, b, c, d, e, f, g] = seg;
    const styles = {
        display: 'inline-block',
        position: 'relative',
        width: size,
        height: size * 1.5,
        backgroundColor: '#1a1a1a',
        padding: size * 0.1,
        borderRadius: 4,
    };
    const segmentStyle = (active) => ({
        position: 'absolute',
        backgroundColor: active === 0 ? '#00ff00' : '#333333',
        transition: 'background-color 0.2s',
    });
    const w = size * 0.8;
    const h = size * 0.4;
    const t = size * 0.1;
    return (_jsxs("div", { style: styles, children: [_jsx("div", { style: { ...segmentStyle(a), top: t, left: '10%', width: '80%', height: h / 2 } }), _jsx("div", { style: { ...segmentStyle(f), top: t + h / 2, left: t, width: h / 2, height: h } }), _jsx("div", { style: { ...segmentStyle(b), top: t + h / 2, right: t, width: h / 2, height: h } }), _jsx("div", { style: { ...segmentStyle(g), top: t + h, left: '10%', width: '80%', height: h / 2 } }), _jsx("div", { style: { ...segmentStyle(e), top: t + h + h / 2, left: t, width: h / 2, height: h } }), _jsx("div", { style: { ...segmentStyle(c), top: t + h + h / 2, right: t, width: h / 2, height: h } }), _jsx("div", { style: { ...segmentStyle(d), bottom: t, left: '10%', width: '80%', height: h / 2 } })] }));
};
