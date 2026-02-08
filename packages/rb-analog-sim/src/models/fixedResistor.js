export function simulateFixedResistor(node) {
    // Output the configured resistance value
    const raw = node.config?.resistance;
    const resistance = typeof raw === 'number' && Number.isFinite(raw) ? raw : 10000;
    node.outputs = { resistance };
    return node;
}
