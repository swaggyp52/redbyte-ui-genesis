import { renderHook, act } from '@testing-library/react';
import { useLabWorkflowStore } from '../useLabWorkflowStore';
import { describe, it, expect, beforeEach } from 'vitest';

describe('useLabWorkflowStore Invariants', () => {
    beforeEach(() => {
        act(() => {
            useLabWorkflowStore.getState().reset();
        });
    });

    it('preserves verification result payloads independently of presentation', () => {
        const results = [
            { id: 'vector-0', name: 'SW0', pass: true, observed: { LED: 1 }, expected: { LED: 1 } },
            { id: 'vector-1', name: 'SW1', pass: false, error: 'LED mismatch', observed: { LED: 0 }, expected: { LED: 2 } },
        ];
        useLabWorkflowStore.getState().setVerificationResults(results);
        expect(useLabWorkflowStore.getState().verificationResults).toEqual(results);
        useLabWorkflowStore.getState().reset();
        expect(useLabWorkflowStore.getState().verificationResults).toEqual([]);
    });

    it('preserves I/O snapshot groups and transport metadata until reset', () => {
        const snapshot = {
            timestamp: '2026-10-01T00:00:00.000Z', tick: 7,
            inputs: { SW: 3, BTN: 0 }, outputs: { LED: 3, SEG: '0011' },
            source: 'bridge', port: 'COM7',
        };
        useLabWorkflowStore.getState().addHardwareSnapshot(snapshot);
        expect(useLabWorkflowStore.getState().hardwareSnapshots).toEqual([snapshot]);
        useLabWorkflowStore.getState().reset();
        expect(useLabWorkflowStore.getState().hardwareSnapshots).toEqual([]);
    });

    it('should start at selection step', () => {
        expect(useLabWorkflowStore.getState().currentStep).toBe('selection');
    });

    it('should block jumping to specification if selection is not complete', () => {
        act(() => {
            useLabWorkflowStore.getState().setStep('specification');
        });
        // Should still be selection
        expect(useLabWorkflowStore.getState().currentStep).toBe('selection');
    });

    it('should allow jumping to specification after completing selection', () => {
        act(() => {
            useLabWorkflowStore.getState().completeStep('selection');
            useLabWorkflowStore.getState().setStep('specification');
        });
        expect(useLabWorkflowStore.getState().currentStep).toBe('specification');
    });

    it('should allow moving backward freely', () => {
        act(() => {
            useLabWorkflowStore.getState().completeStep('selection');
            useLabWorkflowStore.getState().setStep('specification');
        });
        expect(useLabWorkflowStore.getState().currentStep).toBe('specification');

        act(() => {
            useLabWorkflowStore.getState().setStep('selection');
        });
        expect(useLabWorkflowStore.getState().currentStep).toBe('selection');
    });

    it('should block jumping past multiple steps', () => {
        act(() => {
            useLabWorkflowStore.getState().completeStep('selection');
            // Try to jump to design
            useLabWorkflowStore.getState().setStep('design');
        });
        // Should stay at selection (or specification if it was set)
        expect(useLabWorkflowStore.getState().currentStep).toBe('selection');
    });

    it('should correctly calculate getMaxUnlockedStepIndex', () => {
        expect(useLabWorkflowStore.getState().getMaxUnlockedStepIndex()).toBe(0); // selection is step 0

        act(() => {
            useLabWorkflowStore.getState().completeStep('selection');
        });
        expect(useLabWorkflowStore.getState().getMaxUnlockedStepIndex()).toBe(1); // specification

        act(() => {
            useLabWorkflowStore.getState().completeStep('specification');
        });
        expect(useLabWorkflowStore.getState().getMaxUnlockedStepIndex()).toBe(2); // design
    });

    it('should allow navigation to the exactly next step', () => {
        act(() => {
            useLabWorkflowStore.getState().completeStep('selection');
            useLabWorkflowStore.getState().setStep('specification');
        });
        expect(useLabWorkflowStore.getState().currentStep).toBe('specification');
    });
});
