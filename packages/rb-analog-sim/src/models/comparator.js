export function simulateComparator(node) {
    const vPlus = Number.isFinite(node.inputs.V_plus) ? node.inputs.V_plus : 0;
    const vMinus = Number.isFinite(node.inputs.V_minus) ? node.inputs.V_minus : 0;
    // Output is 1 if V_plus > V_minus, else 0
    node.outputs.out = vPlus > vMinus ? 1 : 0;
    return node;
}
