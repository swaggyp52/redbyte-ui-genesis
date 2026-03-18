import { describe, expect, it } from 'vitest';
import { deriveVerifySchedule } from '../fpga/boards/basys3/verifySchedule';

describe('deriveVerifySchedule temporal guards', () => {
  it('does not over-classify combinational process blocks as sequential HDL', () => {
    const contract = deriveVerifySchedule(
      { nodes: [], connections: [] },
      undefined,
      {
        top: 'top',
        sources: [
          {
            path: 'top.vhd',
            language: 'vhdl',
            text: `
entity top is
  port (
    sw0 : in std_logic;
    sw1 : in std_logic;
    ld0 : out std_logic
  );
end entity;

architecture rtl of top is
begin
  process(sw0, sw1)
  begin
    ld0 <= sw0 and sw1;
  end process;
end architecture;
`,
          },
        ],
      }
    );

    expect(contract.schedule).toBe('combinational');
    expect(contract.reason).toBe('combinational');
    expect(contract.hasUnsupportedTemporal).toBe(false);
  });

  it('flags unsupported falling-edge HDL as a temporal preflight error', () => {
    const contract = deriveVerifySchedule(
      { nodes: [], connections: [] },
      undefined,
      {
        top: 'top',
        sources: [
          {
            path: 'top.vhd',
            language: 'vhdl',
            text: `
entity top is
  port (
    clk : in std_logic;
    q : out std_logic
  );
end entity;

architecture rtl of top is
begin
  process(clk)
  begin
    if falling_edge(clk) then
      q <= not q;
    end if;
  end process;
end architecture;
`,
          },
        ],
      }
    );

    expect(contract.schedule).toBe('clocked_macro');
    expect(contract.hasUnsupportedTemporal).toBe(true);
    expect(contract.temporalIssues.some((issue) => issue.code === 'unsupported-falling-edge')).toBe(true);
  });

  it('flags multi-clock sequential circuits as unsupported temporal topology', () => {
    const circuit = {
      nodes: [
        { id: 'clk_a', type: 'INPUT', label: 'clk_a', x: 0, y: 0, config: {}, state: {} },
        { id: 'clk_b', type: 'INPUT', label: 'clk_b', x: 0, y: 80, config: {}, state: {} },
        { id: 'ff_a', type: 'DFlipFlop', label: 'ff_a', x: 240, y: 0, config: {}, state: {} },
        { id: 'ff_b', type: 'DFlipFlop', label: 'ff_b', x: 240, y: 80, config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'clk_a', portName: 'out' }, to: { nodeId: 'ff_a', portName: 'CLK' } },
        { from: { nodeId: 'clk_b', portName: 'out' }, to: { nodeId: 'ff_b', portName: 'CLK' } },
      ],
    };

    const contract = deriveVerifySchedule(circuit, {
      inputs: [
        { id: 'clk_a', nodeId: 'clk_a', port: 'out', label: 'clk_a', pin: 'SW0' },
        { id: 'clk_b', nodeId: 'clk_b', port: 'out', label: 'clk_b', pin: 'SW1' },
      ],
      outputs: [],
    });

    expect(contract.schedule).toBe('clocked_macro');
    expect(contract.hasUnsupportedTemporal).toBe(true);
    expect(contract.temporalIssues.some((issue) => issue.code === 'multi-clock-domain')).toBe(true);
  });

  it('flags active-low reset naming as unsupported in sequential contract', () => {
    const circuit = {
      nodes: [
        { id: 'reset_n_node', type: 'INPUT', label: 'reset_n', x: 0, y: 0, config: {}, state: {} },
        { id: 'clk_node', type: 'INPUT', label: 'clk', x: 0, y: 80, config: {}, state: {} },
        { id: 'ff', type: 'DFlipFlop', label: 'ff', x: 220, y: 40, config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'clk_node', portName: 'out' }, to: { nodeId: 'ff', portName: 'CLK' } },
        { from: { nodeId: 'reset_n_node', portName: 'out' }, to: { nodeId: 'ff', portName: 'RST' } },
      ],
    };

    const contract = deriveVerifySchedule(circuit, {
      inputs: [
        { id: 'reset_n', nodeId: 'reset_n_node', port: 'out', label: 'reset_n', pin: 'SW0' },
        { id: 'clk', nodeId: 'clk_node', port: 'out', label: 'clk', pin: 'CLK100MHZ' },
      ],
      outputs: [],
    });

    expect(contract.schedule).toBe('clocked_macro');
    expect(contract.hasUnsupportedTemporal).toBe(true);
    expect(contract.temporalIssues.some((issue) => issue.code === 'active-low-reset')).toBe(true);
  });

  it('resolves clock structure from IR/model-backed bindings instead of raw clock-like labels', () => {
    const circuit = {
      nodes: [
        { id: 'data_node', type: 'INPUT', label: 'data_line', x: 0, y: 0, config: {}, state: {} },
        { id: 'sync_node', type: 'INPUT', label: 'sync_line', x: 0, y: 80, config: {}, state: {} },
        { id: 'ff_node', type: 'DFlipFlop', label: 'ff0', x: 220, y: 40, config: {}, state: {} },
        { id: 'q_node', type: 'OUTPUT', label: 'q', x: 420, y: 40, config: {}, state: {} },
      ],
      connections: [
        { from: { nodeId: 'data_node', portName: 'out' }, to: { nodeId: 'ff_node', portName: 'D' } },
        { from: { nodeId: 'sync_node', portName: 'out' }, to: { nodeId: 'ff_node', portName: 'CLK' } },
        { from: { nodeId: 'ff_node', portName: 'Q' }, to: { nodeId: 'q_node', portName: 'in' } },
      ],
    };

    const contract = deriveVerifySchedule(circuit, {
      inputs: [
        { id: 'd', nodeId: 'data_node', port: 'out', label: 'd', pin: 'SW0' },
        { id: 'clk', nodeId: 'sync_node', port: 'out', label: 'clk', pin: 'CLK100MHZ' },
      ],
      outputs: [{ id: 'q', nodeId: 'q_node', port: 'in', label: 'q', pin: 'LD0' }],
    });

    expect(contract.schedule).toBe('clocked_macro');
    expect(contract.needsSimClockInjection).toBe(false);
    expect(contract.clockSignalName).toBe('clk');
    expect(contract.hasUnsupportedTemporal).toBe(false);
  });
});
