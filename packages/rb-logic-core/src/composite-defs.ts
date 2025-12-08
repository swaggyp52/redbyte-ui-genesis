import type { CompositeNodeDef } from './CompositeNode';

/**
 * RS Latch (Reset-Set Latch)
 * Inputs: R (reset), S (set)
 * Outputs: Q, Q_inv
 */
export const RSLatchDef: CompositeNodeDef = {
  name: 'RSLatch',
  description: 'Reset-Set Latch - basic memory element',
  subcircuit: {
    nodes: [
      // Input switches
      { id: 'r_in', type: 'Switch', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: { isOn: 0 } },
      { id: 's_in', type: 'Switch', position: { x: 0, y: 2 }, rotation: 0, config: {}, state: { isOn: 0 } },

      // NOR gates forming the latch
      { id: 'nor1', type: 'NAND', position: { x: 2, y: 0 }, rotation: 0, config: {} },
      { id: 'nor2', type: 'NAND', position: { x: 2, y: 2 }, rotation: 0, config: {} },
    ],
    connections: [
      // R connects to first NOR
      { from: { nodeId: 'r_in', portName: 'out' }, to: { nodeId: 'nor1', portName: 'a' } },
      // S connects to second NOR
      { from: { nodeId: 's_in', portName: 'out' }, to: { nodeId: 'nor2', portName: 'a' } },
      // Cross-coupled feedback
      { from: { nodeId: 'nor1', portName: 'out' }, to: { nodeId: 'nor2', portName: 'b' } },
      { from: { nodeId: 'nor2', portName: 'out' }, to: { nodeId: 'nor1', portName: 'b' } },
    ],
  },
  inputMapping: {
    R: 'r_in.isOn',
    S: 's_in.isOn',
  },
  outputMapping: {
    Q: 'nor2.out',
    Q_inv: 'nor1.out',
  },
};

/**
 * D Flip-Flop
 * Inputs: D (data), CLK (clock)
 * Outputs: Q, Q_inv
 */
export const DFlipFlopDef: CompositeNodeDef = {
  name: 'DFlipFlop',
  description: 'D Flip-Flop - data storage triggered on clock edge',
  subcircuit: {
    nodes: [
      // Inputs
      { id: 'd_in', type: 'Switch', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: { isOn: 0 } },
      { id: 'clk_in', type: 'Switch', position: { x: 0, y: 2 }, rotation: 0, config: {}, state: { isOn: 0 } },

      // NOT for D_inv
      { id: 'not1', type: 'NOT', position: { x: 1, y: 1 }, rotation: 0, config: {} },

      // AND gates for gating
      { id: 'and1', type: 'AND', position: { x: 2, y: 0 }, rotation: 0, config: {} },
      { id: 'and2', type: 'AND', position: { x: 2, y: 2 }, rotation: 0, config: {} },

      // NAND latch
      { id: 'nand1', type: 'NAND', position: { x: 4, y: 0 }, rotation: 0, config: {} },
      { id: 'nand2', type: 'NAND', position: { x: 4, y: 2 }, rotation: 0, config: {} },
    ],
    connections: [
      // D and CLK to AND gates
      { from: { nodeId: 'd_in', portName: 'out' }, to: { nodeId: 'and1', portName: 'a' } },
      { from: { nodeId: 'd_in', portName: 'out' }, to: { nodeId: 'not1', portName: 'in' } },
      { from: { nodeId: 'not1', portName: 'out' }, to: { nodeId: 'and2', portName: 'a' } },
      { from: { nodeId: 'clk_in', portName: 'out' }, to: { nodeId: 'and1', portName: 'b' } },
      { from: { nodeId: 'clk_in', portName: 'out' }, to: { nodeId: 'and2', portName: 'b' } },

      // AND outputs to NAND latch
      { from: { nodeId: 'and1', portName: 'out' }, to: { nodeId: 'nand1', portName: 'a' } },
      { from: { nodeId: 'and2', portName: 'out' }, to: { nodeId: 'nand2', portName: 'a' } },

      // Cross-coupled NAND
      { from: { nodeId: 'nand1', portName: 'out' }, to: { nodeId: 'nand2', portName: 'b' } },
      { from: { nodeId: 'nand2', portName: 'out' }, to: { nodeId: 'nand1', portName: 'b' } },
    ],
  },
  inputMapping: {
    D: 'd_in.isOn',
    CLK: 'clk_in.isOn',
  },
  outputMapping: {
    Q: 'nand1.out',
    Q_inv: 'nand2.out',
  },
};

/**
 * JK Flip-Flop
 * Inputs: J, K, CLK
 * Outputs: Q, Q_inv
 */
export const JKFlipFlopDef: CompositeNodeDef = {
  name: 'JKFlipFlop',
  description: 'JK Flip-Flop - versatile flip-flop with toggle capability',
  subcircuit: {
    nodes: [
      // Inputs
      { id: 'j_in', type: 'Switch', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: { isOn: 0 } },
      { id: 'k_in', type: 'Switch', position: { x: 0, y: 1 }, rotation: 0, config: {}, state: { isOn: 0 } },
      { id: 'clk_in', type: 'Switch', position: { x: 0, y: 2 }, rotation: 0, config: {}, state: { isOn: 0 } },

      // AND gates
      { id: 'and1', type: 'AND', position: { x: 2, y: 0 }, rotation: 0, config: {} },
      { id: 'and2', type: 'AND', position: { x: 2, y: 2 }, rotation: 0, config: {} },

      // NAND latch
      { id: 'nand1', type: 'NAND', position: { x: 4, y: 0 }, rotation: 0, config: {} },
      { id: 'nand2', type: 'NAND', position: { x: 4, y: 2 }, rotation: 0, config: {} },
    ],
    connections: [
      // J and CLK to AND1
      { from: { nodeId: 'j_in', portName: 'out' }, to: { nodeId: 'and1', portName: 'a' } },
      { from: { nodeId: 'clk_in', portName: 'out' }, to: { nodeId: 'and1', portName: 'b' } },

      // K and CLK to AND2
      { from: { nodeId: 'k_in', portName: 'out' }, to: { nodeId: 'and2', portName: 'a' } },
      { from: { nodeId: 'clk_in', portName: 'out' }, to: { nodeId: 'and2', portName: 'b' } },

      // AND outputs to NAND latch
      { from: { nodeId: 'and1', portName: 'out' }, to: { nodeId: 'nand1', portName: 'a' } },
      { from: { nodeId: 'and2', portName: 'out' }, to: { nodeId: 'nand2', portName: 'a' } },

      // Cross-coupled feedback
      { from: { nodeId: 'nand1', portName: 'out' }, to: { nodeId: 'nand2', portName: 'b' } },
      { from: { nodeId: 'nand2', portName: 'out' }, to: { nodeId: 'nand1', portName: 'b' } },
    ],
  },
  inputMapping: {
    J: 'j_in.isOn',
    K: 'k_in.isOn',
    CLK: 'clk_in.isOn',
  },
  outputMapping: {
    Q: 'nand1.out',
    Q_inv: 'nand2.out',
  },
};

/**
 * 1-bit Full Adder
 * Inputs: A, B, Cin (carry in)
 * Outputs: Sum, Cout (carry out)
 */
export const FullAdderDef: CompositeNodeDef = {
  name: 'FullAdder',
  description: '1-bit Full Adder',
  subcircuit: {
    nodes: [
      // Inputs
      { id: 'a_in', type: 'Switch', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: { isOn: 0 } },
      { id: 'b_in', type: 'Switch', position: { x: 0, y: 1 }, rotation: 0, config: {}, state: { isOn: 0 } },
      { id: 'cin_in', type: 'Switch', position: { x: 0, y: 2 }, rotation: 0, config: {}, state: { isOn: 0 } },

      // XOR gates for sum
      { id: 'xor1', type: 'XOR', position: { x: 2, y: 0 }, rotation: 0, config: {} },
      { id: 'xor2', type: 'XOR', position: { x: 4, y: 0 }, rotation: 0, config: {} },

      // AND gates for carry
      { id: 'and1', type: 'AND', position: { x: 2, y: 2 }, rotation: 0, config: {} },
      { id: 'and2', type: 'AND', position: { x: 4, y: 2 }, rotation: 0, config: {} },

      // OR for final carry
      { id: 'or1', type: 'OR', position: { x: 6, y: 2 }, rotation: 0, config: {} },
    ],
    connections: [
      // Sum calculation: A XOR B XOR Cin
      { from: { nodeId: 'a_in', portName: 'out' }, to: { nodeId: 'xor1', portName: 'a' } },
      { from: { nodeId: 'b_in', portName: 'out' }, to: { nodeId: 'xor1', portName: 'b' } },
      { from: { nodeId: 'xor1', portName: 'out' }, to: { nodeId: 'xor2', portName: 'a' } },
      { from: { nodeId: 'cin_in', portName: 'out' }, to: { nodeId: 'xor2', portName: 'b' } },

      // Carry calculation: (A AND B) OR (Cin AND (A XOR B))
      { from: { nodeId: 'a_in', portName: 'out' }, to: { nodeId: 'and1', portName: 'a' } },
      { from: { nodeId: 'b_in', portName: 'out' }, to: { nodeId: 'and1', portName: 'b' } },
      { from: { nodeId: 'cin_in', portName: 'out' }, to: { nodeId: 'and2', portName: 'a' } },
      { from: { nodeId: 'xor1', portName: 'out' }, to: { nodeId: 'and2', portName: 'b' } },
      { from: { nodeId: 'and1', portName: 'out' }, to: { nodeId: 'or1', portName: 'a' } },
      { from: { nodeId: 'and2', portName: 'out' }, to: { nodeId: 'or1', portName: 'b' } },
    ],
  },
  inputMapping: {
    A: 'a_in.isOn',
    B: 'b_in.isOn',
    Cin: 'cin_in.isOn',
  },
  outputMapping: {
    Sum: 'xor2.out',
    Cout: 'or1.out',
  },
};

/**
 * 4-bit Counter (simplified version using clock)
 * Inputs: CLK, RESET
 * Outputs: Q0, Q1, Q2, Q3
 */
export const Counter4BitDef: CompositeNodeDef = {
  name: 'Counter4Bit',
  description: '4-bit binary counter',
  subcircuit: {
    nodes: [
      // Clock input
      { id: 'clk_in', type: 'Switch', position: { x: 0, y: 0 }, rotation: 0, config: {}, state: { isOn: 0 } },

      // 4 output bits (simplified - in real implementation these would be flip-flops)
      { id: 'q0', type: 'Switch', position: { x: 2, y: 0 }, rotation: 0, config: {}, state: { isOn: 0 } },
      { id: 'q1', type: 'Switch', position: { x: 4, y: 0 }, rotation: 0, config: {}, state: { isOn: 0 } },
      { id: 'q2', type: 'Switch', position: { x: 6, y: 0 }, rotation: 0, config: {}, state: { isOn: 0 } },
      { id: 'q3', type: 'Switch', position: { x: 8, y: 0 }, rotation: 0, config: {}, state: { isOn: 0 } },
    ],
    connections: [],
  },
  inputMapping: {
    CLK: 'clk_in.isOn',
  },
  outputMapping: {
    Q0: 'q0.out',
    Q1: 'q1.out',
    Q2: 'q2.out',
    Q3: 'q3.out',
  },
};
