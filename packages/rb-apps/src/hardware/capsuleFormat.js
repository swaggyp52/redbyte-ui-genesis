// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { validateTrace } from './traceFormat';
export function createCapsule(data) {
    return {
        schemaVersion: '1.0.0',
        appId: 'redbyte-ece-lab',
        timestamp: new Date().toISOString(),
        labId: data.labId,
        executionSource: data.executionSource,
        mode: data.mode,
        deviceBoardId: data.deviceBoardId,
        trace: data.trace,
        result: data.result,
    };
}
export function validateCapsule(json) {
    if (!json || typeof json !== 'object') {
        return { ok: false, error: 'Invalid JSON object' };
    }
    // Check header
    if (json.schemaVersion !== '1.0.0') {
        return { ok: false, error: `Unsupported schema version: ${json.schemaVersion}` };
    }
    if (json.appId !== 'redbyte-ece-lab') {
        return { ok: false, error: `Invalid appId: ${json.appId}` };
    }
    // Validate embedded trace if present
    if (json.trace) {
        const traceVal = validateTrace(json.trace);
        if (!traceVal.ok) {
            return { ok: false, error: `Invalid embedded trace: ${traceVal.errors[0]}` };
        }
    }
    return { ok: true, capsule: json };
}
