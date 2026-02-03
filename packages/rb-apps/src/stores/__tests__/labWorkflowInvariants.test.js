import { act } from '@testing-library/react';
import { useLabWorkflowStore } from '../useLabWorkflowStore';
import { describe, it, expect, beforeEach } from 'vitest';
describe('useLabWorkflowStore Invariants', () => {
    beforeEach(() => {
        act(() => {
            useLabWorkflowStore.getState().reset();
        });
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
