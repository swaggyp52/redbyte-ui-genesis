// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ConstraintSetsPanel } from '../components/ConstraintSetsPanel';
import { addConstraintSet, createEmptyConstraintSets } from '../constraintSets';

const noop = () => {};

const docWithTwo = () => {
  let doc = createEmptyConstraintSets();
  doc = addConstraintSet(doc, 'Basys3', 'set_property PACKAGE_PIN V17 [get_ports a]\nset_property PACKAGE_PIN V16 [get_ports b]');
  doc = addConstraintSet(doc, 'Variant', 'set_property PACKAGE_PIN W17 [get_ports a]');
  return doc;
};

describe('ConstraintSetsPanel', () => {
  it('shows the empty state and disables capture without live XDC', () => {
    render(
      <ConstraintSetsPanel doc={createEmptyConstraintSets()} onAdd={noop} onRemove={noop} onRename={noop} onSetActive={noop} />,
    );
    expect(screen.getByTestId('ide-constraint-sets-empty')).toBeTruthy();
    expect((screen.getByTestId('ide-constraint-sets-add') as HTMLButtonElement).disabled).toBe(true);
  });

  it('lists sets with the active tag and parsed pin counts', () => {
    const doc = docWithTwo();
    render(<ConstraintSetsPanel doc={doc} onAdd={noop} onRemove={noop} onRename={noop} onSetActive={noop} />);
    expect(screen.getByTestId('ide-constraint-sets-count').textContent).toBe('2 sets');
    // First added is active.
    const activeId = doc.activeId!;
    expect(screen.getByTestId(`ide-constraint-set-active-${activeId}`)).toBeTruthy();
    expect(screen.getByTestId(`ide-constraint-set-pins-${activeId}`).textContent).toBe('2 pins');
  });

  it('captures the current pins as a set with the typed name', () => {
    const onAdd = vi.fn(() => ({ ok: true }));
    render(
      <ConstraintSetsPanel
        doc={createEmptyConstraintSets()}
        liveXdcText="set_property PACKAGE_PIN V17 [get_ports a]"
        onAdd={onAdd}
        onRemove={noop}
        onRename={noop}
        onSetActive={noop}
      />,
    );
    fireEvent.change(screen.getByTestId('ide-constraint-sets-add-name'), { target: { value: 'My set' } });
    fireEvent.click(screen.getByTestId('ide-constraint-sets-add'));
    expect(onAdd).toHaveBeenCalledWith('My set', 'set_property PACKAGE_PIN V17 [get_ports a]');
  });

  it('activates and removes a set', () => {
    const onSetActive = vi.fn();
    const onRemove = vi.fn();
    const doc = docWithTwo();
    const variantId = doc.sets.find((s) => s.name === 'Variant')!.id;
    render(<ConstraintSetsPanel doc={doc} onAdd={noop} onRemove={onRemove} onRename={noop} onSetActive={onSetActive} />);
    fireEvent.click(screen.getByTestId(`ide-constraint-set-activate-${variantId}`));
    expect(onSetActive).toHaveBeenCalledWith(variantId);
    fireEvent.click(screen.getByTestId(`ide-constraint-set-remove-${variantId}`));
    expect(onRemove).toHaveBeenCalledWith(variantId);
  });

  it('surfaces an add error from the store', () => {
    const onAdd = vi.fn(() => ({ ok: false, error: 'Duplicate constraint set "Basys3"' }));
    render(
      <ConstraintSetsPanel
        doc={createEmptyConstraintSets()}
        liveXdcText="x"
        onAdd={onAdd}
        onRemove={noop}
        onRename={noop}
        onSetActive={noop}
      />,
    );
    fireEvent.change(screen.getByTestId('ide-constraint-sets-add-name'), { target: { value: 'Basys3' } });
    fireEvent.click(screen.getByTestId('ide-constraint-sets-add'));
    expect(screen.getByTestId('ide-constraint-sets-error').textContent).toContain('Duplicate');
  });
});
