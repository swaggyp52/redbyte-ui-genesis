/**
 * FATAL CAPTURE (DEV-only)
 * 
 * Persists fatal errors to localStorage so they survive page closure.
 * When Playwright closes the page before it can capture console/pageerror events,
 * tests can reopen the page and read the persisted fatal from localStorage.
 * 
 * Usage:
 *   installFatalCapture(); // Call once on app startup
 * 
 * On fatal error, writes to localStorage["__RB_LAST_FATAL__"] with:
 *   - timestamp
 *   - kind (window.error, unhandledrejection, etc)
 *   - message / reason
 *   - stack
 *   - mountTrace snapshot
 */

interface FatalRecord {
  timestamp: number;
  kind: string;
  message: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  reason?: any;
  mountTrace?: string[];
}

declare global {
  interface Window {
    __RB_MOUNT_TRACE__?: string[];
    __RB_FATAL_CAPTURE_INSTALLED__?: boolean;
  }
}

/**
 * Push a mount breadcrumb (DEV-only).
 * Records timestamp + label to track component mount progress.
 */
export function pushMount(label: string) {
  if (typeof window === 'undefined') return;
  // Allow pushMount when fatal capture is installed (covers force mode)
  if (!window.__RB_FATAL_CAPTURE_INSTALLED__ && !('__DEV__' in globalThis) && !('__TEST__' in globalThis) && !navigator.webdriver) {
    return;
  }

  if (!window.__RB_MOUNT_TRACE__) {
    window.__RB_MOUNT_TRACE__ = [];
  }

  const timestamp = typeof performance !== 'undefined' ? performance.now().toFixed(1) : Date.now();
  window.__RB_MOUNT_TRACE__.push(`${timestamp} ${label}`);
}

/**
 * Persist fatal error to localStorage synchronously.
 * Survives page close for post-mortem analysis.
 */
function persistFatal(kind: string, payload: Partial<FatalRecord>) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;

  const record: FatalRecord = {
    timestamp: Date.now(),
    kind,
    message: payload.message || String(payload.reason || 'unknown'),
    filename: payload.filename,
    lineno: payload.lineno,
    colno: payload.colno,
    stack: payload.stack,
    reason: payload.reason,
    mountTrace: window.__RB_MOUNT_TRACE__ || [],
  };

  try {
    localStorage.setItem('__RB_LAST_FATAL__', JSON.stringify(record));
    // Log as JSON for watcher to pick up before page dies
    console.error('RB_FATAL_PERSISTED', JSON.stringify(record));
  } catch (e) {
    // localStorage may be full or unavailable, log anyway
    console.error('RB_FATAL_PERSISTED_STORAGE_FAILED', kind, record.message);
  }
}

/**
 * Install global error handlers that persist fatal errors (DEV-only).
 * Call once on app startup.
 */
export function installFatalCapture(opts?: { force?: boolean }) {
  if (typeof window === 'undefined') return;
  if (window.__RB_FATAL_CAPTURE_INSTALLED__) return;

  // Only install in DEV or test environments — unless force is set (preview/demo builds)
  if (!opts?.force && !('__DEV__' in globalThis) && !('__TEST__' in globalThis) && !navigator.webdriver) {
    return;
  }

  window.__RB_FATAL_CAPTURE_INSTALLED__ = true;

  // Capture window.error (syntax errors, runtime exceptions)
  window.addEventListener('error', (event) => {
    persistFatal('window.error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    });
  });

  // Capture unhandled promise rejections (async failures)
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    persistFatal('unhandledrejection', {
      message: reason?.message || String(reason),
      stack: reason?.stack,
      reason: typeof reason === 'object' ? JSON.stringify(reason) : String(reason),
    });
  });

  // Initialize mount trace
  window.__RB_MOUNT_TRACE__ = [];
}

/**
 * Clear persisted fatal and mount trace (for test isolation).
 */
export function clearPersistedFatal() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  
  try {
    localStorage.removeItem('__RB_LAST_FATAL__');
    localStorage.removeItem('__RB_LAST_READY__');
  } catch (e) {
    // Ignore
  }

  if (window.__RB_MOUNT_TRACE__) {
    window.__RB_MOUNT_TRACE__ = [];
  }
}

/**
 * Read persisted fatal from localStorage (for post-mortem).
 */
export function readPersistedFatal(): FatalRecord | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  
  try {
    const raw = localStorage.getItem('__RB_LAST_FATAL__');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}
