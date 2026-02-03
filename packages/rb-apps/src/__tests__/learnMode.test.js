// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { describe, it, expect } from 'vitest';
import { GUIDED_EXAMPLES, getCurrentStep, isExampleComplete, validateCurrentStep, } from '../logic/learnMode';
import { createTestNode } from './testUtils';
describe('Learn Mode', () => {
    describe('GUIDED_EXAMPLES', () => {
        it('should have NOT gate example', () => {
            expect(GUIDED_EXAMPLES['not-gate']).toBeDefined();
            expect(GUIDED_EXAMPLES['not-gate'].title).toBe('NOT Gate');
            expect(GUIDED_EXAMPLES['not-gate'].difficulty).toBe('beginner');
            expect(GUIDED_EXAMPLES['not-gate'].steps.length).toBeGreaterThan(0);
        });
        it('should have Half Adder example', () => {
            expect(GUIDED_EXAMPLES['half-adder']).toBeDefined();
            expect(GUIDED_EXAMPLES['half-adder'].title).toBe('Half Adder');
            expect(GUIDED_EXAMPLES['half-adder'].difficulty).toBe('beginner');
            expect(GUIDED_EXAMPLES['half-adder'].steps.length).toBeGreaterThan(0);
        });
    });
    describe('getCurrentStep', () => {
        it('should return first step when no steps completed', () => {
            const example = GUIDED_EXAMPLES['not-gate'];
            const completedSteps = new Set();
            const currentStep = getCurrentStep(example, completedSteps);
            expect(currentStep).toBeDefined();
            expect(currentStep?.id).toBe('add-switch');
        });
        it('should return second step when first step completed', () => {
            const example = GUIDED_EXAMPLES['not-gate'];
            const completedSteps = new Set(['add-switch']);
            const currentStep = getCurrentStep(example, completedSteps);
            expect(currentStep).toBeDefined();
            expect(currentStep?.id).toBe('add-not');
        });
        it('should return null when all steps completed', () => {
            const example = GUIDED_EXAMPLES['not-gate'];
            const completedSteps = new Set(example.steps.map((s) => s.id));
            const currentStep = getCurrentStep(example, completedSteps);
            expect(currentStep).toBeNull();
        });
    });
    describe('isExampleComplete', () => {
        it('should return false when no steps completed', () => {
            const example = GUIDED_EXAMPLES['not-gate'];
            const completedSteps = new Set();
            expect(isExampleComplete(example, completedSteps)).toBe(false);
        });
        it('should return false when some steps completed', () => {
            const example = GUIDED_EXAMPLES['not-gate'];
            const completedSteps = new Set(['add-switch', 'add-not']);
            expect(isExampleComplete(example, completedSteps)).toBe(false);
        });
        it('should return true when all steps completed', () => {
            const example = GUIDED_EXAMPLES['not-gate'];
            const completedSteps = new Set(example.steps.map((s) => s.id));
            expect(isExampleComplete(example, completedSteps)).toBe(true);
        });
    });
    describe('validateCurrentStep - NOT Gate', () => {
        it('should validate first step - add switch', () => {
            const example = GUIDED_EXAMPLES['not-gate'];
            const completedSteps = new Set();
            const circuitWithoutSwitch = {
                nodes: [],
                connections: [],
            };
            const circuitWithSwitch = {
                nodes: [createTestNode('sw1', 'Switch', { x: 0, y: 0 })],
                connections: [],
            };
            expect(validateCurrentStep(example, completedSteps, circuitWithoutSwitch).isValid).toBe(false);
            expect(validateCurrentStep(example, completedSteps, circuitWithSwitch).isValid).toBe(true);
        });
        it('should validate second step - add NOT gate', () => {
            const example = GUIDED_EXAMPLES['not-gate'];
            const completedSteps = new Set(['add-switch']);
            const circuitWithoutNOT = {
                nodes: [createTestNode('sw1', 'Switch', { x: 0, y: 0 })],
                connections: [],
            };
            const circuitWithNOT = {
                nodes: [
                    createTestNode('sw1', 'Switch', { x: 0, y: 0 }),
                    createTestNode('not1', 'NOT', { x: 100, y: 0 }),
                ],
                connections: [],
            };
            expect(validateCurrentStep(example, completedSteps, circuitWithoutNOT).isValid).toBe(false);
            expect(validateCurrentStep(example, completedSteps, circuitWithNOT).isValid).toBe(true);
        });
        it('should validate wiring step - switch to NOT', () => {
            const example = GUIDED_EXAMPLES['not-gate'];
            const completedSteps = new Set(['add-switch', 'add-not', 'add-lamp']);
            const circuitUnwired = {
                nodes: [
                    createTestNode('sw1', 'Switch', { x: 0, y: 0 }),
                    createTestNode('not1', 'NOT', { x: 100, y: 0 }),
                    createTestNode('lamp1', 'Lamp', { x: 200, y: 0 }),
                ],
                connections: [],
            };
            const circuitWired = {
                nodes: [
                    createTestNode('sw1', 'Switch', { x: 0, y: 0 }),
                    createTestNode('not1', 'NOT', { x: 100, y: 0 }),
                    createTestNode('lamp1', 'Lamp', { x: 200, y: 0 }),
                ],
                connections: [
                    { from: { nodeId: 'sw1', portName: 'out' }, to: { nodeId: 'not1', portName: 'in' } },
                ],
            };
            expect(validateCurrentStep(example, completedSteps, circuitUnwired).isValid).toBe(false);
            expect(validateCurrentStep(example, completedSteps, circuitWired).isValid).toBe(true);
        });
    });
    describe('validateCurrentStep - Half Adder', () => {
        it('should validate first step - add two switches', () => {
            const example = GUIDED_EXAMPLES['half-adder'];
            const completedSteps = new Set();
            const circuitWithOneSwitch = {
                nodes: [createTestNode('sw1', 'Switch', { x: 0, y: 0 })],
                connections: [],
            };
            const circuitWithTwoSwitches = {
                nodes: [
                    createTestNode('sw1', 'Switch', { x: 0, y: 0 }),
                    createTestNode('sw2', 'Switch', { x: 0, y: 50 }),
                ],
                connections: [],
            };
            expect(validateCurrentStep(example, completedSteps, circuitWithOneSwitch).isValid).toBe(false);
            expect(validateCurrentStep(example, completedSteps, circuitWithTwoSwitches).isValid).toBe(true);
        });
        it('should validate XOR gate wiring step', () => {
            const example = GUIDED_EXAMPLES['half-adder'];
            const completedSteps = new Set([
                'add-inputs',
                'add-xor',
                'add-and',
                'add-outputs',
            ]);
            const circuitUnwired = {
                nodes: [
                    createTestNode('sw1', 'Switch', { x: 0, y: 0 }),
                    createTestNode('sw2', 'Switch', { x: 0, y: 50 }),
                    createTestNode('xor1', 'XOR', { x: 100, y: 25 }),
                    createTestNode('and1', 'AND', { x: 100, y: 75 }),
                ],
                connections: [],
            };
            const circuitWired = {
                nodes: [
                    createTestNode('sw1', 'Switch', { x: 0, y: 0 }),
                    createTestNode('sw2', 'Switch', { x: 0, y: 50 }),
                    createTestNode('xor1', 'XOR', { x: 100, y: 25 }),
                    createTestNode('and1', 'AND', { x: 100, y: 75 }),
                ],
                connections: [
                    { from: { nodeId: 'sw1', portName: 'out' }, to: { nodeId: 'xor1', portName: 'in1' } },
                    { from: { nodeId: 'sw2', portName: 'out' }, to: { nodeId: 'xor1', portName: 'in2' } },
                ],
            };
            expect(validateCurrentStep(example, completedSteps, circuitUnwired).isValid).toBe(false);
            expect(validateCurrentStep(example, completedSteps, circuitWired).isValid).toBe(true);
        });
    });
});
