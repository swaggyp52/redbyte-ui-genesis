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

    if (typeof trace.startTick !== 'number') {
        errors.push('Missing or invalid startTick');
    }

    if (!Array.isArray(trace.samples)) {
        errors.push('Missing samples array');
    } else {
        // Deep validation of samples
        let previousTick = trace.startTick - 1;

        for (let i = 0; i < trace.samples.length; i++) {
            const s = trace.samples[i];

            // Check essential fields
            if (!s.timestamp) {
                errors.push(`Sample ${i}: Missing timestamp`);
                break;
            }

            // Check tick (required for replay synchronization)
            if (typeof s.tick !== 'number') {
                errors.push(`Sample ${i}: Missing or invalid tick`);
                break;
            }

            // Monotonicity check (ticks must strictly increase or stay same if burst? No, usually distinct or strictly increasing)
            // Actually, we might have multiple events in same tick? 
            // The polling interval is usually larger than a tick, but hardware might send bursts.
            // Let's enforce non-decreasing.
            if (s.tick < previousTick) {
                errors.push(`Sample ${i}: Time travel detected (tick ${s.tick} < previous ${previousTick})`);
                break;
            }
            previousTick = s.tick!;

            // Check inputs/outputs existence
            if (!s.inputs || typeof s.inputs !== 'object') {
                errors.push(`Sample ${i}: Missing inputs object`);
                break;
            }
            if (!s.outputs || typeof s.outputs !== 'object') {
                errors.push(`Sample ${i}: Missing outputs object`);
                break;
            }
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
