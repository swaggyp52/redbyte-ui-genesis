
import type { LabProject } from '@redbyte/rb-utils';

/**
 * Extracts a normalized 0 | 1 | undefined from the project for a given signal name.
 * Matches: Label -> ID
 */
export function getSignalValue(project: LabProject, signalName: string): boolean | undefined {
    if (!project || !signalName || !project.circuit) return undefined;

    // 1. Find node by Label or ID
    const node = project.circuit.nodes.find((n: any) => n.label === signalName || n.id === signalName);

    if (!node) return undefined;

    // 2. Extract specific output state
    // If component has explicit 'out' or 'Q', favor that.
    const state = node.state || {};

    if (state.output !== undefined) return state.output === 1 || state.output === true;
    if (state.out !== undefined) return state.out === 1 || state.out === true;
    if (state.Q !== undefined) return state.Q === 1 || state.Q === true;

    return undefined; // Unknown state
}

/**
 * Determines if a signal can be driven by a Board Switch/Button.
 * Rule: Must be a specific Input component type (SWITCH, CLOCK, INPUT)
 */
export function isInputCapableSignal(node: { type: string }): boolean {
    return ['SWITCH', 'CLOCK', 'INPUT'].includes(node.type);
}

/**
 * Determines if a signal can be observed by a Board LED.
 * Rule: Any node in the circuit is observable.
 */
export function isOutputCapableSignal(node: { type: string }): boolean {
    // In theory, any node is observable.
    // We might exclude purely visual nodes if they existed, but for now:
    return true;
}

/**
 * Filters available signals in the project into Inputs (for Switches) and Outputs (for LEDs).
 */
export function getAvailableSignals(project: LabProject) {
    if (!project || !project.circuit) return { inputs: [], outputs: [] };

    const inputs: Array<{ id: string; label: string; type: string }> = [];
    const outputs: Array<{ id: string; label: string; type: string }> = [];

    project.circuit.nodes.forEach(n => {
        const item = { id: n.id, label: n.label || n.id, type: n.type };

        if (isInputCapableSignal(n)) {
            inputs.push(item);
        }

        if (isOutputCapableSignal(n)) {
            outputs.push(item);
        }
    });

    return { inputs, outputs };
}
