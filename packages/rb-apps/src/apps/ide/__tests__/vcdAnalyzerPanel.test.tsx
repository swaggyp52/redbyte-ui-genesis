// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VcdAnalyzerPanel } from '../components/VcdAnalyzerPanel';
import { DEFAULT_VCD_ANALYZER_CONFIG } from '../vcdAnalyzer';
import { parseVcd } from '../vcdImport';
import { waveformFromVcd } from '../simulationProvider';

const VCD = [
  '$timescale 1ns $end',
  '$var wire 1 ! clk $end',
  '$var wire 4 # data $end',
  '$enddefinitions $end',
  '#0',
  '0!',
  'b0000 #',
  '#5',
  '1!',
  'b1010 #',
].join('\n');

const waveform = () => waveformFromVcd(parseVcd(VCD), 'run.vcd');

const noop = () => {};

describe('VcdAnalyzerPanel', () => {
  it('collapses to a compact affordance without a waveform (does not dominate a native project)', () => {
    render(
      <VcdAnalyzerPanel
        waveform={null}
        config={DEFAULT_VCD_ANALYZER_CONFIG}
        onImportVcd={noop}
        onConfigChange={noop}
        onClear={noop}
      />,
    );
    // Compact bar, not the full three-zone Analyzer or a giant empty card.
    expect(screen.getByTestId('ide-vcd-analyzer-compact')).toBeTruthy();
    expect(screen.queryByTestId('ide-vcd-analyzer-empty')).toBeNull();
    expect(screen.queryByTestId('ide-vcd-analyzer-signals')).toBeNull();
    // Still honest and still offers the load affordance.
    expect(screen.getByTestId('ide-vcd-analyzer-provider').textContent).toContain('Imported VCD');
    expect(screen.getByTestId('ide-vcd-analyzer-load')).toBeTruthy();
    expect(screen.getByTestId('ide-vcd-analyzer').textContent).toContain('never executed');
  });

  it('renders the three zones with honest evidence and measurements at the cursor', () => {
    render(
      <VcdAnalyzerPanel
        waveform={waveform()}
        config={{ ...DEFAULT_VCD_ANALYZER_CONFIG, cursorTime: 5 }}
        sourceName="run.vcd"
        onImportVcd={noop}
        onConfigChange={noop}
        onClear={noop}
      />,
    );
    // Evidence tier is stated honestly.
    expect(screen.getByTestId('ide-vcd-analyzer-evidence').textContent).toContain('outside RedByte');
    // Three zones present.
    expect(screen.getByTestId('ide-vcd-analyzer-signals')).toBeTruthy();
    expect(screen.getByTestId('ide-vcd-analyzer-waveform-zone')).toBeTruthy();
    expect(screen.getByTestId('ide-vcd-analyzer-measurements')).toBeTruthy();
    // Signal count.
    expect(screen.getByTestId('ide-vcd-analyzer-signal-count').textContent).toBe('2');
    // Measurement at t=5: data = b1010 → hex 0xA (width 4 default), clk = 1.
    expect(screen.getByTestId('ide-vcd-analyzer-measure-value-#').textContent).toBe('0xA');
    expect(screen.getByTestId('ide-vcd-analyzer-measure-value-!').textContent).toBe('1');
  });

  it('shows an error banner for a file with no signals', () => {
    const empty = waveformFromVcd(parseVcd('$enddefinitions $end'), 'empty.vcd');
    render(
      <VcdAnalyzerPanel
        waveform={empty}
        config={DEFAULT_VCD_ANALYZER_CONFIG}
        onImportVcd={noop}
        onConfigChange={noop}
        onClear={noop}
      />,
    );
    expect(screen.getByTestId('ide-vcd-analyzer-error')).toBeTruthy();
  });

  it('emits config patches for pin, radix, search, and cursor', () => {
    const onConfigChange = vi.fn();
    render(
      <VcdAnalyzerPanel
        waveform={waveform()}
        config={DEFAULT_VCD_ANALYZER_CONFIG}
        onImportVcd={noop}
        onConfigChange={onConfigChange}
        onClear={noop}
      />,
    );
    // Pin the data signal.
    fireEvent.click(screen.getByTestId('ide-vcd-analyzer-pin-#'));
    expect(onConfigChange).toHaveBeenCalledWith({ selectedKeys: ['#'] });

    // Change data radix to dec.
    fireEvent.change(screen.getByTestId('ide-vcd-analyzer-radix-#'), { target: { value: 'dec' } });
    expect(onConfigChange).toHaveBeenCalledWith({ radixByKey: { '#': 'dec' } });

    // Filter signals.
    fireEvent.change(screen.getByTestId('ide-vcd-analyzer-search'), { target: { value: 'clk' } });
    expect(onConfigChange).toHaveBeenCalledWith({ search: 'clk' });

    // Move the cursor.
    fireEvent.change(screen.getByTestId('ide-vcd-analyzer-cursor'), { target: { value: '5' } });
    expect(onConfigChange).toHaveBeenCalledWith({ cursorTime: 5 });
  });

  it('clears the waveform when Clear is pressed', () => {
    const onClear = vi.fn();
    render(
      <VcdAnalyzerPanel
        waveform={waveform()}
        config={DEFAULT_VCD_ANALYZER_CONFIG}
        onImportVcd={noop}
        onConfigChange={noop}
        onClear={onClear}
      />,
    );
    fireEvent.click(screen.getByTestId('ide-vcd-analyzer-clear'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
