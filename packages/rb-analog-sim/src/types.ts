// Analog simulation types for @redbyte/rb-analog-sim

export interface AnalogNode {
  id: string;
  type: string;
  inputs: Record<string, number>;
  outputs: Record<string, number>;
  state?: Record<string, any>;
  config?: Record<string, any>;
}

export interface ComparatorNode extends AnalogNode {
  type: 'LM358';
  inputs: {
    V_plus: number;
    V_minus: number;
  };
  outputs: {
    out: number;
  };
}

export interface LdrNode extends AnalogNode {
  type: 'LDR';
  inputs: {
    light: number; // 0..1 (normalized light level)
    v_in: number;
  };
  outputs: {
    resistance: number;
    v_out: number;
  };
}

export interface VoltageDividerNode extends AnalogNode {
  type: 'VoltageDivider';
  inputs: {
    v_in: number;
    r1: number;
    r2: number;
  };
  outputs: {
    v_out: number;
  };
}

export interface VoltageSourceNode extends AnalogNode {
  type: 'VoltageSource';
  inputs: Record<string, number>;
  outputs: {
    out: number;
  };
}
