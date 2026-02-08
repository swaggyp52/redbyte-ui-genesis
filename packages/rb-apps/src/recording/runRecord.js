// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
export const encodeRunRecord = (record) => JSON.stringify(record, null, 2);
export const decodeRunRecord = (raw) => {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid run record: not an object');
    }
    if (parsed.version !== 1 && parsed.version !== 2) {
        throw new Error(`Unsupported run record version: ${parsed.version}`);
    }
    if (!parsed.circuitSnapshot || !parsed.engineConfig) {
        throw new Error('Invalid run record: missing circuit snapshot or engine config');
    }
    if (typeof parsed.createdAt !== 'string') {
        parsed.createdAt = new Date(typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now()).toISOString();
    }
    if (!parsed.circuitSummary) {
        parsed.circuitSummary = undefined;
    }
    if (!parsed.circuitDigest) {
        parsed.circuitDigest = undefined;
    }
    if (!parsed.stimulusDigest) {
        parsed.stimulusDigest = undefined;
    }
    if (!parsed.traceDigest) {
        parsed.traceDigest = undefined;
    }
    if (!parsed.summary || typeof parsed.summary !== 'object') {
        parsed.summary = { tickCount: 0, startTick: 0, durationTicks: 0, missingNodes: [] };
    }
    if (typeof parsed.summary.startTick !== 'number') {
        parsed.summary.startTick = 0;
    }
    if (typeof parsed.summary.tickCount !== 'number') {
        parsed.summary.tickCount = 0;
    }
    if (typeof parsed.summary.durationTicks !== 'number') {
        parsed.summary.durationTicks = parsed.summary.tickCount ?? 0;
    }
    if (!Array.isArray(parsed.summary.missingNodes)) {
        parsed.summary.missingNodes = [];
    }
    return parsed;
};
export const indexStimulusByTick = (events) => {
    const byTick = new Map();
    events.forEach((event) => {
        const list = byTick.get(event.tick) ?? [];
        list.push(event);
        byTick.set(event.tick, list);
    });
    return byTick;
};
