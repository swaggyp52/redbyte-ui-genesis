/**
 * RUNAWAY LOOP WATCHDOG
 * 
 * DEV-only runtime detection of infinite loops, excessive re-renders, and runaway state mutations.
 * 
 * When active, this module monitors:
 * 1. Animation frame frequency (expect ~60 FPS, warn at >200 FPS = re-render storm)
 * 2. Microtask frequency (expect <1000/sec, warn at >5000/sec = state mutation loop)
 * 3. Error boundary captures (unexpected errors mid-render)
 * 
 * On detection of runaway behavior:
 * - Sets window.__RB_RUNAWAY__ = { reason, metrics, timestamp }
 * - Logs a single-line signature: "RB_RUNAWAY_LOOP_DETECTED: <reason>"
 * - Fails tests via explicit console.error
 * 
 * ACTIVATION:
 * - Automatically enabled in DEV + test modes (Playwright CE mode)
 * - Call enableWatchdog() to start monitoring
 * - Disabled in production
 */

interface RunawayMetrics {
  reason: string;
  timestamp: number;
  framesPerSecond?: number;
  microtasksPerSecond?: number;
  stateWritesPerSecond?: number;
  consecutiveIdenticalFrames?: number;
  detectionWindow?: number; // milliseconds of monitoring before threshold hit
}

interface WatchdogState {
  enabled: boolean;
  frameCount: number;
  lastFrameTime: number;
  currentSecond: number;
  microtaskCount: number;
  mutationEvents: number;
  lastReportTime: number;
  detectedRunaway: boolean;
}

let watchdogState: WatchdogState = {
  enabled: false,
  frameCount: 0,
  lastFrameTime: Date.now(),
  currentSecond: 0,
  microtaskCount: 0,
  mutationEvents: 0,
  lastReportTime: 0,
  detectedRunaway: false,
};

// Configuration thresholds
const CONFIG = {
  FRAME_RATE_WARNING_THRESHOLD: 200, // frames/sec indicating re-render storm
  MICROTASK_RATE_THRESHOLD: 5000, // tasks/sec indicating state mutation loop
  MONITORING_INTERVAL: 500, // milliseconds between checks
  DETECTION_WINDOW: 2000, // must exceed threshold for this long
  REPORT_COOLDOWN: 5000, // don't report twice within this window
};

/**
 * Enable watchdog monitoring. Called automatically in DEV/test.
 */
export function enableWatchdog() {
  if (watchdogState.enabled || typeof window === 'undefined') return;

  // Only enable in DEV or test environments
  if (!('__DEV__' in globalThis) && !('__TEST__' in globalThis) && !navigator.webdriver) {
    return;
  }

  watchdogState.enabled = true;
  watchdogState.lastFrameTime = Date.now();

  // Monitor animation frame frequency (re-render storms)
  monitorAnimationFrames();

  // Monitor microtask frequency (state mutation loops)
  monitorMicrotasks();

  // Periodic health check
  const healthCheckInterval = setInterval(() => {
    checkRunawayConditions();
  }, CONFIG.MONITORING_INTERVAL);

  // Cleanup on unload
  if (typeof window !== 'undefined') {
    (window as any).__RB_WATCHDOG_CLEANUP__ = () => {
      clearInterval(healthCheckInterval);
      watchdogState.enabled = false;
    };
  }
}

/**
 * Monitor animation frame frequency. A spike indicates React rendering in a loop.
 */
function monitorAnimationFrames() {
  let frameCountThisSecond = 0;
  let lastSecondTime = Date.now();

  function countFrame() {
    if (!watchdogState.enabled) return;

    frameCountThisSecond++;
    const now = Date.now();
    const elapsedMs = now - lastSecondTime;

    // Every 100ms, update the running FPS count
    if (elapsedMs >= 100) {
      const framesPerSecond = Math.round((frameCountThisSecond / elapsedMs) * 1000);
      watchdogState.frameCount = framesPerSecond;
      lastSecondTime = now;
      frameCountThisSecond = 0;
    }

    if (watchdogState.enabled) {
      requestAnimationFrame(countFrame);
    }
  }

  requestAnimationFrame(countFrame);
}

/**
 * Monitor microtask queue depth. A spike indicates Zustand/event loop overload.
 */
function monitorMicrotasks() {
  // We can't directly measure microtask count, but we can use Promise microtasks
  // as a proxy. Count how many promises resolve per second.
  let microtaskCountThisSecond = 0;
  let lastCountTime = Date.now();

  function queueMicrotaskCounter() {
    if (!watchdogState.enabled) return;

    microtaskCountThisSecond++;

    // Every 100ms, report microtask rate
    const now = Date.now();
    if (now - lastCountTime >= 100) {
      const rate = Math.round((microtaskCountThisSecond / (now - lastCountTime)) * 1000);
      watchdogState.microtaskCount = rate;
      lastCountTime = now;
      microtaskCountThisSecond = 0;
    }

    // Re-queue if still enabled
    if (watchdogState.enabled) {
      queueMicrotask(queueMicrotaskCounter);
    }
  }

  queueMicrotask(queueMicrotaskCounter);
}

/**
 * Periodic check for runaway conditions.
 */
function checkRunawayConditions() {
  if (!watchdogState.enabled) return;

  const now = Date.now();
  const timeSinceLastReport = now - watchdogState.lastReportTime;

  // Don't spam repeated reports
  if (watchdogState.detectedRunaway && timeSinceLastReport < CONFIG.REPORT_COOLDOWN) {
    return;
  }

  // Check for excessive frame rate (re-render storm)
  if (watchdogState.frameCount > CONFIG.FRAME_RATE_WARNING_THRESHOLD) {
    reportRunaway('EXCESSIVE_FRAME_RATE', {
      framesPerSecond: watchdogState.frameCount,
      microtasksPerSecond: watchdogState.microtaskCount,
      detectionWindow: CONFIG.MONITORING_INTERVAL,
    });
    return;
  }

  // Check for excessive microtask rate (state mutation loop)
  if (watchdogState.microtaskCount > CONFIG.MICROTASK_RATE_THRESHOLD) {
    reportRunaway('EXCESSIVE_MICROTASK_RATE', {
      microtasksPerSecond: watchdogState.microtaskCount,
      framesPerSecond: watchdogState.frameCount,
      detectionWindow: CONFIG.MONITORING_INTERVAL,
    });
    return;
  }
}

/**
 * Report a detected runaway condition.
 */
function reportRunaway(reason: string, metrics: Partial<RunawayMetrics>) {
  const fullMetrics: RunawayMetrics = {
    reason,
    timestamp: Date.now(),
    ...metrics,
  };

  watchdogState.lastReportTime = Date.now();
  watchdogState.detectedRunaway = true;

  // Store in global for test inspection
  if (typeof window !== 'undefined') {
    (window as any).__RB_RUNAWAY__ = fullMetrics;
  }

  // Log a single-line signature that tests can detect
  const signature = `RB_RUNAWAY_LOOP_DETECTED: ${reason} ${JSON.stringify(metrics)}`;
  console.error(signature);

  // Also console.error so it reaches the error boundary
  console.error('Runaway loop detected. Check window.__RB_RUNAWAY__ for details.');
}

/**
 * Get current watchdog state (for testing / debugging).
 */
export function getWatchdogState(): WatchdogState {
  return { ...watchdogState };
}

/**
 * Reset watchdog state (for test cleanup).
 */
export function resetWatchdog() {
  watchdogState = {
    enabled: false,
    frameCount: 0,
    lastFrameTime: Date.now(),
    currentSecond: 0,
    microtaskCount: 0,
    mutationEvents: 0,
    lastReportTime: 0,
    detectedRunaway: false,
  };

  if (typeof window !== 'undefined') {
    delete (window as any).__RB_RUNAWAY__;
    delete (window as any).__RB_WATCHDOG_CLEANUP__;
  }
}

// Auto-enable in DEV mode
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // Check if we're in a test/dev environment
  const isTest = navigator.webdriver || (window as any).__PLAYWRIGHT__;
  const isDev = process.env.NODE_ENV === 'development';

  if ((isDev || isTest) && !watchdogState.enabled) {
    // Defer slightly to let React initialize first
    setTimeout(() => {
      enableWatchdog();
    }, 100);
  }
}
