// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { CircuitEngine } from './CircuitEngine';
/**
 * Creates a node behavior from a composite node definition
 */
export function createCompositeNodeBehavior(def) {
    return {
        evaluate(inputs, state) {
            // Create or retrieve subcircuit engine
            let engine = state.engine;
            if (!engine) {
                engine = new CircuitEngine(JSON.parse(JSON.stringify(def.subcircuit)));
            }
            // Map external inputs to internal nodes
            for (const [externalPort, internalRef] of Object.entries(def.inputMapping)) {
                const [nodeId, portName] = internalRef.split('.');
                const value = inputs[externalPort] ?? 0;
                // Find the internal node and set its state to output the input value
                const node = def.subcircuit.nodes.find(n => n.id === nodeId);
                if (node && node.type === 'Switch') {
                    // Use Switch nodes as input receivers
                    engine.setNodeState(nodeId, { isOn: value });
                }
            }
            // Run simulation until stable
            engine.stabilize(50);
            // Map internal outputs to external outputs
            const outputs = {};
            const signals = engine.getAllSignals();
            for (const [externalPort, internalRef] of Object.entries(def.outputMapping)) {
                const signal = signals.get(internalRef) ?? 0;
                outputs[externalPort] = signal;
            }
            return {
                outputs,
                state: { engine },
            };
        },
    };
}
/**
 * Register a composite node in the registry
 */
import { NodeRegistry } from './NodeRegistry';
export function registerCompositeNode(def) {
    const behavior = createCompositeNodeBehavior(def);
    NodeRegistry.register(def.name, behavior);
}
