// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SimulationProviderBar } from '../components/SimulationProviderBar';
import { importedVcdProvider } from '../simulationProvider';

const noop = () => {};
const runProvider = importedVcdProvider('run.vcd');

describe('SimulationProviderBar', () => {
  it('shows both providers with honest tiers; imported disabled without a waveform', () => {
    render(
      <SimulationProviderBar
        hasImportedWaveform={false}
        activeProvider="browser-logic"
        onSelectProvider={noop}
        nativeRunLabel="Run 3 · passing"
      />,
    );
    expect(screen.getByTestId('ide-sim-provider-browser-logic')).toBeTruthy();
    expect((screen.getByTestId('ide-sim-provider-imported-vcd') as HTMLButtonElement).disabled).toBe(true);
    // Active is Browser Logic, provenance is Browser-E0 and names the run.
    expect(screen.getByTestId('ide-sim-provider-active').textContent).toContain('Browser logic');
    const provenance = screen.getByTestId('ide-sim-provenance').textContent ?? '';
    expect(provenance).toContain('Browser E0');
    expect(provenance).toContain('not Vivado');
    expect(screen.getByTestId('ide-sim-provenance-run').textContent).toContain('Run 3');
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

  it('states the imported evidence tier honestly when active', () => {
    render(
      <SimulationProviderBar
        hasImportedWaveform
        importedProvider={runProvider}
        activeProvider="imported-vcd"
        onSelectProvider={noop}
      />,
    );
    expect(screen.getByTestId('ide-sim-provider-active').textContent).toContain('Imported waveform');
    const provenance = screen.getByTestId('ide-sim-provenance').textContent ?? '';
    expect(provenance).toContain('outside RedByte');
    expect(provenance).toContain('never executed');
  });
});
