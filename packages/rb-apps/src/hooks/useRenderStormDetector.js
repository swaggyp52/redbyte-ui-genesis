// Dev-only helper to surface render storms without affecting production builds.
import { useEffect, useRef } from 'react';
function getRenderStormGlobal() {
    const key = '__RB_RENDER_STORM__';
    const anyGlobal = globalThis;
    if (!anyGlobal[key]) {
        anyGlobal[key] = {
            started: false,
            counts: {},
            maxPerSecond: {},
            maxTotalPerSecond: 0,
            samples: [],
            steps: [],
            warnings: [],
            leaks: {
                patched: false,
                baseline: { intervals: 0, timeouts: 0, rafs: 0 },
                active: { intervals: 0, timeouts: 0, rafs: 0 },
                handleTypes: new Map(),
            },
        };
    }
    return anyGlobal[key];
}
function isTopOffendersReportEnabled() {
    try {
        const anyGlobal = globalThis;
        if (anyGlobal.__RB_RENDER_STORM_REPORT__ === true)
            return true;
        if (typeof localStorage === 'undefined')
            return false;
        return localStorage.getItem('rb:renderStormReport') === '1';
    }
    catch {
        return false;
    }
}
function ensureTimerLeakPatchOnce() {
    const global = getRenderStormGlobal();
    if (global.leaks.patched)
        return;
    if (typeof window === 'undefined')
        return;
    // Headless Chromium can be sensitive to monkey-patching timer APIs; keep leak counters for manual (human) runs.
    if (typeof navigator !== 'undefined' && navigator.webdriver)
        return;
    global.leaks.patched = true;
    const w = window;
    if (w.__RB_TIMER_LEAK_PATCHED__)
        return;
    w.__RB_TIMER_LEAK_PATCHED__ = true;
    const originalSetInterval = window.setInterval.bind(window);
    const originalClearInterval = window.clearInterval.bind(window);
    const originalSetTimeout = window.setTimeout.bind(window);
    const originalClearTimeout = window.clearTimeout.bind(window);
    const originalRaf = window.requestAnimationFrame?.bind(window);
    const originalCancelRaf = window.cancelAnimationFrame?.bind(window);
    const active = global.leaks.active;
    const handleTypes = global.leaks.handleTypes;
    const markCreated = (id, type) => {
        handleTypes.set(id, type);
        if (type === 'interval')
            active.intervals += 1;
        if (type === 'timeout')
            active.timeouts += 1;
        if (type === 'raf')
            active.rafs += 1;
    };
    const markCleared = (id) => {
        const type = handleTypes.get(id);
        if (!type)
            return;
        handleTypes.delete(id);
        if (type === 'interval')
            active.intervals = Math.max(0, active.intervals - 1);
        if (type === 'timeout')
            active.timeouts = Math.max(0, active.timeouts - 1);
        if (type === 'raf')
            active.rafs = Math.max(0, active.rafs - 1);
    };
    window.setInterval = ((handler, timeout, ...args) => {
        const id = originalSetInterval(handler, timeout, ...args);
        markCreated(id, 'interval');
        return id;
    });
    window.clearInterval = ((id) => {
        if (typeof id === 'number')
            markCleared(id);
        return originalClearInterval(id);
    });
    window.setTimeout = ((handler, timeout, ...args) => {
        const id = originalSetTimeout(handler, timeout, ...args);
        markCreated(id, 'timeout');
        return id;
    });
    window.clearTimeout = ((id) => {
        if (typeof id === 'number')
            markCleared(id);
        return originalClearTimeout(id);
    });
    if (originalRaf && originalCancelRaf) {
        window.requestAnimationFrame = ((cb) => {
            const id = originalRaf(cb);
            markCreated(id, 'raf');
            return id;
        });
        window.cancelAnimationFrame = ((id) => {
            markCleared(id);
            return originalCancelRaf(id);
        });
    }
}
function ensureRenderStormApiOnce() {
    const global = getRenderStormGlobal();
    if (typeof window === 'undefined')
        return;
    const w = window;
    if (w.__RB_RENDER_STORM_API__)
        return;
    w.__RB_RENDER_STORM_API__ = {
        markStep: (name) => {
            const tMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
            global.steps.push({ name, tMs });
            // eslint-disable-next-line no-console
            console.info('[render-storm:step]', { name, tMs });
        },
        getReport: () => {
            const tMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
            const leaksNow = global.leaks.active;
            const leaksBaseline = global.leaks.baseline;
            const leaksDelta = {
                intervals: leaksNow.intervals - leaksBaseline.intervals,
                timeouts: leaksNow.timeouts - leaksBaseline.timeouts,
                rafs: leaksNow.rafs - leaksBaseline.rafs,
            };
            const maxLabelRendersPerSecond = Object.values(global.maxPerSecond).reduce((m, n) => Math.max(m, n), 0);
            const leaksPass = leaksDelta.intervals === 0 && leaksDelta.timeouts === 0 && leaksDelta.rafs === 0;
            const warnings = [...global.warnings].sort((a, b) => a.tMs - b.tMs || a.label.localeCompare(b.label));
            const report = {
                kind: 'rb-render-storm-report',
                startedAtIso: global.startedAtIso ?? new Date().toISOString(),
                durationMs: global.startedAtMs != null ? Math.max(0, tMs - global.startedAtMs) : undefined,
                steps: [...global.steps].sort((a, b) => a.tMs - b.tMs),
                warnings,
                maxTotalRendersPerSecond: global.maxTotalPerSecond,
                maxLabelRendersPerSecond,
                maxRendersPerSecondByLabel: Object.fromEntries(Object.entries(global.maxPerSecond).sort((a, b) => a[0].localeCompare(b[0]))),
                lastSampleTopOffenders: global.samples.length > 0 ? global.samples[global.samples.length - 1].offenders : [],
                leaks: {
                    baseline: leaksBaseline,
                    active: leaksNow,
                    delta: leaksDelta,
                },
                pass: warnings.length === 0 && leaksPass,
                passReasons: {
                    warnings: warnings.length === 0,
                    leaks: leaksPass,
                },
            };
            return report;
        },
        finalize: () => {
            const report = w.__RB_RENDER_STORM_API__.getReport();
            w.__RB_RENDER_STORM_REPORT__ = report;
            // eslint-disable-next-line no-console
            console.info('[render-storm:report]', report);
            return report;
        },
    };
}
function startTopOffendersReporterOnce() {
    const global = getRenderStormGlobal();
    if (global.started)
        return;
    global.started = true;
    global.startedAtMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    global.startedAtIso = new Date().toISOString();
    const intervalMs = 1000;
    const topN = 8;
    setInterval(() => {
        const entries = Object.entries(global.counts)
            .map(([label, renders]) => ({ label, renders }))
            .filter((e) => e.renders > 0)
            .sort((a, b) => (b.renders - a.renders) || a.label.localeCompare(b.label))
            .slice(0, topN);
        for (const { label, renders } of entries) {
            global.maxPerSecond[label] = Math.max(global.maxPerSecond[label] ?? 0, renders);
        }
        const total = Object.values(global.counts).reduce((sum, n) => sum + n, 0);
        global.maxTotalPerSecond = Math.max(global.maxTotalPerSecond, total);
        const tMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
        global.samples.push({ tMs, offenders: entries });
        if (global.samples.length > 180)
            global.samples.shift();
        if (entries.length > 0) {
            // eslint-disable-next-line no-console
            console.log('[render-storm:top]', {
                offenders: entries,
                hint: 'Disable with localStorage.removeItem("rb:renderStormReport")',
            });
        }
        global.counts = {};
    }, intervalMs);
    // Baseline timers/RAFs after enabling reporting so leak deltas ignore the reporter itself.
    global.leaks.baseline = { ...global.leaks.active };
}
export function useRenderStormDetector(label, thresholdPerSecond = 60) {
    const isPlaywright = typeof navigator !== 'undefined' && navigator.webdriver;
    if (!import.meta.env.DEV && !isPlaywright)
        return;
    const topOffendersEnabled = isTopOffendersReportEnabled();
    if (topOffendersEnabled) {
        ensureTimerLeakPatchOnce();
        ensureRenderStormApiOnce();
        startTopOffendersReporterOnce();
    }
    const countRef = useRef(0);
    const gateRef = useRef(false);
    const startRef = useRef(performance.now());
    countRef.current += 1;
    if (topOffendersEnabled) {
        const global = getRenderStormGlobal();
        global.counts[label] = (global.counts[label] ?? 0) + 1;
    }
    useEffect(() => {
        const now = performance.now();
        if (now - startRef.current > 1000) {
            startRef.current = now;
            countRef.current = 0;
            gateRef.current = false;
        }
        if (!gateRef.current && countRef.current > thresholdPerSecond) {
            gateRef.current = true;
            if (topOffendersEnabled) {
                const global = getRenderStormGlobal();
                const tMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
                global.warnings.push({ label, renders: countRef.current, tMs });
            }
            // eslint-disable-next-line no-console
            console.warn(`[render-storm] ${label}`, { renders: countRef.current, stack: new Error().stack });
        }
    });
}
