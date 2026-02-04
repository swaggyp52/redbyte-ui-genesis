// Dev-only helper to surface render storms without affecting production builds.
import { useEffect, useRef } from 'react';

type RenderStormGlobal = {
  started: boolean;
  counts: Record<string, number>;
  maxPerSecond: Record<string, number>;
};

function getRenderStormGlobal(): RenderStormGlobal {
  const key = '__RB_RENDER_STORM__';
  const anyGlobal = globalThis as any;
  if (!anyGlobal[key]) {
    anyGlobal[key] = { started: false, counts: {}, maxPerSecond: {} } satisfies RenderStormGlobal;
  }
  return anyGlobal[key] as RenderStormGlobal;
}

function isTopOffendersReportEnabled(): boolean {
  try {
    const anyGlobal = globalThis as any;
    if (anyGlobal.__RB_RENDER_STORM_REPORT__ === true) return true;
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('rb:renderStormReport') === '1';
  } catch {
    return false;
  }
}

function startTopOffendersReporterOnce() {
  const global = getRenderStormGlobal();
  if (global.started) return;
  global.started = true;

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

    if (entries.length > 0) {
      // eslint-disable-next-line no-console
      console.log('[render-storm:top]', {
        offenders: entries,
        hint: 'Disable with localStorage.removeItem("rb:renderStormReport")',
      });
    }

    global.counts = {};
  }, intervalMs);
}

export function useRenderStormDetector(label: string, thresholdPerSecond: number = 60) {
  const isPlaywright = typeof navigator !== 'undefined' && navigator.webdriver;
  if (!import.meta.env.DEV && !isPlaywright) return;

  const topOffendersEnabled = isTopOffendersReportEnabled();
  if (topOffendersEnabled) startTopOffendersReporterOnce();

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
      // eslint-disable-next-line no-console
      console.warn(`[render-storm] ${label}`, { renders: countRef.current, stack: new Error().stack });
    }
  });
}
