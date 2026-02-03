export function simulateVoltageSource(node) {
    const configVoltage = node.config?.voltage;
    const stateVoltage = node.state?.voltage;
    const voltage = typeof configVoltage === 'number' && Number.isFinite(configVoltage)
        ? configVoltage
        : typeof stateVoltage === 'number' && Number.isFinite(stateVoltage)
            ? stateVoltage
            : 5;
    node.outputs.out = voltage;
    return node;
}
