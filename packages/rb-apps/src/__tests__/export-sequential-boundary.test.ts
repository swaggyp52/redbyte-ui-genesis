import { describe, expect, it } from 'vitest';
import { exportProjectAsBasys3 } from '../fpga/boards/basys3/basys3ExportService';
import type { RBProject } from '../export/projectFormat';

/**
 * Export sequential boundary enforcement tests.
 *
 * These verify that the export path blocks on the same unsupported sequential
 * patterns that Verify blocks on (falling-edge, active-low reset naming).
 * Multi-clock and NOT-gate reset blocking were already enforced; these tests
 * cover the two gaps closed in P1.
 */
describe('export sequential boundary enforcement', () => {
  it('blocks export when HDL contains falling_edge()', () => {
    const project: RBProject = {
      name: 'falling-edge-test',
      circuit: {
        nodes: [
          { id: 'sw0', type: 'Switch', label: 'sw0', x: 0, y: 0, config: {}, state: { isOn: 0 } },
          { id: 'led0', type: 'LED', label: 'led0', x: 200, y: 0, config: {}, state: {} },
        ],
        connections: [
          { id: 'c1', from: { nodeId: 'sw0', portName: 'out' }, to: { nodeId: 'led0', portName: 'in' } },
        ],
      },
      ioMapping: {
        inputs: [{ id: 'sw0', nodeId: 'sw0', port: 'out', label: 'sw0', pin: 'SW0' }],
        outputs: [{ id: 'led0', nodeId: 'led0', port: 'in', label: 'led0', pin: 'LD0' }],
      },
      hdl: {
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
      },
    };

    const result = exportProjectAsBasys3(project);
    const fallingEdgeErrors = result.errors.filter((e) =>
      e.message.includes('falling_edge')
    );
    expect(fallingEdgeErrors.length).toBeGreaterThan(0);
    expect(fallingEdgeErrors[0]!.severity).toBe('error');
  });

  it('blocks export when reset signal uses active-low naming convention', () => {
    const project: RBProject = {
      name: 'active-low-reset-test',
      circuit: {
        nodes: [
          { id: 'rst_n', type: 'Switch', label: 'reset_n', x: 0, y: 0, config: {}, state: { isOn: 0 } },
          { id: 'clk_node', type: 'Clock', label: 'clk', x: 0, y: 80, config: { period: 10 }, state: {} },
          { id: 'ff', type: 'DFlipFlop', label: 'ff', x: 220, y: 40, config: {}, state: {} },
          { id: 'led0', type: 'LED', label: 'led0', x: 400, y: 40, config: {}, state: {} },
          { id: 'd_in', type: 'Switch', label: 'd', x: 0, y: 160, config: {}, state: { isOn: 0 } },
        ],
        connections: [
          { id: 'c1', from: { nodeId: 'clk_node', portName: 'out' }, to: { nodeId: 'ff', portName: 'CLK' } },
          { id: 'c2', from: { nodeId: 'rst_n', portName: 'out' }, to: { nodeId: 'ff', portName: 'RST' } },
          { id: 'c3', from: { nodeId: 'ff', portName: 'Q' }, to: { nodeId: 'led0', portName: 'in' } },
          { id: 'c4', from: { nodeId: 'd_in', portName: 'out' }, to: { nodeId: 'ff', portName: 'D' } },
        ],
      },
      ioMapping: {
        inputs: [
          { id: 'rst_n', nodeId: 'rst_n', port: 'out', label: 'reset_n', pin: 'SW0' },
          { id: 'clk', nodeId: 'clk_node', port: 'out', label: 'clk', pin: 'CLK100MHZ' },
          { id: 'd', nodeId: 'd_in', port: 'out', label: 'd', pin: 'SW1' },
        ],
        outputs: [{ id: 'led0', nodeId: 'led0', port: 'in', label: 'led0', pin: 'LD0' }],
      },
    };

    const result = exportProjectAsBasys3(project);
    const activeLowErrors = result.errors.filter((e) =>
      e.message.includes('active-low reset')
    );
    expect(activeLowErrors.length).toBeGreaterThan(0);
    expect(activeLowErrors[0]!.severity).toBe('error');
  });

  it('allows export for supported rising-edge single-clock circuit', () => {
    const project: RBProject = {
      name: 'rising-edge-ok-test',
      circuit: {
        nodes: [
          { id: 'rst_node', type: 'Switch', label: 'rst', x: 0, y: 0, config: {}, state: { isOn: 0 } },
          { id: 'clk_node', type: 'Clock', label: 'clk', x: 0, y: 80, config: { period: 10 }, state: {} },
          { id: 'ff', type: 'DFlipFlop', label: 'ff', x: 220, y: 40, config: {}, state: {} },
          { id: 'led0', type: 'LED', label: 'led0', x: 400, y: 40, config: {}, state: {} },
          { id: 'd_in', type: 'Switch', label: 'd', x: 0, y: 160, config: {}, state: { isOn: 0 } },
        ],
        connections: [
          { id: 'c1', from: { nodeId: 'clk_node', portName: 'out' }, to: { nodeId: 'ff', portName: 'CLK' } },
          { id: 'c2', from: { nodeId: 'rst_node', portName: 'out' }, to: { nodeId: 'ff', portName: 'RST' } },
          { id: 'c3', from: { nodeId: 'ff', portName: 'Q' }, to: { nodeId: 'led0', portName: 'in' } },
          { id: 'c4', from: { nodeId: 'd_in', portName: 'out' }, to: { nodeId: 'ff', portName: 'D' } },
        ],
      },
      ioMapping: {
        inputs: [
          { id: 'rst', nodeId: 'rst_node', port: 'out', label: 'rst', pin: 'SW0' },
          { id: 'clk', nodeId: 'clk_node', port: 'out', label: 'clk', pin: 'CLK100MHZ' },
          { id: 'd', nodeId: 'd_in', port: 'out', label: 'd', pin: 'SW1' },
        ],
        outputs: [{ id: 'led0', nodeId: 'led0', port: 'in', label: 'led0', pin: 'LD0' }],
      },
    };

    const result = exportProjectAsBasys3(project);
    const sequentialBoundaryErrors = result.errors.filter((e) =>
      e.message.includes('falling_edge') ||
      e.message.includes('active-low reset') ||
      e.message.includes('Multiple clock domains')
    );
    expect(sequentialBoundaryErrors).toEqual([]);
  });

  it('blocks export when source constraints request create_generated_clock', () => {
    const project: RBProject = {
      name: 'generated-clock-xdc-test',
      circuit: {
        nodes: [
          { id: 'rst_node', type: 'Switch', label: 'rst', x: 0, y: 0, config: {}, state: { isOn: 0 } },
          { id: 'clk_node', type: 'Clock', label: 'clk', x: 0, y: 80, config: { period: 10 }, state: {} },
          { id: 'ff', type: 'DFlipFlop', label: 'ff', x: 220, y: 40, config: {}, state: {} },
          { id: 'led0', type: 'LED', label: 'led0', x: 400, y: 40, config: {}, state: {} },
          { id: 'd_in', type: 'Switch', label: 'd', x: 0, y: 160, config: {}, state: { isOn: 0 } },
        ],
        connections: [
          { id: 'c1', from: { nodeId: 'clk_node', portName: 'out' }, to: { nodeId: 'ff', portName: 'CLK' } },
          { id: 'c2', from: { nodeId: 'rst_node', portName: 'out' }, to: { nodeId: 'ff', portName: 'RST' } },
          { id: 'c3', from: { nodeId: 'ff', portName: 'Q' }, to: { nodeId: 'led0', portName: 'in' } },
          { id: 'c4', from: { nodeId: 'd_in', portName: 'out' }, to: { nodeId: 'ff', portName: 'D' } },
        ],
      },
      ioMapping: {
        inputs: [
          { id: 'rst', nodeId: 'rst_node', port: 'out', label: 'rst', pin: 'SW0' },
          { id: 'clk', nodeId: 'clk_node', port: 'out', label: 'clk', pin: 'CLK100MHZ' },
          { id: 'd', nodeId: 'd_in', port: 'out', label: 'd', pin: 'SW1' },
        ],
        outputs: [{ id: 'led0', nodeId: 'led0', port: 'in', label: 'led0', pin: 'LD0' }],
      },
      fpga: {
        board: 'basys3',
        top: 'top',
        constraints: {
          text: 'create_generated_clock -name div2_clk -source [get_ports {clk}] [get_pins {u_div/Q}]',
        },
      },
    };

    const result = exportProjectAsBasys3(project);
    const generatedClockErrors = result.errors.filter((e) =>
      e.message.includes('create_generated_clock')
    );
    expect(generatedClockErrors.length).toBeGreaterThan(0);
    expect(generatedClockErrors[0]!.severity).toBe('error');
  });
});
