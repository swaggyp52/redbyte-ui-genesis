// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VcdWaveformView } from '../components/VcdWaveformView';
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

describe('VcdWaveformView', () => {
  it('renders nothing without a waveform', () => {
    const { container } = render(<VcdWaveformView waveform={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the honest evidence caption, signals, and value changes', () => {
    const waveform = waveformFromVcd(parseVcd(VCD), 'run.vcd');
    render(<VcdWaveformView waveform={waveform} />);

    expect(screen.getByTestId('ide-vcd-signal-count').textContent).toContain('2 signals');
    // Evidence tier is stated honestly (generated outside RedByte).
    expect(screen.getByTestId('ide-vcd-evidence').textContent).toContain('outside RedByte');
    // Both signals rendered
    expect(screen.getByTestId('ide-vcd-signal-!')).toBeTruthy();
    const data = screen.getByTestId('ide-vcd-signal-#');
    expect(data.textContent).toContain('data');
    expect(data.textContent).toContain('[4]'); // width
    expect(data.textContent).toContain('b1010'); // a value change
  });
});
