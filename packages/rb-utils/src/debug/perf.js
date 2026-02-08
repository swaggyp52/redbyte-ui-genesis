// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
const isDev = import.meta.env.DEV;
const measureBuckets = new Map();
const renderCounts = new Map();
const componentRenderCounts = new Map();
let perfLoggerInterval = null;
const MAX_SAMPLES = 120;
const isPerfQueryEnabled = () => {
    if (typeof window === 'undefined')
        return false;
    return new URLSearchParams(window.location.search).get('perf') === '1';
};
const shouldCollectPerf = () => isDev || isPerfQueryEnabled();
export const isPerfDebugEnabled = () => {
    return isPerfQueryEnabled();
};
export const mark = (name) => {
    if (!shouldCollectPerf() || typeof performance === 'undefined')
        return;
    performance.mark(name);
};
export const measure = (name, start, end) => {
    if (!shouldCollectPerf() || typeof performance === 'undefined')
        return;
    try {
        performance.measure(name, start, end);
        const entries = performance.getEntriesByName(name);
        const entry = entries[entries.length - 1];
        if (!entry)
            return;
        const bucket = measureBuckets.get(name) ?? [];
        bucket.push(entry.duration);
        if (bucket.length > MAX_SAMPLES) {
            bucket.splice(0, bucket.length - MAX_SAMPLES);
        }
        measureBuckets.set(name, bucket);
        performance.clearMarks(start);
        if (end) {
            performance.clearMarks(end);
        }
        performance.clearMeasures(name);
    }
    catch {
        // Ignore invalid marks in dev-only tooling.
    }
};
export const logPerfSummary = () => {
    if (!shouldCollectPerf())
        return;
    const summary = [];
    measureBuckets.forEach((values, key) => {
        if (!values.length)
            return;
        const total = values.reduce((sum, value) => sum + value, 0);
        const max = values.reduce((currentMax, value) => Math.max(currentMax, value), 0);
        summary.push({
            name: key,
            avg: total / values.length,
            max,
            count: values.length,
        });
    });
    if (summary.length === 0)
        return;
    const top = summary.sort((a, b) => b.avg - a.avg).slice(0, 5);
    console.table(top.map((entry) => ({
        name: entry.name,
        avgMs: entry.avg.toFixed(2),
        maxMs: entry.max.toFixed(2),
        samples: entry.count,
    })));
};
export const startPerfSummaryLogger = (intervalMs = 4000) => {
    if (!isPerfDebugEnabled())
        return;
    if (perfLoggerInterval !== null)
        return;
    perfLoggerInterval = window.setInterval(() => {
        logPerfSummary();
    }, intervalMs);
};
export const stopPerfSummaryLogger = () => {
    if (perfLoggerInterval === null)
        return;
    window.clearInterval(perfLoggerInterval);
    perfLoggerInterval = null;
};
/**
 * Track render counts for a component. Call this at the top of a component.
 * This is a plain function that doesn't use React hooks - it just increments
 * a global counter for the component name.
 */
export const trackRender = (name) => {
    if (!isDev)
        return;
    const count = (componentRenderCounts.get(name) ?? 0) + 1;
    componentRenderCounts.set(name, count);
    renderCounts.set(name, count);
};
export const getRenderCounts = () => {
    if (!isDev)
        return {};
    return Object.fromEntries(renderCounts.entries());
};
