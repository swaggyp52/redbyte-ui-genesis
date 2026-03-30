import { describe, expect, it } from 'vitest';
import { isHdlProjectionScaffoldWarning } from '../fpga/boards/basys3/basys3ExportService';

describe('HDL projection scaffold warning filter', () => {
  it('matches known scaffold warning shapes', () => {
    const scaffoldWarnings = [
      'Node port_clk type "INPUT" not supported for synthesis',
      'Node port_led type "OUTPUT" not supported for synthesis',
      'Unsupported node: port_clk (INPUT)',
      'Unsupported node: port_led (OUTPUT)',
      'Output "port_out_q0_in" (id: port_out_q0) has no driver — will default to \"0\"',
      'Top output port "port_out_q0_in" has no driver — output will be tied low',
      'Top output port "port_out_q0_in" has unresolved driver helper_1.out',
      'HDL ports missing in XDC: ld0_node_in, sw0_node_out',
      'XDC ports missing in HDL: LD0, SW0',
    ];

    for (const warning of scaffoldWarnings) {
      expect(isHdlProjectionScaffoldWarning(warning)).toBe(true);
    }
  });

  it('does not match non-scaffold diagnostics', () => {
    const nonScaffoldDiagnostics = [
      'Floating output detected on node "ld0" (ld0). Fix: connect a single upstream driver before export.',
      'Sequential node "ff0" is missing a clock input. Fix: connect "ff0.clk" to a mapped clock source (for example clk -> CLK100MHZ / W5).',
      'Unmapped required output port "q2". Fix: map "q2" to "LD0 / U16".',
      'Questionable output mapping "q0" -> SW3: output is mapped to an input/clock alias.',
    ];

    for (const diagnostic of nonScaffoldDiagnostics) {
      expect(isHdlProjectionScaffoldWarning(diagnostic)).toBe(false);
    }
  });
});
