// Copyright Ac 2025 Connor Angiel - RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import { NodeRegistry } from './NodeRegistry';
import { simulateComparator, simulateLdr, simulateVoltageDivider, simulateFixedResistor, simulateVoltageSource, } from '@redbyte/rb-analog-sim';
function readNumeric(inputs, state, config, keys, fallback = 0) {
    for (const key of keys) {
        const value = inputs[key] ?? state[key] ?? config[key];
        if (typeof value === 'number' && !Number.isNaN(value)) {
            return value;
        }
    }
    return fallback;
}
export function registerAnalogNodes() {
    NodeRegistry.register('FixedResistor', {
        evaluate(_inputs, state, config, node) {
            const resistance = readNumeric(_inputs, state, config, ['resistance'], 10000);
            const analogNode = {
                id: node?.id ?? '',
                type: 'FixedResistor',
                inputs: {},
                outputs: { resistance: 0 },
                state,
                config: { ...config, resistance },
            };
            const result = simulateFixedResistor(analogNode);
            return {
                outputs: { resistance: result.outputs.resistance },
                state: result.state ?? state,
            };
        },
    });
    NodeRegistry.register('LDR', {
        evaluate(inputs, state, config, node) {
            const light = readNumeric(inputs, state, config, ['light'], 0);
            const vIn = readNumeric(inputs, state, config, ['v_in', 'vin'], 0);
            const analogNode = {
                id: node?.id ?? '',
                type: 'LDR',
                inputs: { light, v_in: vIn },
                outputs: { resistance: 0, v_out: 0 },
                state,
                config,
            };
            const result = simulateLdr(analogNode);
            return {
                outputs: {
                    resistance: result.outputs.resistance,
                    v_out: result.outputs.v_out,
                },
                state: result.state ?? state,
            };
        },
    });
    NodeRegistry.register('VoltageDivider', {
        evaluate(inputs, state, config, node) {
            const vIn = readNumeric(inputs, state, config, ['v_in', 'vin'], 0);
            const r1 = readNumeric(inputs, state, config, ['r1'], 0);
            const r2 = readNumeric(inputs, state, config, ['r2'], 0);
            const analogNode = {
                id: node?.id ?? '',
                type: 'VoltageDivider',
                inputs: { v_in: vIn, r1, r2 },
                outputs: { v_out: 0 },
                state,
                config,
            };
            const result = simulateVoltageDivider(analogNode);
            return {
                outputs: { v_out: result.outputs.v_out },
                state: result.state ?? state,
            };
        },
    });
    NodeRegistry.register('LM358', {
        evaluate(inputs, state, config, node) {
            const vPlus = readNumeric(inputs, state, config, ['V_plus', 'v_plus', 'vplus'], 0);
            const vMinus = readNumeric(inputs, state, config, ['V_minus', 'v_minus', 'vminus'], 0);
            const analogNode = {
                id: node?.id ?? '',
                type: 'LM358',
                inputs: { V_plus: vPlus, V_minus: vMinus },
                outputs: { out: 0 },
                state,
                config,
            };
            const result = simulateComparator(analogNode);
            return {
                outputs: { out: result.outputs.out },
                state: result.state ?? state,
            };
        },
    });
    NodeRegistry.register('VoltageSource', {
        evaluate(inputs, state, config, node) {
            const voltage = readNumeric(inputs, state, config, ['voltage', 'v_out', 'v'], 5);
            const analogNode = {
                id: node?.id ?? '',
                type: 'VoltageSource',
                inputs: {},
                outputs: { out: 0 },
                state,
                config: { ...config, voltage },
            };
            const result = simulateVoltageSource(analogNode);
            return {
                outputs: { out: result.outputs.out },
                state: result.state ?? state,
            };
        },
    });
}
