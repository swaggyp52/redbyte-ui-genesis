// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SimulationProviderBar } from '../components/SimulationProviderBar';
import { importedVcdProvider } from '../simulationProvider';

const noop = () => {};
const runProvider = importedVcdProvider('run.vcd');

describe('SimulationProviderBar', () => {
  // 232fe970a: with only RedByte's own simulator there is nothing to choose, so the bar renders
  // nothing; the Vivado/hardware boundary is stated once in Package, and imported-waveform honesty
  // ("replayed, never executed") in the VCD analyzer (vcdAnalyzerPanel.test).
  it('renders nothing while the RedByte simulator is the only source', () => {
    const { container } = render(
      <SimulationProviderBar
        hasImportedWaveform={false}
        activeProvider="browser-logic"
        onSelectProvider={noop}
        nativeRunLabel="Run 3 · passing"
      />,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('ide-sim-provider-bar')).toBeNull();
  });

  it('enables and selects the imported provider once a waveform is loaded', () => {
    const onSelectProvider = vi.fn();
    render(
      <SimulationProviderBar
        hasImportedWaveform
        importedProvider={runProvider}
        activeProvider="browser-logic"
        onSelectProvider={onSelectProvider}
      />,
    );
    const imported = screen.getByTestId('ide-sim-provider-imported-vcd') as HTMLButtonElement;
    expect(imported.disabled).toBe(false);
    fireEvent.click(imported);
    expect(onSelectProvider).toHaveBeenCalledWith('imported-vcd');
  });

  it('states each source\'s evidence tier and marks the active one', () => {
    render(
      <SimulationProviderBar
        hasImportedWaveform
        importedProvider={runProvider}
        activeProvider="imported-vcd"
        onSelectProvider={noop}
      />,
    );
    const imported = screen.getByTestId('ide-sim-provider-imported-vcd');
    const native = screen.getByTestId('ide-sim-provider-browser-logic');
    expect(imported.getAttribute('aria-checked')).toBe('true');
    expect(native.getAttribute('aria-checked')).toBe('false');
    expect(imported.getAttribute('title')).toContain('outside RedByte');
    expect(native.getAttribute('title')).toContain('Browser E0');
    expect(screen.getByRole('radiogroup', { name: 'Simulation source' })).toBeTruthy();
  });
});
