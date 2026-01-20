// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

export interface AppInvariantSpec {
  reads: string[];
  writes: string[];
  outputs: string[];
}

const invariants = new Map<string, AppInvariantSpec>();

const normalizeList = (items: string[]) => {
  return Array.from(new Set(items)).sort();
};

export const registerAppInvariants = (appId: string, spec: AppInvariantSpec): void => {
  const normalized: AppInvariantSpec = {
    reads: normalizeList(spec.reads),
    writes: normalizeList(spec.writes),
    outputs: normalizeList(spec.outputs),
  };

  const existing = invariants.get(appId);
  if (existing) return;

  invariants.set(appId, normalized);
};

export const getAppInvariants = (appId: string): AppInvariantSpec | null => {
  return invariants.get(appId) ?? null;
};

export const assertAppOutput = (appId: string, output: string): void => {
  const spec = invariants.get(appId);
  if (!spec) {
    throw new Error(`App invariants not registered for: ${appId}`);
  }
  if (!spec.outputs.includes(output)) {
    throw new Error(`Output "${output}" is not allowed for app "${appId}"`);
  }
};

export const assertAppWrite = (appId: string, target: string): void => {
  const spec = invariants.get(appId);
  if (!spec) {
    throw new Error(`App invariants not registered for: ${appId}`);
  }
  if (!spec.writes.includes(target)) {
    throw new Error(`Write "${target}" is not allowed for app "${appId}"`);
  }
};
