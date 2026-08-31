// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectSourceFiles } from '../components/ProjectSourceFiles';
import { addSourceFile, createEmptyProjectSourceModel } from '../projectSourceModel';

function buildModel() {
  let model = createEmptyProjectSourceModel();
  model = addSourceFile(model, { path: 'rtl/top.vhd', text: 'entity top;' });
  model = addSourceFile(model, { path: 'rtl/helper.sv', text: 'module helper;' });
  model = addSourceFile(model, { path: 'sim/top_tb.vhd', text: '', fileset: 'simulation' });
  model = addSourceFile(model, { path: 'top.xdc', text: '' });
  model = addSourceFile(model, { path: 'build.tcl', text: '' });
  return { ...model, topEntity: 'top' };
}

describe('ProjectSourceFiles', () => {
  it('renders nothing for an empty source model', () => {
    const { container } = render(<ProjectSourceFiles sourceModel={createEmptyProjectSourceModel()} />);
    expect(container.firstChild).toBeNull();
  });

  it('lists files grouped by fileset with capability tiers and compile order', () => {
    render(<ProjectSourceFiles sourceModel={buildModel()} />);

    expect(screen.getByTestId('ide-project-sources-count').textContent).toBe('5 files');
    expect(screen.getByTestId('ide-project-sources-top').textContent).toContain('top');

    // fileset groups present
    expect(screen.getByTestId('ide-project-sources-group-design')).toBeTruthy();
    expect(screen.getByTestId('ide-project-sources-group-simulation')).toBeTruthy();
    expect(screen.getByTestId('ide-project-sources-group-constraint')).toBeTruthy();
    expect(screen.getByTestId('ide-project-sources-group-utility')).toBeTruthy();

    // capability tiers are honest: VHDL/SV reconstructable, XDC read-only, Tcl preserved
    expect(screen.getByTestId('ide-project-source-tier-src-rtl-top-vhd').textContent).toBe('reconstructable');
    expect(screen.getByTestId('ide-project-source-tier-src-rtl-helper-sv').textContent).toBe('reconstructable');
    expect(screen.getByTestId('ide-project-source-tier-src-top-xdc').textContent).toBe('read-only');
    expect(screen.getByTestId('ide-project-source-tier-src-build-tcl').textContent).toBe('preserved');

    // compile order: design + simulation only (xdc/tcl excluded), design first
    const order = screen.getByTestId('ide-project-sources-compile-order');
    const items = Array.from(order.querySelectorAll('li')).map((li) => li.textContent);
    expect(items.some((t) => t?.includes('rtl/top.vhd'))).toBe(true);
    expect(items.some((t) => t?.includes('sim/top_tb.vhd'))).toBe(true);
    expect(items.some((t) => t?.includes('top.xdc'))).toBe(false);
    expect(items.some((t) => t?.includes('build.tcl'))).toBe(false);
  });
});
