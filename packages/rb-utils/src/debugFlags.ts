// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Centralized debug flags and dev-only helpers.
 * This is the single source of truth for all dev-only localStorage keys, window globals, and env vars.
 *
 * Reference: docs/DEV_DEBUG_FLAGS.md
 */

/**
 * Known debug localStorage keys (all dev-only).
 * Used by the ui:dev-guards-contract-gate to validate compliance.
 */
export const DEBUG_FLAGS = [
  'rb:windowDebug',        // windowing system debug API
  'rb:renderStormReport',  // render storm detection UI
] as const;

/**
 * Known user-preference and state localStorage keys (all safe in prod).
 */
export const PERSISTENT_STORAGE_KEYS = [
  'rb:shell:pinnedApps',      // pinned apps in taskbar
  'rb:shell:booted',          // shell boot status
  'rb:shell:booted:v1',       // shell boot status (v1)
  'rb:onboarding:dismissed',  // onboarding dismissed
  'rb:classroom:v1',          // classroom mode state
  'rb:file-associations',     // file type associations
  'rb:filesystem',            // filesystem state cache
  'rb:window-layout',         // window layout persistence
] as const;

/**
 * Known window.__RB_* debug APIs (all dev-only).
 * These must be guarded by NODE_ENV !== 'production' or isDevBuild().
 */
export const WINDOW_DEBUG_APIS = [
  '__RB_WINDOWING__',           // windowing store debug (guarded by windowDebug localStorage)
  '__RB_DEBUG__',               // zustand instrumentation
  '__RB_RUNAWAY__',             // runaway watchdog metrics
  '__RB_WATCHDOG_CLEANUP__',    // watchdog cleanup function
  '__RB_MOUNT_TRACE__',         // React mount trace array
  '__RB_FATAL_CAPTURE_INSTALLED__', // error boundary flag
  '__RB_ERROR_BOUNDARY_HIT__',  // error boundary log
  '__RB_CIRCUIT_STORE__',       // circuit store debug ref
  '__RB_CLASSROOM_MODE_STORE__', // classroom mode store debug ref
  '__RB_AUDIT__',               // audit flag
  // Note: __RB_FLAGS__ is env-injected; may be prod-safe
] as const;

/**
 * Known window.__RB_* APIs safe in prod (boot signals, runtime metrics).
 */
export const WINDOW_RUNTIME_APIS = [
  '__RB_BOOT_OK__',  // shell boot completion
  '__RB_BOOT_TS__',  // shell boot timestamp
] as const;

/**
 * Known dev-only environment variables (all unsafe for prod).
 */
export const DEV_ENV_FLAGS = [
  'RB_BRIDGE_DRYRUN',          // hardware bridge dry-run
  'RB_DEMO_MODE',              // demo mode
  'UPDATE_RBPROJ_GOLDEN',      // test golden update
  'UPDATE_RBX_EVIDENCE_GOLDEN', // test golden update
  'RB_FPGA_MOCK',              // FPGA mock mode
  'RB_FPGA_SIM',               // FPGA sim mode
  'RB_FPGA_DRYRUN',            // FPGA dry-run
  'RB_FPGA_TRACE',             // FPGA trace logging
  // Note: RB_FPGA_* infra vars are complex; see DEV_DEBUG_FLAGS.md
] as const;

/**
 * Check if a debug flag is enabled via localStorage.
 * Safe to call in any environment; returns false if not set.
 * @param key - localStorage key (e.g., 'rb:windowDebug')
 */
export function isDebugFlagEnabled(key: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(key) === '1';
}

/**
 * Check if code is running in a development build.
 * Returns true for development and test; false otherwise.
 */
export function isDevBuild(): boolean {
  try {
    return typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}

/**
 * Check if a dev-only environment variable is set.
 * Useful for server-side checks; always returns false in browser.
 * @param name - environment variable name (e.g., 'RB_BRIDGE_DRYRUN')
 * @param value - expected value (optional; defaults to '1' or 'true')
 */
export function isDevEnvSet(name: string, value?: string | boolean): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const actual = process.env?.[name];
    if (value === undefined) {
      // Check for common truthy values
      return actual === '1' || actual === 'true';
    }
    return actual === String(value);
  } catch {
    return false;
  }
}
