/**
 * Enhanced Playwright test helpers with explicit error detection
 * 
 * These helpers upgrade from implicit timeout-based failure detection to explicit
 * signature-based failure detection using the RB Runaway Loop Watchdog.
 */

import { expect } from '@playwright/test';

/**
 * Error signatures that indicate a real failure, not just a timeout.
 * Tests should fail FAST when these appear.
 */
export const ERROR_SIGNATURES = {
  RUNAWAY_LOOP: 'RB_RUNAWAY_LOOP_DETECTED',
  REACT_185: 'Maximum update depth exceeded',
  REACT_ERROR_BOUNDARY: 'useSyncExternalStore',
  REACT_GET_SNAPSHOT: 'getSnapshot',
  STACK_OVERFLOW: 'Maximum call stack size exceeded',
  POINTER_EVENT_BLOCKED: 'RB_POINTER_BLOCKED',
  INFINITE_RECURSION: 'stack size exceeded',
};

/**
 * Hardened failure watcher: triggers immediately on any explicit failure signal.
 * Catches: page close/crash, pageerror, console errors including RB_FATAL/RB_RUNAWAY_LOOP_DETECTED/React errors
 * Returns: { failPromise, dispose, capturedLogs }
 * 
 * failPromise rejects with an Error immediately when failure is detected.
 * Use in Promise.race to make page death a first-class failure signal.
 */
export function createFailureWatcher(page: any) {
  let resolved = false;
  let rejectFn: (error: Error) => void = () => {};
  let resolveFn: (value: null) => void = () => {};
  const capturedLogs: string[] = [];

  const failPromise: Promise<{ kind: string; message: string } | null> = new Promise((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  const cleanup = () => {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('close', onClose);
    page.off('crash', onCrash);
  };

  const finish = (result: { kind: string; message: string } | null) => {
    if (resolved) return;
    resolved = true;
    cleanup();
    
    if (result) {
      const errorMsg = `[${result.kind.toUpperCase()}] ${result.message}`;
      rejectFn(new Error(errorMsg));
    } else {
      resolveFn(null);
    }
  };

  const onConsole = (msg: any) => {
    const text = msg.text();
    const type = msg.type();
    
    capturedLogs.push(`[${type}] ${text}`);

    // Check for any explicit error signatures that indicate failure
    if (text.includes('RB_FATAL:')) {
      finish({ kind: 'rb-fatal', message: text });
      return;
    }

    if (text.includes('RB_RUNAWAY_LOOP_DETECTED')) {
      finish({ kind: 'rb-runaway', message: text });
      return;
    }

    for (const sig of Object.values(ERROR_SIGNATURES)) {
      if (text.includes(sig)) {
        finish({ kind: 'signature', message: text });
        return;
      }
    }

    // Treat any console error as a failure signal
    if (type === 'error') {
      finish({ kind: 'console-error', message: text });
      return;
    }
  };

  const onPageError = (e: any) => {
    const text = String(e);
    capturedLogs.push(`[pageerror] ${text}`);
    finish({ kind: 'pageerror', message: text });
  };

  const onClose = () => {
    capturedLogs.push('[page-closed]');
    finish({ kind: 'page-closed', message: 'Page closed/crashed unexpectedly' });
  };

  const onCrash = () => {
    capturedLogs.push('[page-crashed]');
    finish({ kind: 'page-crashed', message: 'Page process crashed' });
  };

  // Attach all listeners BEFORE test starts
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('close', onClose);
  page.on('crash', onCrash);

  const dispose = () => {
    cleanup();
    if (!resolved) {
      resolved = true;
      resolveFn(null);
    }
  };

  return { 
    failPromise,
    dispose,
    capturedLogs,
    // Helper to wait with a timeout (race the failure promise against a timeout)
    wait: async (timeoutMs = 6000) => {
      return Promise.race([
        failPromise.then(() => null),
        new Promise<null>((res) => setTimeout(() => res(null), timeoutMs)),
      ]);
    },
  };
}

/**
 * Listen for explicit error signatures and fail fast.
 * 
 * Usage:
 *   const { catchExplicitErrors, errorSigs } = setupExplicitErrorListener(page);
 *   // ... run test ...
 *   await catchExplicitErrors();  // throws if any signature detected
 *   expect(errorSigs).toEqual([]);  // verify none occurred
 */
export function setupExplicitErrorListener(page: any) {
  const signatures: string[] = [];
  const rawErrors: string[] = [];

  page.on('console', (msg: any) => {
    const text = msg.text();
    const type = msg.type();

    // Check for any explicit error signature
    for (const [key, sig] of Object.entries(ERROR_SIGNATURES)) {
      if (text.includes(sig)) {
        signatures.push(`${key}: ${text}`);
      }
    }

    // Also capture raw errors
    if (type === 'error') {
      rawErrors.push(text);
    }
  });

  page.on('pageerror', (e: any) => {
    const msg = String(e);

    // Check for error signatures
    for (const [key, sig] of Object.entries(ERROR_SIGNATURES)) {
      if (msg.includes(sig)) {
        signatures.push(`${key}: ${msg}`);
      }
    }

    rawErrors.push(msg);
  });

  return {
    signatures,
    rawErrors,

    /**
     * Check if any explicit error signatures were detected.
     * Throws immediately with a clear message if found.
     */
    async assertNoExplicitErrors() {
      if (signatures.length > 0) {
        const msg = `Explicit errors detected:\n${signatures.join('\n')}`;
        throw new Error(msg);
      }
    },

    /**
     * Get the runaway state from the page's global.
     */
    async getRunawayState() {
      try {
        return await page.evaluate(() => (window as any).__RB_RUNAWAY__);
      } catch {
        return null;
      }
    },

    /**
     * Fail test immediately if runaway was detected.
     */
    async failIfRunaway() {
      const runaway = await this.getRunawayState();
      if (runaway) {
        expect(runaway).toBeNull();
      }
    },
  };
}

/**
 * Capture a DOM snapshot at a specific point in time.
 * Useful for debugging what the page looked like when it failed.
 */
export async function captureUISnapshot(page: any, label: string) {
  return await page.evaluate((lbl: string) => {
    const root = document.querySelector('[data-testid="logic-playground-root"]');
    if (!root) return null;

    return {
      label: lbl,
      timestamp: Date.now(),
      html: root.outerHTML.substring(0, 5000), // First 5KB of DOM
      classList: Array.from(root.classList),
      dataAttributes: {
        ready: root.getAttribute('data-ready'),
      },
    };
  }, label);
}

/**
 * Wait for a specific error signature to appear (for testing fault injection).
 * Times out if signature doesn't appear within timeoutMs.
 */
export async function waitForErrorSignature(
  page: any,
  signature: string,
  timeoutMs: number = 5000
) {
  const startTime = Date.now();
  const checkInterval = 100; // ms

  while (Date.now() - startTime < timeoutMs) {
    const detected = await page.evaluate((sig: string) => {
      const errSig = `${sig}`;

      // Check for watchdog signature
      if (sig === ERROR_SIGNATURES.RUNAWAY_LOOP) {
        const runaway = (window as any).__RB_RUNAWAY__;
        if (runaway) return true;
      }

      // Check console messages
      let foundInConsole = false;
      const logs = (window as any).__RB_TEST_LOGS__ || [];
      for (const log of logs) {
        if (log.includes(sig)) {
          foundInConsole = true;
          break;
        }
      }

      return foundInConsole;
    }, signature);

    if (detected) {
      return true;
    }

    await page.waitForTimeout(checkInterval);
  }

  throw new Error(
    `Timeout waiting for error signature "${signature}" (waited ${timeoutMs}ms)`
  );
}

/**
 * Set up console.log capture for test inspection.
 * Stores logs in window.__RB_TEST_LOGS__ for evaluation.
 */
export async function enableConsoleCapture(page: any) {
  await page.evaluate(() => {
    (window as any).__RB_TEST_LOGS__ = [];
    const originalLog = console.log;
    const originalError = console.error;

    console.log = function (...args: any[]) {
      (window as any).__RB_TEST_LOGS__.push(`[LOG] ${args.join(' ')}`);
      originalLog.apply(console, args);
    };

    console.error = function (...args: any[]) {
      (window as any).__RB_TEST_LOGS__.push(`[ERROR] ${args.join(' ')}`);
      originalError.apply(console, args);
    };
  });
}

/**
 * Get all captured console logs.
 */
export async function getCapturedLogs(page: any): Promise<string[]> {
  return await page.evaluate(() => (window as any).__RB_TEST_LOGS__ || []);
}

/**
 * Inject a fault parameter and wait for it to take effect.
 * 
 * Usage:
 *   await injectFault(page, 'selector-object');
 *   // Now app is running with fault code enabled
 */
export async function injectFault(page: any, faultType: string, waitMs: number = 2000) {
  const currentUrl = page.url();
  const separator = currentUrl.includes('?') ? '&' : '?';
  const newUrl = `${currentUrl}${separator}fault=${faultType}`;

  await page.goto(newUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(waitMs);
}

/**
 * Remove fault injection by reloading clean URL.
 */
export async function removeFault(page: any, waitMs: number = 2000) {
  const currentUrl = page.url();
  const cleanUrl = currentUrl.split('&fault=')[0].split('?fault=')[0];

  await page.goto(cleanUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(waitMs);
}

/**
 * A/B test helper: run test with and without fault injection.
 * 
 * Usage:
 *   const results = await runABTest(page, 'selector-object', async (page, isFault) => {
 *     await doSomething(page);
 *     return await checkSomething(page);
 *   });
 *   expect(results.withFault).toBeFalsy();   // fault should cause failure
 *   expect(results.withoutFault).toBeTruthy(); // clean should pass
 */
export async function runABTest(
  page: any,
  faultType: string,
  testFn: (page: any, isFault: boolean) => Promise<boolean>
) {
  const baseUrl = page.url();

  // Test A: WITH fault
  let withFaultResult = null;
  let withFaultError = null;
  try {
    await injectFault(page, faultType);
    withFaultResult = await testFn(page, true);
  } catch (e) {
    withFaultError = String(e);
  }

  // Reset page
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Test B: WITHOUT fault
  let withoutFaultResult = null;
  let withoutFaultError = null;
  try {
    await removeFault(page);
    withoutFaultResult = await testFn(page, false);
  } catch (e) {
    withoutFaultError = String(e);
  }

  return {
    withFault: { result: withFaultResult, error: withFaultError },
    withoutFault: { result: withoutFaultResult, error: withoutFaultError },
  };
}

/**
 * Test that a specific view or component is not runaway looping.
 * Monitors frame rate and microtask queue for abnormal behavior.
 * 
 * Usage:
 *   await assertViewStable(page, 'quad', 5000);  // quad view must be stable for 5s
 */
export async function assertViewStable(page: any, viewName: string, durationMs: number) {
  const startTime = Date.now();

  while (Date.now() - startTime < durationMs) {
    const watchdogState = await page.evaluate(() => {
      const state = (window as any).__RB_WATCHDOG_STATE__;
      const runaway = (window as any).__RB_RUNAWAY__;
      return { state, runaway };
    });

    if (watchdogState.runaway) {
      throw new Error(
        `View "${viewName}" became unstable: ${JSON.stringify(watchdogState.runaway)}`
      );
    }

    await page.waitForTimeout(500);
  }
}

/**
 * Assert that a fault injection caused an expected error signature.
 * 
 * Usage:
 *   await assertFaultCaused(page, 'selector-object', ERROR_SIGNATURES.RUNAWAY_LOOP);
 */
export async function assertFaultCaused(
  page: any,
  faultType: string,
  expectedSignature: string,
  timeoutMs: number = 10000
) {
  await injectFault(page, faultType);

  try {
    await waitForErrorSignature(page, expectedSignature, timeoutMs);
  } catch (e) {
    await removeFault(page);
    throw new Error(
      `Fault "${faultType}" did not cause expected signature "${expectedSignature}": ${e.message}`
    );
  }

  await removeFault(page);
}
/**
 * Wait for readiness OR fail immediately if page becomes unusable.
 * Race the readiness signal against the failure watcher.
 * Returns immediately with explicit cause if page dies before ready.
 */
export async function waitForReadyOrFail(page: any, watcher: any, timeoutMs = 10000) {
  try {
    const readyPromise = new Promise<boolean>((resolve) => {
      const checkReady = async () => {
        try {
          const root = page.locator('[data-testid="logic-playground-root"]');
          const isReady = await root.getAttribute('data-ready').catch(() => null);
          if (isReady === 'true') {
            resolve(true);
            return;
          }
        } catch (e) {
          // Page closed, let failure watcher handle it
        }
        if (!resolved) setTimeout(checkReady, 100);
      };
      const timeoutHandle = setTimeout(() => resolve(false), timeoutMs);
      checkReady();
    });

    let resolved = false;
    const result = await Promise.race([
      readyPromise.then((v) => {
        resolved = true;
        return v;
      }),
      watcher.failPromise.then(() => {
        resolved = true;
        return false;
      }),
    ]);

    if (!result) {
      throw new Error('Ready signal not received');
    }
  } catch (e) {
    // Failure watcher triggered or timeout
    throw e;
  }
}