// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Register all builtin node definitions into a registry
 * This function is called by createDefaultNodeRegistry() and should not trigger side effects on import
 */
export function registerBuiltinNodeDefinitions(registry) {
    /** Power source: always outputs 1 */
    registry.register({
        type: "PowerSource",
        update() {
            return { out: 1 };
        },
    });
    /** POWER: alias for PowerSource */
    registry.register({
        type: "POWER",
        update() {
            return { out: 1 };
        },
    });
    /** Wire: forwards input to output */
    registry.register({
        type: "Wire",
        update(_node, inputs) {
            return { out: inputs["in"] ?? 0 };
        },
    });
    /** Lamp: same behavior as wire (UI handles display) */
    registry.register({
        type: "Lamp",
        update(_node, inputs) {
            return { out: inputs["in"] ?? 0 };
        },
    });
    /** LAMP: alias for Lamp */
    registry.register({
        type: "LAMP",
        update(_node, inputs) {
            return { out: inputs["in"] ?? 0 };
        },
    });
    /** Clock: outputs pattern 1,1,0,0 repeating */
    registry.register({
        type: "Clock",
        update(_node, _inputs, _dt, tickIndex) {
            const phase = tickIndex % 4;
            return { out: phase < 2 ? 1 : 0 };
        },
    });
    /** Delay: shift register behavior */
    registry.register({
        type: "Delay",
        update(node, inputs) {
            const steps = (node.config?.steps ?? 2) | 0;
            if (!node.state)
                node.state = new Array(steps).fill(0);
            const input = inputs["in"] ?? 0;
            // shift: pop last → output, push new input at front
            const oldOutput = node.state[steps - 1];
            for (let i = steps - 1; i > 0; i--) {
                node.state[i] = node.state[i - 1];
            }
            node.state[0] = input;
            return { out: oldOutput };
        },
    });
    /** Switch: toggleable input (state-based) */
    registry.register({
        type: "Switch",
        update(node) {
            const isOn = node.state?.isOn ?? 0;
            return { out: isOn };
        },
    });
    /** SWITCH: alias for Switch */
    registry.register({
        type: "SWITCH",
        update(node) {
            const isOn = node.state?.isOn ?? 0;
            return { out: isOn };
        },
    });
    /** AND gate: outputs 1 only if both inputs are 1 */
    registry.register({
        type: "AND",
        update(_node, inputs) {
            const a = inputs["a"] ?? inputs["in1"] ?? 0;
            const b = inputs["b"] ?? inputs["in2"] ?? 0;
            return { out: (a && b ? 1 : 0) };
        },
    });
    /** OR gate: outputs 1 if either input is 1 */
    registry.register({
        type: "OR",
        update(_node, inputs) {
            const a = inputs["a"] ?? inputs["in1"] ?? 0;
            const b = inputs["b"] ?? inputs["in2"] ?? 0;
            return { out: (a || b ? 1 : 0) };
        },
    });
    /** NOT gate: inverts the input */
    registry.register({
        type: "NOT",
        update(_node, inputs) {
            const input = inputs["in"] ?? 0;
            return { out: (input ? 0 : 1) };
        },
    });
    /** NAND gate: NOT AND */
    registry.register({
        type: "NAND",
        update(_node, inputs) {
            const a = inputs["a"] ?? inputs["in1"] ?? 0;
            const b = inputs["b"] ?? inputs["in2"] ?? 0;
            return { out: (a && b ? 0 : 1) };
        },
    });
    /** NOR gate: NOT OR */
    registry.register({
        type: "NOR",
        update(_node, inputs) {
            const a = inputs["a"] ?? inputs["in1"] ?? 0;
            const b = inputs["b"] ?? inputs["in2"] ?? 0;
            return { out: (a || b ? 0 : 1) };
        },
    });
    /** XOR gate: outputs 1 if inputs are different */
    registry.register({
        type: "XOR",
        update(_node, inputs) {
            const a = inputs["a"] ?? inputs["in1"] ?? 0;
            const b = inputs["b"] ?? inputs["in2"] ?? 0;
            return { out: (a !== b ? 1 : 0) };
        },
    });
    /** XNOR gate: outputs 1 if inputs are the same */
    registry.register({
        type: "XNOR",
        update(_node, inputs) {
            const a = inputs["a"] ?? inputs["in1"] ?? 0;
            const b = inputs["b"] ?? inputs["in2"] ?? 0;
            return { out: (a === b ? 1 : 0) };
        },
    });
    /** INPUT: same as Switch - toggleable input */
    registry.register({
        type: "INPUT",
        update(node) {
            const isOn = node.state?.isOn ?? 0;
            return { out: isOn };
        },
    });
    /** OUTPUT: same as Lamp - displays input state */
    registry.register({
        type: "OUTPUT",
        update(_node, inputs) {
            return { out: inputs["in"] ?? 0 };
        },
    });
    /** D_FLIP_FLOP: edge-triggered memory element */
    registry.register({
        type: "D_FLIP_FLOP",
        update(node, inputs) {
            const d = inputs["d"] ?? inputs["D"] ?? 0;
            const clk = inputs["clk"] ?? inputs["clock"] ?? inputs["CLK"] ?? 0;
            const prevClk = node.state?.prevClk ?? 0;
            // Rising edge detection
            if (clk === 1 && prevClk === 0) {
                node.state = { q: d, prevClk: clk };
                return { q: d, qBar: d ? 0 : 1 };
            }
            // No edge, maintain state
            const q = node.state?.q ?? 0;
            node.state = { ...node.state, prevClk: clk };
            return { q, qBar: q ? 0 : 1 };
        },
    });
    // --- Analog Nodes ---
    // Import simulation logic from @redbyte/rb-analog-sim
    // These require @redbyte/rb-analog-sim as a dependency in rb-logic-core's package.json
    let analogSim;
    try {
        // Dynamically require to avoid breaking browser builds if analog sim is not present
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        analogSim = require('@redbyte/rb-analog-sim');
    }
    catch (e) {
        analogSim = null;
    }
    if (analogSim) {
        // Register analog nodes using NodeBehavior interface
        registry.register({
            type: 'FixedResistor',
            evaluate(_inputs, state, config, node) {
                const analogNode = {
                    id: node?.id ?? '',
                    type: 'FixedResistor',
                    config: config || {},
                    inputs: {},
                    outputs: { resistance: 0 },
                    state: state || {},
                };
                const result = analogSim.simulateFixedResistor(analogNode);
                // eslint-disable-next-line no-console
                console.log('[AnalogSim] FixedResistor', analogNode, result);
                return {
                    outputs: { resistance: result.outputs.resistance },
                    state: result.state,
                };
            },
        });
        registry.register({
            type: 'LM358',
            evaluate(inputs, state, config, node) {
                const analogNode = {
                    id: node?.id ?? '',
                    type: 'LM358',
                    inputs: {
                        V_plus: inputs['V_plus'] ?? 0,
                        V_minus: inputs['V_minus'] ?? 0,
                    },
                    outputs: { out: 0 },
                    state: state || {},
                    config: config || {},
                };
                const result = analogSim.simulateComparator(analogNode);
                // eslint-disable-next-line no-console
                console.log('[AnalogSim] LM358', analogNode, result);
                return {
                    outputs: { out: result.outputs.out },
                    state: result.state,
                };
            },
        });
        registry.register({
            type: 'LDR',
            evaluate(inputs, state, config, node) {
                const analogNode = {
                    id: node?.id ?? '',
                    type: 'LDR',
                    inputs: {
                        light: inputs['light'] ?? 0,
                        v_in: inputs['v_in'] ?? 0,
                    },
                    outputs: { resistance: 0, v_out: 0 },
                    state: state || {},
                    config: config || {},
                };
                const result = analogSim.simulateLdr(analogNode);
                // eslint-disable-next-line no-console
                console.log('[AnalogSim] LDR', analogNode, result);
                return {
                    outputs: {
                        resistance: result.outputs.resistance,
                        v_out: result.outputs.v_out,
                    },
                    state: result.state,
                };
            },
        });
        registry.register({
            type: 'VoltageDivider',
            evaluate(inputs, state, config, node) {
                const analogNode = {
                    id: node?.id ?? '',
                    type: 'VoltageDivider',
                    inputs: {
                        v_in: inputs['v_in'] ?? 0,
                        r1: inputs['r1'] ?? 0,
                        r2: inputs['r2'] ?? 0,
                    },
                    outputs: { v_out: 0 },
                    state: state || {},
                    config: config || {},
                };
                const result = analogSim.simulateVoltageDivider(analogNode);
                // eslint-disable-next-line no-console
                console.log('[AnalogSim] VoltageDivider', analogNode, result);
                return {
                    outputs: { v_out: result.outputs.v_out },
                    state: result.state,
                };
            },
        });
    }
}
