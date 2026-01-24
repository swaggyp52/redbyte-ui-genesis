// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { HardwareTraceV1 } from './traceFormat';
import { validateTrace } from './traceFormat';

export type ExecutionSource = 'sim' | 'hardware' | 'replay';

export interface RedByteCapsuleResult {
    status: 'pass' | 'fail' | 'partial' | 'unknown';
    score?: number;
    completedSteps?: string[];
}

export interface RedByteCapsule {
    schemaVersion: '1.0.0';
    appId: 'redbyte-ece-lab';
    labId: string;

    // Context
    timestamp: string;
    executionSource: ExecutionSource;
    mode: string; // e.g. 'sim-only', 'guided-lab'

    // Hardware Context
    deviceBoardId?: string;
    deviceKey?: string; // Serial or unique ID if available

    // Outcomes
    result?: RedByteCapsuleResult;

    // Evidence
    trace?: HardwareTraceV1;

    // Optional extensions
    inputsSummary?: Record<string, any>;
    outputsSummary?: Record<string, any>;
}

export function createCapsule(
    data: {
        labId: string;
        executionSource: ExecutionSource;
        mode: string;
        deviceBoardId: string;
        trace?: HardwareTraceV1;
        result?: RedByteCapsuleResult;
    }
): RedByteCapsule {
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

export function validateCapsule(json: any): { ok: boolean; capsule?: RedByteCapsule; error?: string } {
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

    return { ok: true, capsule: json as RedByteCapsule };
}
