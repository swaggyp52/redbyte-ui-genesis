import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { UniverseOrb } from './UniverseOrb';
const BOOT_DURATION_MS = 15000;
const BOOT_TIPS = [
    'power-on self test',
    'mounting workspace',
    'linking redstone graph',
    'warming instruction cache',
    'arming debugger hooks',
    'finalizing session',
];
export const BootScreen = ({ onComplete }) => {
    const [progress, setProgress] = useState(0);
    const [tipIndex, setTipIndex] = useState(0);
    const [log, setLog] = useState([
        '[  ok ] boot sequence started',
        '[  ok ] video: tailwind compositor online',
        '[  ok ] input: pointer + keyboard bound',
    ]);
    useEffect(() => {
        const start = performance.now();
        let doneTimeout;
        const tick = () => {
            const now = performance.now();
            const pct = Math.min(1, (now - start) / BOOT_DURATION_MS);
            setProgress(pct);
            if (pct < 1) {
                requestAnimationFrame(tick);
            }
            else {
                setLog((prev) => [...prev, '[  ok ] environment ready']);
                doneTimeout = window.setTimeout(() => {
                    onComplete();
                }, 600);
            }
        };
        const tipTimer = window.setInterval(() => {
            setTipIndex((i) => (i + 1) % BOOT_TIPS.length);
            setLog((prev) => [
                ...prev,
                `[ ... ] ${BOOT_TIPS[(tipIndex + 1) % BOOT_TIPS.length]}`,
            ]);
        }, 2200);
        tick();
        return () => {
            window.clearInterval(tipTimer);
            if (doneTimeout)
                window.clearTimeout(doneTimeout);
        };
    }, [onComplete, tipIndex]);
    const percent = Math.round(progress * 100);
    return (_jsxs("div", { className: "h-screen w-screen bg-[#02010a] text-slate-50 flex flex-col items-center justify-center overflow-hidden relative", children: [_jsxs("div", { className: "pointer-events-none absolute inset-0 opacity-60", children: [_jsx("div", { className: "absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(248,113,113,0.3),transparent_60%),radial-gradient(circle_at_90%_100%,rgba(239,68,68,0.18),transparent_60%)] blur-3xl" }), _jsx("div", { className: "absolute inset-0 bg-[linear-gradient(to_right,rgba(148,27,37,0.22)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.75)_1px,transparent_1px)] bg-[size:32px_32px]" })] }), _jsxs("div", { className: "relative z-10 flex flex-col items-center gap-10 px-4", children: [_jsx("div", { className: "animate-[spin_48s_linear_infinite]", children: _jsx(UniverseOrb, { progress: progress }) }), _jsxs("div", { className: "w-full max-w-xl space-y-3", children: [_jsx("div", { className: "h-2 rounded-full bg-slate-900/80 border border-red-900/70 overflow-hidden", children: _jsx("div", { className: "h-full rounded-full bg-gradient-to-r from-red-500 via-rose-400 to-amber-300 transition-all duration-200", style: { width: `${percent}%` } }) }), _jsxs("div", { className: "flex items-center justify-between text-[10px] tracking-[0.22em] uppercase text-slate-300/80", children: [_jsx("span", { children: "booting redbyte os" }), _jsxs("span", { children: [percent, "%"] })] }), _jsx("div", { className: "mt-1 text-[11px] text-red-200/90 font-mono", children: BOOT_TIPS[tipIndex] })] }), _jsxs("div", { className: "w-full max-w-xl rounded-xl border border-red-900/70 bg-black/70 backdrop-blur-sm shadow-[0_0_40px_rgba(127,29,29,0.6)]", children: [_jsxs("div", { className: "h-7 px-3 flex items-center justify-between border-b border-red-900/70 text-[10px] uppercase tracking-[0.18em] text-red-200/80", children: [_jsx("span", { children: "boot log" }), _jsx("span", { children: "redbyte" })] }), _jsx("div", { className: "p-3 font-mono text-[11px] text-slate-200/90 max-h-32 overflow-hidden", children: log.slice(-5).map((line, idx) => (_jsx("div", { children: line }, idx))) })] })] })] }));
};
