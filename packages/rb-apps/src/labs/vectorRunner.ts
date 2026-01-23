// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { useSimStore } from './simAdapter';
import { hardwareClient, type IOSnapshot } from '../services/hardwareClient';

/**
 * VectorRunner - Automated test vector execution engine
 */

export interface TestVector {
    id: string;
    name: string;
    inputs: {
        SW?: number;
        BTN?: number;
    };
    expected: {
        LED?: number;
        SEG?: number;
    };
    holdTicks?: number; // How many ticks to hold these inputs
}

export interface VectorRunResult {
    vectorId: string;
    status: 'PASS' | 'FAIL' | 'RUNNING' | 'PENDING';
    observed: {
        LED?: number;
        SEG?: number;
    };
    error?: string;
    tick: number;
}

export interface RunOptions {
    mode: 'sim' | 'hardware';
    delayMs?: number;
    onUpdate?: (results: VectorRunResult[]) => void;
}

export class VectorRunner {
    private isRunning = false;
    private currentResults: VectorRunResult[] = [];

    /**
     * Run a set of vectors
     */
    async runVectors(
        vectors: TestVector[],
        options: RunOptions
    ): Promise<VectorRunResult[]> {
        if (this.isRunning) {
            throw new Error('VectorRunner is already running');
        }

        this.isRunning = true;
        this.currentResults = vectors.map(v => ({
            vectorId: v.id,
            status: 'PENDING',
            observed: {},
            tick: 0
        }));

        if (options.onUpdate) options.onUpdate([...this.currentResults]);

        for (let i = 0; i < vectors.length; i++) {
            const vector = vectors[i];
            const result = this.currentResults[i];
            result.status = 'RUNNING';
            if (options.onUpdate) options.onUpdate([...this.currentResults]);

            try {
                const observed = await this.executeVector(vector, options);

                // Compute verdict
                let pass = true;
                const errors: string[] = [];

                if (vector.expected.LED !== undefined && observed.LED !== vector.expected.LED) {
                    pass = false;
                    errors.push(`LED mismatch: expected ${vector.expected.LED}, got ${observed.LED}`);
                }

                if (vector.expected.SEG !== undefined && observed.SEG !== vector.expected.SEG) {
                    pass = false;
                    errors.push(`SEG mismatch: expected ${vector.expected.SEG}, got ${observed.SEG}`);
                }

                result.status = pass ? 'PASS' : 'FAIL';
                result.observed = observed;
                result.error = pass ? undefined : errors.join('; ');

            } catch (err: any) {
                result.status = 'FAIL';
                result.error = err.message || 'Execution error';
            }

            if (options.onUpdate) options.onUpdate([...this.currentResults]);

            if (options.delayMs && i < vectors.length - 1) {
                await new Promise(resolve => setTimeout(resolve, options.delayMs));
            }
        }

        this.isRunning = false;
        return this.currentResults;
    }

    private async executeVector(
        vector: TestVector,
        options: RunOptions
    ): Promise<{ LED?: number; SEG?: number }> {
        const holdTicks = vector.holdTicks || 1;

        if (options.mode === 'sim') {
            const store = useSimStore.getState();

            // Set inputs
            store.setInputs(vector.inputs);

            // Run ticks
            for (let t = 0; t < holdTicks; t++) {
                store.runTick();
            }

            const finalState = useSimStore.getState();
            return {
                LED: finalState.outputs.LED,
                SEG: finalState.outputs.SEG
            };
        } else {
            // Hardware mode
            if (vector.inputs.SW !== undefined) {
                await hardwareClient.setOutputs({ SW: vector.inputs.SW });
            }
            if (vector.inputs.BTN !== undefined) {
                await hardwareClient.setOutputs({ BTN: vector.inputs.BTN });
            }

            // Wait for propagation (and hold time)
            const waitMs = (holdTicks * 100) + (options.delayMs || 50);
            await new Promise(resolve => setTimeout(resolve, waitMs));

            const snapshot = hardwareClient.getLatestIO();
            if (!snapshot) throw new Error('No hardware snapshot available');

            return {
                LED: typeof snapshot.outputs.LED === 'number' ? snapshot.outputs.LED : parseInt(String(snapshot.outputs.LED || '0'), 2),
                // SEG is typically not readable from hardware in basic mode
            };
        }
    }

    getStatus() {
        return this.isRunning;
    }
}

export const vectorRunner = new VectorRunner();
