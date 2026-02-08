// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
/**
 * Node registry - maps node type strings to their definitions
 */
export class NodeRegistry {
    nodes = new Map();
    register(def) {
        this.nodes.set(def.type, def);
    }
    get(type) {
        return this.nodes.get(type);
    }
    getOrThrow(type) {
        const def = this.nodes.get(type);
        if (!def) {
            throw new Error(`Unknown node type: ${type}`);
        }
        return def;
    }
    clear() {
        this.nodes.clear();
    }
    has(type) {
        return this.nodes.has(type);
    }
}
/**
 * Global registry instance (for backwards compatibility)
 * Lazily initialized with builtins on first access
 */
let globalRegistry = null;
function ensureGlobalRegistry() {
    if (!globalRegistry) {
        globalRegistry = createDefaultNodeRegistry();
    }
    return globalRegistry;
}
/**
 * Register a node definition in the global registry
 * @deprecated Use NodeRegistry directly for better testability
 */
export function registerNode(def) {
    ensureGlobalRegistry().register(def);
}
/**
 * Get node definition from global registry
 * @deprecated Use NodeRegistry directly for better testability
 */
export function getNodeDefinition(type) {
    return ensureGlobalRegistry().getOrThrow(type);
}
/**
 * Clear global registry
 * @deprecated Use NodeRegistry directly for better testability
 */
export function clearRegistry() {
    if (globalRegistry) {
        globalRegistry.clear();
    }
}
/**
 * Register builtin nodes (no-op, kept for backwards compatibility)
 * @deprecated Builtins are now registered lazily via createDefaultNodeRegistry()
 */
export function registerBuiltinNodes() {
    // No-op: builtins are registered lazily when global registry is first accessed
}
/**
 * Create a new node registry pre-populated with builtin node definitions
 * This is the recommended way to create isolated registries for testing/replay
 */
export function createDefaultNodeRegistry() {
    const registry = new NodeRegistry();
    // Register all builtin nodes inline (no imports, no side effects)
    // Kept in sync with nodes.ts for backwards compatibility
    registry.register({ type: "PowerSource", update() { return { out: 1 }; } });
    registry.register({ type: "POWER", update() { return { out: 1 }; } });
    registry.register({
        type: "Wire",
        update(_node, inputs) { return { out: inputs["in"] ?? 0 }; },
    });
    registry.register({
        type: "Lamp",
        update(_node, inputs) { return { out: inputs["in"] ?? 0 }; },
    });
    registry.register({
        type: "LAMP",
        update(_node, inputs) { return { out: inputs["in"] ?? 0 }; },
    });
    registry.register({
        type: "Clock",
        update(_node, _inputs, _dt, tickIndex) {
            const phase = tickIndex % 4;
            return { out: phase < 2 ? 1 : 0 };
        },
    });
    registry.register({
        type: "Delay",
        update(node, inputs) {
            const steps = (node.config?.steps ?? 2) | 0;
            if (!node.state)
                node.state = new Array(steps).fill(0);
            const input = inputs["in"] ?? 0;
            const oldOutput = node.state[steps - 1];
            for (let i = steps - 1; i > 0; i--) {
                node.state[i] = node.state[i - 1];
            }
            node.state[0] = input;
            return { out: oldOutput };
        },
    });
    registry.register({
        type: "Switch",
        update(node) {
            const isOn = node.state?.isOn ?? 0;
            return { out: isOn };
        },
    });
    registry.register({
        type: "SWITCH",
        update(node) {
            const isOn = node.state?.isOn ?? 0;
            return { out: isOn };
        },
    });
    registry.register({
        type: "AND",
        update(_node, inputs) {
            const a = inputs["a"] ?? inputs["in1"] ?? 0;
            const b = inputs["b"] ?? inputs["in2"] ?? 0;
            return { out: (a && b ? 1 : 0) };
        },
    });
    registry.register({
        type: "OR",
        update(_node, inputs) {
            const a = inputs["a"] ?? inputs["in1"] ?? 0;
            const b = inputs["b"] ?? inputs["in2"] ?? 0;
            return { out: (a || b ? 1 : 0) };
        },
    });
    registry.register({
        type: "NOT",
        update(_node, inputs) {
            const input = inputs["in"] ?? 0;
            return { out: (input ? 0 : 1) };
        },
    });
    registry.register({
        type: "NAND",
        update(_node, inputs) {
            const a = inputs["a"] ?? inputs["in1"] ?? 0;
            const b = inputs["b"] ?? inputs["in2"] ?? 0;
            return { out: (a && b ? 0 : 1) };
        },
    });
    registry.register({
        type: "NOR",
        update(_node, inputs) {
            const a = inputs["a"] ?? inputs["in1"] ?? 0;
            const b = inputs["b"] ?? inputs["in2"] ?? 0;
            return { out: (a || b ? 0 : 1) };
        },
    });
    registry.register({
        type: "XOR",
        update(_node, inputs) {
            const a = inputs["a"] ?? inputs["in1"] ?? 0;
            const b = inputs["b"] ?? inputs["in2"] ?? 0;
            return { out: (a !== b ? 1 : 0) };
        },
    });
    registry.register({
        type: "XNOR",
        update(_node, inputs) {
            const a = inputs["a"] ?? inputs["in1"] ?? 0;
            const b = inputs["b"] ?? inputs["in2"] ?? 0;
            return { out: (a === b ? 1 : 0) };
        },
    });
    registry.register({
        type: "INPUT",
        update(node) {
            const isOn = node.state?.isOn ?? 0;
            return { out: isOn };
        },
    });
    registry.register({
        type: "OUTPUT",
        update(_node, inputs) {
            return { out: inputs["in"] ?? 0 };
        },
    });
    registry.register({
        type: "D_FLIP_FLOP",
        update(node, inputs) {
            const d = inputs["d"] ?? inputs["D"] ?? 0;
            const clk = inputs["clk"] ?? inputs["clock"] ?? inputs["CLK"] ?? 0;
            const prevClk = node.state?.prevClk ?? 0;
            if (clk === 1 && prevClk === 0) {
                node.state = { q: d, prevClk: clk };
                return { q: d, qBar: d ? 0 : 1 };
            }
            const q = node.state?.q ?? 0;
            node.state = { ...node.state, prevClk: clk };
            return { q, qBar: q ? 0 : 1 };
        },
    });
    return registry;
}
