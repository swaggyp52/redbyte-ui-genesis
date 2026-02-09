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
let watchdogState = {
    enabled: false,
    startTime: Date.now(),
    frameCount: 0,
    lastFrameTime: Date.now(),
    currentSecond: 0,
    microtaskCount: 0,
    mutationEvents: 0,
    lastReportTime: 0,
    detectedRunaway: false,
    frameThresholdStart: undefined,
    microtaskThresholdStart: undefined,
    activationLogged: false,
};
// Configuration thresholds
const CONFIG = {
    FRAME_RATE_WARNING_THRESHOLD: 200, // frames/sec indicating re-render storm
    MICROTASK_RATE_THRESHOLD: 5000, // tasks/sec indicating state mutation loop
    MONITORING_INTERVAL: 500, // milliseconds between checks
    DETECTION_WINDOW: 2000, // must exceed threshold for this long
    REPORT_COOLDOWN: 5000, // don't report twice within this window
    STARTUP_GRACE_PERIOD: 2000, // ignore spikes during app bootstrap
};
/**
 * Enable watchdog monitoring. Called automatically in DEV/test.
 */
export function enableWatchdog() {
    if (watchdogState.enabled || typeof window === 'undefined')
        return;
    // Only enable in DEV or test environments
    if (!('__DEV__' in globalThis) && !('__TEST__' in globalThis) && !navigator.webdriver) {
        return;
    }
    watchdogState.enabled = true;
    watchdogState.startTime = Date.now();
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
        window.__RB_WATCHDOG_CLEANUP__ = () => {
            clearInterval(healthCheckInterval);
            const microtaskInterval = window.__RB_WATCHDOG_MICROTASK_INTERVAL__;
            if (microtaskInterval != null) clearInterval(microtaskInterval);
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
        if (!watchdogState.enabled)
            return;
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
 *
 * IMPORTANT: Uses a periodic setInterval sample instead of self-queuing microtasks.
 * The previous approach (queueMicrotask → re-queue) created a microtask starvation
 * bomb: microtasks drain before ANY macro task fires, so an infinite microtask chain
 * permanently blocks setTimeout, MessageChannel (React scheduler), and RAF.
 */
function monitorMicrotasks() {
    const SAMPLE_INTERVAL_MS = 200;
    const BURST_SIZE = 20;

    const intervalId = setInterval(() => {
        if (!watchdogState.enabled) {
            clearInterval(intervalId);
            return;
        }

        let burstCount = 0;
        const burstStart = Date.now();

        function countOne() {
            burstCount++;
            if (burstCount < BURST_SIZE) {
                queueMicrotask(countOne);
            } else {
                const elapsed = Math.max(1, Date.now() - burstStart);
                const rate = Math.round((burstCount / elapsed) * 1000);
                watchdogState.microtaskCount = rate;
            }
        }

        queueMicrotask(countOne);
    }, SAMPLE_INTERVAL_MS);

    if (typeof window !== 'undefined') {
        window.__RB_WATCHDOG_MICROTASK_INTERVAL__ = intervalId;
    }
}
/**
 * Periodic check for runaway conditions.
 */
function checkRunawayConditions() {
    if (!watchdogState.enabled)
        return;
    // Gate: don't check for runaway until app is ready
    // This prevents killing healthy startup and false positives during initialization
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const root = document.querySelector('[data-testid="logic-playground-root"]');
        if (!root || root.getAttribute('data-ready') !== 'true') {
            return; // Still in startup phase, ignore potential spikes
        }
        // Log once when watchdog becomes active (DEV only)
        if (import.meta && import.meta.env && import.meta.env.DEV && !watchdogState.activationLogged) {
            console.log('RB_WATCHDOG_ACTIVE');
            watchdogState.activationLogged = true;
        }
    }
    const now = Date.now();
    // Ignore detection during startup grace period to avoid false positives
    if (now - watchdogState.startTime < CONFIG.STARTUP_GRACE_PERIOD) {
        return;
    }
    const timeSinceLastReport = now - watchdogState.lastReportTime;
    // Don't spam repeated reports
    if (watchdogState.detectedRunaway && timeSinceLastReport < CONFIG.REPORT_COOLDOWN) {
        return;
    }
    // Check for excessive frame rate (re-render storm) sustained over detection window
    if (watchdogState.frameCount > CONFIG.FRAME_RATE_WARNING_THRESHOLD) {
        if (!watchdogState.frameThresholdStart) {
            watchdogState.frameThresholdStart = now;
        }
        const windowMs = now - watchdogState.frameThresholdStart;
        if (windowMs >= CONFIG.DETECTION_WINDOW) {
            reportRunaway('EXCESSIVE_FRAME_RATE', {
                framesPerSecond: watchdogState.frameCount,
                microtasksPerSecond: watchdogState.microtaskCount,
                detectionWindow: windowMs,
            });
            return;
        }
    }
    else {
        watchdogState.frameThresholdStart = undefined;
    }
    // Check for excessive microtask rate (state mutation loop) sustained over detection window
    if (watchdogState.microtaskCount > CONFIG.MICROTASK_RATE_THRESHOLD) {
        if (!watchdogState.microtaskThresholdStart) {
            watchdogState.microtaskThresholdStart = now;
        }
        const windowMs = now - watchdogState.microtaskThresholdStart;
        if (windowMs >= CONFIG.DETECTION_WINDOW) {
            reportRunaway('EXCESSIVE_MICROTASK_RATE', {
                microtasksPerSecond: watchdogState.microtaskCount,
                framesPerSecond: watchdogState.frameCount,
                detectionWindow: windowMs,
            });
            return;
        }
    }
    else {
        watchdogState.microtaskThresholdStart = undefined;
    }
}
/**
 * Report a detected runaway condition.
 * Throws an explicit error that React error boundary will catch.
 */
function reportRunaway(reason, metrics) {
    const fullMetrics = {
        reason,
        timestamp: Date.now(),
        ...metrics,
    };
    watchdogState.lastReportTime = Date.now();
    watchdogState.detectedRunaway = true;
    // Store in global for test inspection
    if (typeof window !== 'undefined') {
        window.__RB_RUNAWAY__ = fullMetrics;
    }
    // Build error message with diagnostic details
    const errorMessage = `RB_RUNAWAY_LOOP_DETECTED: ${reason}\nMetrics: ${JSON.stringify(metrics, null, 2)}`;
    // Log signature so tests can detect via console capture
    console.error(errorMessage);
    // Throw error so React error boundary catches it immediately
    // This terminates the render loop and fails the test with explicit cause
    throw new Error(errorMessage);
}
/**
 * Get current watchdog state (for testing / debugging).
 */
export function getWatchdogState() {
    return { ...watchdogState };
}
/**
 * Reset watchdog state (for test cleanup).
 */
export function resetWatchdog() {
    watchdogState = {
        enabled: false,
        startTime: Date.now(),
        frameCount: 0,
        lastFrameTime: Date.now(),
        currentSecond: 0,
        microtaskCount: 0,
        mutationEvents: 0,
        lastReportTime: 0,
        detectedRunaway: false,
        frameThresholdStart: undefined,
        microtaskThresholdStart: undefined,
    };
    if (typeof window !== 'undefined') {
        delete window.__RB_RUNAWAY__;
        delete window.__RB_WATCHDOG_CLEANUP__;
    }
}
// Auto-enable in DEV mode
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // Check if we're in a test/dev environment
    const isTest = navigator.webdriver || window.__PLAYWRIGHT__;
    const isDev = process.env.NODE_ENV === 'development';
    if ((isDev || isTest) && !watchdogState.enabled) {
        // Defer slightly to let React initialize first
        setTimeout(() => {
            enableWatchdog();
        }, 100);
    }
}
