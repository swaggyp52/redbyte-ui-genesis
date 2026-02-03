// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
const invariants = new Map();
const normalizeList = (items) => {
    return Array.from(new Set(items)).sort();
};
export const registerAppInvariants = (appId, spec) => {
    const normalized = {
        reads: normalizeList(spec.reads),
        writes: normalizeList(spec.writes),
        outputs: normalizeList(spec.outputs),
    };
    const existing = invariants.get(appId);
    if (existing)
        return;
    invariants.set(appId, normalized);
};
export const getAppInvariants = (appId) => {
    return invariants.get(appId) ?? null;
};
export const assertAppOutput = (appId, output) => {
    const spec = invariants.get(appId);
    if (!spec) {
        throw new Error(`App invariants not registered for: ${appId}`);
    }
    if (!spec.outputs.includes(output)) {
        throw new Error(`Output "${output}" is not allowed for app "${appId}"`);
    }
};
export const assertAppWrite = (appId, target) => {
    const spec = invariants.get(appId);
    if (!spec) {
        throw new Error(`App invariants not registered for: ${appId}`);
    }
    if (!spec.writes.includes(target)) {
        throw new Error(`Write "${target}" is not allowed for app "${appId}"`);
    }
};
