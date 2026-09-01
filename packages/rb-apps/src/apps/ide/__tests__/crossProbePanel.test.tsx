// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CrossProbePanel } from '../components/CrossProbePanel';
import { buildLiveCrossProbeIndex, type CrossProbeDesignModule } from '../crossProbeBuilder';
import { normalizeProjectSourceModel } from '../projectSourceModel';

const sourceModel = normalizeProjectSourceModel({
  files: [
    {
      path: 'rtl/adder.vhd',
      language: 'vhdl',
      fileset: 'design',
      text: ['entity adder is', '  port ( a : in std_logic; sum : out std_logic );', 'end adder;'].join('\n'),
    },
  ],
});

const adderId = sourceModel.files[0].id;

const modules: CrossProbeDesignModule[] = [
  { id: 'm_adder', name: 'adder', ports: [{ name: 'a', nodeId: 'n_a' }, { name: 'sum' }] },
  { id: 'm_native', name: 'native_only', ports: [{ name: 'z' }] },
];

const index = buildLiveCrossProbeIndex({ modules, sourceModel });
const sourceLabels = { [adderId]: 'rtl/adder.vhd' };

describe('CrossProbePanel', () => {
  it('carries link quality on the row, not a permanent legend key', () => {
    render(<CrossProbePanel modules={modules} index={index} sourceLabels={sourceLabels} />);
    // The always-on legend was removed; quality lives on the relationship row.
    expect(screen.queryByTestId('ide-crossprobe-legend')).toBeNull();
    const moduleQuality = screen.getByTestId('ide-crossprobe-quality-module:m_adder:adder');
    expect(moduleQuality.textContent).toBe('Exact');
    // The meaning travels with the badge as a tooltip so no legend is needed.
    expect(moduleQuality.getAttribute('title')).toMatch(/full confidence/i);
  });

  it('shows the module with an exact link and a native-only element as unavailable', () => {
    render(<CrossProbePanel modules={modules} index={index} sourceLabels={sourceLabels} />);
    const moduleQuality = screen.getByTestId('ide-crossprobe-quality-module:m_adder:adder');
    expect(moduleQuality.textContent).toBe('Exact');
    const nativeQuality = screen.getByTestId('ide-crossprobe-quality-module:m_native:native_only');
    expect(nativeQuality.textContent).toBe('Unavailable');
    const nativeRow = screen.getByTestId('ide-crossprobe-design-module:m_native:native_only');
    expect(nativeRow.textContent).toContain('native only');
  });

  it('lists the source pane links back to the design', () => {
    render(<CrossProbePanel modules={modules} index={index} sourceLabels={sourceLabels} />);
    expect(screen.getByTestId(`ide-crossprobe-source-${adderId}`)).toBeTruthy();
    // The port 'a' link appears in the source pane.
    expect(screen.getByTestId('ide-crossprobe-link-port:m_adder:a')).toBeTruthy();
  });

  it('selecting a design element highlights the matching source link (bidirectional)', () => {
    render(<CrossProbePanel modules={modules} index={index} sourceLabels={sourceLabels} />);
    const designRow = screen.getByTestId('ide-crossprobe-design-port:m_adder:a');
    fireEvent.click(designRow.querySelector('button')!);
    // Both the design row and the source link now carry the selected class.
    expect(designRow.className).toContain('is-selected');
    expect(screen.getByTestId('ide-crossprobe-link-port:m_adder:a').className).toContain('is-selected');
    expect(screen.getByTestId('ide-crossprobe-selection').textContent).toContain('a');
  });

  it('selecting from the source side highlights the design row', () => {
    render(<CrossProbePanel modules={modules} index={index} sourceLabels={sourceLabels} />);
    const sourceLink = screen.getByTestId('ide-crossprobe-link-module:m_adder:adder');
    fireEvent.click(sourceLink.querySelector('button')!);
    expect(screen.getByTestId('ide-crossprobe-design-module:m_adder:adder').className).toContain('is-selected');
  });
});
