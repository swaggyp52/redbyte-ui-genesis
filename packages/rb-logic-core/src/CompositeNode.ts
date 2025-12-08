import type { Circuit, NodeBehavior, NodeInputs, NodeOutputs } from './types';
import { CircuitEngine } from './CircuitEngine';

/**
 * Composite node definition - a node that encapsulates a subcircuit
 */
export interface CompositeNodeDef {
  name: string;
  description?: string;
  subcircuit: Circuit;
  inputMapping: Record<string, string>; // external port -> internal nodeId.port
  outputMapping: Record<string, string>; // external port -> internal nodeId.port
}

/**
 * Creates a node behavior from a composite node definition
 */
export function createCompositeNodeBehavior(def: CompositeNodeDef): NodeBehavior {
  return {
    evaluate(inputs: NodeInputs, state: Record<string, any>): {
      outputs: NodeOutputs;
      state: Record<string, any>;
    } {
      // Create or retrieve subcircuit engine
      let engine: CircuitEngine = state.engine;
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
      const outputs: NodeOutputs = {};
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

export function registerCompositeNode(def: CompositeNodeDef): void {
  const behavior = createCompositeNodeBehavior(def);
  NodeRegistry.register(def.name, behavior);
}
