// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Built-in guided examples
 */
export const GUIDED_EXAMPLES = {
    'not-gate': {
        id: 'not-gate',
        title: 'NOT Gate',
        description: 'Build a simple inverter circuit',
        difficulty: 'beginner',
        initialCircuit: {
            nodes: [],
            connections: [],
        },
        steps: [
            {
                id: 'add-switch',
                title: 'Add a Switch',
                hint: 'This will be your input',
                validate: (circuit) => {
                    return circuit.nodes.some((n) => n.type === 'Switch');
                },
            },
            {
                id: 'add-not',
                title: 'Add a NOT gate',
                hint: 'NOT inverts the signal (0 → 1, 1 → 0)',
                validate: (circuit) => {
                    return circuit.nodes.some((n) => n.type === 'NOT');
                },
            },
            {
                id: 'add-lamp',
                title: 'Add a Lamp',
                hint: 'This shows the inverted output',
                validate: (circuit) => {
                    return circuit.nodes.some((n) => n.type === 'Lamp');
                },
            },
            {
                id: 'wire-input',
                title: 'Connect Switch to NOT input',
                validate: (circuit) => {
                    const notNode = circuit.nodes.find((n) => n.type === 'NOT');
                    if (!notNode)
                        return false;
                    return circuit.connections.some((c) => c.to.nodeId === notNode.id && c.to.portName === 'in');
                },
            },
            {
                id: 'wire-output',
                title: 'Connect NOT output to Lamp',
                validate: (circuit) => {
                    const notNode = circuit.nodes.find((n) => n.type === 'NOT');
                    const lamp = circuit.nodes.find((n) => n.type === 'Lamp');
                    if (!notNode || !lamp)
                        return false;
                    return circuit.connections.some((c) => c.from.nodeId === notNode.id && c.to.nodeId === lamp.id);
                },
            },
            {
                id: 'test-circuit',
                title: 'Toggle the switch and watch the lamp',
                hint: 'When switch is OFF, lamp should be ON, and vice versa.',
                validate: () => false, // Manual step
            },
        ],
        completionMessage: 'Perfect! NOT gates are the simplest logic gate - they just flip the signal.',
    },
    'half-adder': {
        id: 'half-adder',
        title: 'Half Adder',
        description: 'Build a circuit that adds two binary digits',
        difficulty: 'beginner',
        initialCircuit: {
            nodes: [],
            connections: [],
        },
        steps: [
            {
                id: 'add-inputs',
                title: 'Add two Switches',
                hint: 'These will be your input bits (A and B)',
                validate: (circuit) => {
                    const switches = circuit.nodes.filter((n) => n.type === 'Switch');
                    return switches.length >= 2;
                },
            },
            {
                id: 'add-xor',
                title: 'Add an XOR gate',
                hint: 'XOR gives you the sum bit (A ⊕ B)',
                validate: (circuit) => {
                    return circuit.nodes.some((n) => n.type === 'XOR');
                },
            },
            {
                id: 'add-and',
                title: 'Add an AND gate',
                hint: 'AND gives you the carry bit (A · B)',
                validate: (circuit) => {
                    return circuit.nodes.some((n) => n.type === 'AND');
                },
            },
            {
                id: 'add-outputs',
                title: 'Add two Lamps',
                hint: 'One for Sum, one for Carry',
                validate: (circuit) => {
                    const lamps = circuit.nodes.filter((n) => n.type === 'Lamp');
                    return lamps.length >= 2;
                },
            },
            {
                id: 'wire-xor',
                title: 'Connect both switches to XOR inputs',
                hint: 'This creates the sum: A ⊕ B',
                validate: (circuit) => {
                    const xorNode = circuit.nodes.find((n) => n.type === 'XOR');
                    if (!xorNode)
                        return false;
                    const xorInputs = circuit.connections.filter((c) => c.to.nodeId === xorNode.id && (c.to.portName === 'in1' || c.to.portName === 'in2'));
                    return xorInputs.length >= 2;
                },
            },
            {
                id: 'wire-and',
                title: 'Connect both switches to AND inputs',
                hint: 'This creates the carry: A · B',
                validate: (circuit) => {
                    const andNode = circuit.nodes.find((n) => n.type === 'AND');
                    if (!andNode)
                        return false;
                    const andInputs = circuit.connections.filter((c) => c.to.nodeId === andNode.id && (c.to.portName === 'in1' || c.to.portName === 'in2'));
                    return andInputs.length >= 2;
                },
            },
            {
                id: 'wire-outputs',
                title: 'Connect XOR to one lamp, AND to the other',
                hint: 'XOR output = Sum bit, AND output = Carry bit',
                validate: (circuit) => {
                    const xorNode = circuit.nodes.find((n) => n.type === 'XOR');
                    const andNode = circuit.nodes.find((n) => n.type === 'AND');
                    const lamps = circuit.nodes.filter((n) => n.type === 'Lamp');
                    if (!xorNode || !andNode || lamps.length < 2)
                        return false;
                    const xorToLamp = circuit.connections.some((c) => c.from.nodeId === xorNode.id && lamps.some((l) => l.id === c.to.nodeId));
                    const andToLamp = circuit.connections.some((c) => c.from.nodeId === andNode.id && lamps.some((l) => l.id === c.to.nodeId));
                    return xorToLamp && andToLamp;
                },
            },
            {
                id: 'test-circuit',
                title: 'Test all four input combinations',
                hint: 'Try: 0+0, 0+1, 1+0, 1+1. Watch which lamps light up.',
                validate: () => false, // Manual validation - user tests the circuit
            },
        ],
        completionMessage: 'You built a Half Adder! This is the foundation of all computer arithmetic.',
    },
};
/**
 * Get the current step for an active example
 */
export function getCurrentStep(example, completedSteps) {
    for (const step of example.steps) {
        if (!completedSteps.has(step.id)) {
            return step;
        }
    }
    return null; // All steps complete
}
/**
 * Check if example is complete
 */
export function isExampleComplete(example, completedSteps) {
    return example.steps.every((step) => completedSteps.has(step.id));
}
/**
 * Auto-validate current step against circuit
 */
export function validateCurrentStep(example, completedSteps, circuit) {
    const currentStep = getCurrentStep(example, completedSteps);
    if (!currentStep) {
        return { isValid: false, step: null };
    }
    if (!currentStep.validate) {
        return { isValid: false, step: currentStep }; // Manual validation required
    }
    const isValid = currentStep.validate(circuit);
    return { isValid, step: currentStep };
}
