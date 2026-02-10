import type { CircuitNode, CircuitWire, CircuitDesignerDoc } from '../plugins/LabDoc';

/**
 * Evaluation result: Map of nodeId → output value (boolean)
 * Also includes optional error message for circuit validation issues
 */
export interface EvaluationResult {
  values: Map<string, boolean | undefined>;
  error?: string;
}

/**
 * Action types for Circuit Designer
 */
export type CircuitAction =
  | { type: 'ADD_NODE'; gateType: CircuitNode['type']; x: number; y: number }
  | { type: 'DELETE_NODE'; nodeId: string }
  | { type: 'MOVE_NODE'; nodeId: string; x: number; y: number }
  | { type: 'CONNECT_WIRE'; fromNodeId: string; fromPort: number; toNodeId: string; toPort: number }
  | { type: 'DELETE_WIRE'; wireId: string }
  | { type: 'SET_INPUT_VALUE'; nodeId: string; value: boolean }
  | { type: 'SELECT_NODE'; nodeId: string }
  | { type: 'DESELECT' }
  | { type: 'SET_VIEWPORT'; panX: number; panY: number; zoom: number };
