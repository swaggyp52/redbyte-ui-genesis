// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Error reporting pipeline for RedByte OS.
 *
 * Dev: logs to console via systemLogStore.
 * Prod: batches + samples errors to a stub endpoint (swap in Sentry/custom later).
 *
 * Captures:
 * - Unhandled exceptions (window.onerror)
 * - Unhandled promise rejections
 * - Performance budget violations (sampled)
 * - Explicit reportError() calls from app code
 *
 * Breadcrumbs: last N user actions for context on crash reports.
 */

import { logSystemEvent } from '../stores/systemLogStore';

// ---------------------------------------------------------------------------
// Breadcrumbs — circular buffer of recent actions for crash context
// ---------------------------------------------------------------------------

export interface Breadcrumb {
  type: 'action' | 'navigation' | 'network' | 'error' | 'perf';
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

const MAX_BREADCRUMBS = 30;
const breadcrumbs: Breadcrumb[] = [];

export function addBreadcrumb(crumb: Omit<Breadcrumb, 'timestamp'>): void {
  breadcrumbs.push({ ...crumb, timestamp: Date.now() });
  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }
}

export function getBreadcrumbs(): ReadonlyArray<Breadcrumb> {
  return breadcrumbs;
}

// ---------------------------------------------------------------------------
// Error Report type
// ---------------------------------------------------------------------------

export interface ErrorReport {
  message: string;
  stack?: string;
  source: string;
  severity: 'error' | 'fatal';
  breadcrumbs: Breadcrumb[];
  sessionId?: string;
  appId?: string;
  windowId?: string;
  url?: string;
  userAgent?: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Reporting backend (stub — replace with real endpoint)
// ---------------------------------------------------------------------------

export type ReportSink = (report: ErrorReport) => void;

let reportSink: ReportSink = () => {
  // Default: no-op in prod, logged via systemLogStore in dev
};

/**
 * Set a custom error report sink (e.g., Sentry, custom API).
 */
export function setReportSink(sink: ReportSink): void {
  reportSink = sink;
}

// Sampling for perf violations (don't flood)
let perfSampleRate = 0.1; // 10% by default

export function setPerfSampleRate(rate: number): void {
  perfSampleRate = Math.max(0, Math.min(1, rate));
}

// ---------------------------------------------------------------------------
// Core report function
// ---------------------------------------------------------------------------

function buildReport(
  message: string,
  opts: {
    stack?: string;
    source?: string;
    severity?: 'error' | 'fatal';
    appId?: string;
    windowId?: string;
  } = {},
): ErrorReport {
  return {
    message,
    stack: opts.stack,
    source: opts.source ?? 'unknown',
    severity: opts.severity ?? 'error',
    breadcrumbs: [...breadcrumbs],
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    timestamp: new Date().toISOString(),
    appId: opts.appId,
    windowId: opts.windowId,
  };
}

/**
 * Report an error explicitly from app code.
 */
export function reportError(
  error: Error | string,
  opts: { source?: string; severity?: 'error' | 'fatal'; appId?: string; windowId?: string } = {},
): void {
  const message = typeof error === 'string' ? error : error.message;
  const stack = typeof error === 'string' ? undefined : error.stack;

  const report = buildReport(message, { ...opts, stack });

  // Always log to system log
  logSystemEvent({
    level: 'error',
    severity: opts.severity ?? 'error',
    source: opts.source ?? 'app',
    message,
    data: { stack, breadcrumbCount: breadcrumbs.length },
    appId: opts.appId,
    windowId: opts.windowId,
  });

  addBreadcrumb({ type: 'error', message });
  reportSink(report);
}

/**
 * Report a performance budget violation (sampled).
 */
export function reportPerfViolation(
  label: string,
  durationMs: number,
  budgetMs: number,
  opts: { appId?: string; windowId?: string } = {},
): void {
  // Sample to avoid flooding
  if (Math.random() > perfSampleRate) return;

  const message = `Perf violation: ${label} took ${durationMs.toFixed(1)}ms (budget: ${budgetMs}ms)`;

  logSystemEvent({
    level: 'warning',
    severity: 'warn',
    source: 'perf',
    message,
    perf: { durationMs, label },
    appId: opts.appId,
    windowId: opts.windowId,
  });

  addBreadcrumb({ type: 'perf', message, data: { durationMs, budgetMs } });

  const report = buildReport(message, { source: 'perf', severity: 'error', ...opts });
  reportSink(report);
}

// ---------------------------------------------------------------------------
// Global error handlers — call installErrorHandlers() once at shell init
// ---------------------------------------------------------------------------

let installed = false;

export function installErrorHandlers(): () => void {
  if (installed || typeof window === 'undefined') return () => {};
  installed = true;

  const handleError = (event: ErrorEvent) => {
    const message = event.message || 'Unhandled error';
    const stack = event.error?.stack;

    logSystemEvent({
      level: 'error',
      severity: 'fatal',
      source: 'global',
      message,
      data: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack,
      },
    });

    addBreadcrumb({ type: 'error', message });
    reportSink(buildReport(message, { stack, source: 'global', severity: 'fatal' }));
  };

  const handleRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : 'Unhandled promise rejection';
    const stack = reason instanceof Error ? reason.stack : undefined;

    logSystemEvent({
      level: 'error',
      severity: 'error',
      source: 'promise',
      message,
      data: { stack },
    });

    addBreadcrumb({ type: 'error', message });
    reportSink(buildReport(message, { stack, source: 'promise', severity: 'error' }));
  };

  window.addEventListener('error', handleError);
  window.addEventListener('unhandledrejection', handleRejection);

  return () => {
    window.removeEventListener('error', handleError);
    window.removeEventListener('unhandledrejection', handleRejection);
    installed = false;
  };
}
