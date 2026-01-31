// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Feature flag system for RedByte OS.
 *
 * Flags can be set via:
 * 1. `window.__RB_FLAGS__` (env-injected at deploy time)
 * 2. URL params: `?rb_flag_<name>=1`
 * 3. localStorage: `rb:flags:<name>`
 * 4. Programmatic: `setFlag(name, value)`
 *
 * Priority: programmatic > URL > localStorage > window.__RB_FLAGS__ > defaults
 */

export interface FeatureFlagDef {
  /** Human-readable description */
  description: string;
  /** Default value */
  defaultValue: boolean;
}

const FLAG_DEFS: Record<string, FeatureFlagDef> = {
  'evidence-export': {
    description: 'Enable evidence capsule export',
    defaultValue: true,
  },
  'cloud-sync': {
    description: 'Enable cloud sync UI',
    defaultValue: false,
  },
  'instructor-tools': {
    description: 'Enable instructor grading tools',
    defaultValue: true,
  },
  'web-workers': {
    description: 'Use Web Workers for heavy computation',
    defaultValue: true,
  },
  'experimental-3d': {
    description: 'Enable experimental 3D circuit view',
    defaultValue: false,
  },
  'perf-hud': {
    description: 'Show performance HUD',
    defaultValue: false,
  },
};

// Runtime overrides
const overrides = new Map<string, boolean>();

declare global {
  interface Window {
    __RB_FLAGS__?: Record<string, boolean>;
  }
}

function readUrlFlag(name: string): boolean | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const params = new URLSearchParams(window.location.search);
    const val = params.get(`rb_flag_${name}`);
    if (val === '1' || val === 'true') return true;
    if (val === '0' || val === 'false') return false;
  } catch { /* ignore */ }
  return undefined;
}

function readLocalFlag(name: string): boolean | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const val = localStorage.getItem(`rb:flags:${name}`);
    if (val === '1') return true;
    if (val === '0') return false;
  } catch { /* ignore */ }
  return undefined;
}

function readWindowFlag(name: string): boolean | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.__RB_FLAGS__?.[name];
}

/**
 * Check if a feature flag is enabled.
 */
export function isFeatureEnabled(name: string): boolean {
  // Programmatic override (highest priority)
  const override = overrides.get(name);
  if (override !== undefined) return override;

  // URL param
  const url = readUrlFlag(name);
  if (url !== undefined) return url;

  // localStorage
  const local = readLocalFlag(name);
  if (local !== undefined) return local;

  // window.__RB_FLAGS__
  const windowFlag = readWindowFlag(name);
  if (windowFlag !== undefined) return windowFlag;

  // Default
  return FLAG_DEFS[name]?.defaultValue ?? false;
}

/**
 * Set a flag override at runtime (kill switch).
 */
export function setFlag(name: string, value: boolean): void {
  overrides.set(name, value);
}

/**
 * Clear a runtime override (revert to other sources).
 */
export function clearFlag(name: string): void {
  overrides.delete(name);
}

/**
 * Persist a flag to localStorage.
 */
export function persistFlag(name: string, value: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(`rb:flags:${name}`, value ? '1' : '0');
  } catch { /* ignore */ }
}

/**
 * Get all known flags and their current values.
 */
export function getAllFlags(): Record<string, { value: boolean; description: string }> {
  const result: Record<string, { value: boolean; description: string }> = {};
  for (const [name, def] of Object.entries(FLAG_DEFS)) {
    result[name] = {
      value: isFeatureEnabled(name),
      description: def.description,
    };
  }
  return result;
}
