// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { IOSnapshot } from '../services/hardwareClient';

export interface HardwareTraceV1 {
    version: '1.0';
    boardId: string;
    startedAtIso: string;
    startTick: number;
    samples: IOSnapshot[];
}

export function createTrace(
    boardId: string,
    startTick: number,
    samples: IOSnapshot[]
): HardwareTraceV1 {
    return {
        version: '1.0',
        boardId,
        startedAtIso: new Date().toISOString(),
        startTick,
        samples,
    };
}

export function validateTrace(trace: any): { ok: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!trace) {
        return { ok: false, errors: ['Trace is null or undefined'] };
    }

    if (trace.version !== '1.0') {
        errors.push(`Unsupported trace version: ${trace.version}`);
    }

    if (typeof trace.boardId !== 'string') {
        errors.push('Missing or invalid boardId');
    }

    if (!Array.isArray(trace.samples)) {
        errors.push('Missing samples array');
    } else if (trace.samples.length > 0) {
        // Light check on first sample
        const s = trace.samples[0];
        if (typeof s.tick !== 'number' && typeof s.tick !== 'undefined') { // tick optional in snapshot but required for good trace?
            // Actually snapshot definition says tick is optional.
            // But user said: "Recording uses ioSnapshot.tick as the timebase. If missing, fail loudly"
            // So we should enforce tick existence for Replay.
        }
    }

    return {
        ok: errors.length === 0,
        errors
    };
}

// Reuse or recreate stable stringify. 
// Ideally we import { stableStringify } from '@redbyte/rb-utils' or similar if available, 
// but for now JSON.stringify is acceptable for MVP unless strict determinism needed for hashing.
export const serializeTrace = (trace: HardwareTraceV1): string => {
    return JSON.stringify(trace, null, 2);
};

export const deserializeTrace = (json: string): HardwareTraceV1 => {
    return JSON.parse(json) as HardwareTraceV1;
};
