// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { TestbenchDocumentTabs } from '../surfaces/verify/TestbenchDocumentTabs';
import { VerifyContextHeader } from '../surfaces/verify/VerifySurfacePrimitives';
import type { VerifyScenario } from '../verifyScenario';

afterEach(cleanup);

const SCENARIOS: VerifyScenario[] = [
  {
    id: 'half-adder',
    name: 'Half Adder Cases',
    version: 2,
    vectors: [],
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
  },
  {
    id: 'edge-cases',
    name: 'Edge Cases',
    version: 1,
    vectors: [],
    createdAt: '2026-07-14T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
  },
];

describe('Testbench-first Verify contracts', () => {
  it('names the student task directly and keeps session context visible without details', () => {
    const { getByRole, getByTestId, container } = render(
      <VerifyContextHeader
        projectName="Half Adder"
        stateLabel="Stale"
        stateTone="stale"
        scenarioName="Half Adder Cases"
      />
    );

    expect(getByRole('heading', { name: 'Simulation Studio' })).toBeTruthy();
    expect(getByTestId('ide-verify-context-project').textContent).toBe('Half Adder');
    expect(getByTestId('ide-verify-context-state').textContent).toContain('Stale');
    expect(getByTestId('ide-verify-context-scenario').textContent).toContain('Half Adder Cases');
    expect(container.querySelector('[data-testid="ide-verify-context-mode"]')).toBeNull();
    expect(container.querySelector('[data-testid="ide-verify-context-next"]')).toBeNull();
    expect(container.querySelector('details')).toBeNull();
    expect(container.querySelector('summary')).toBeNull();
  });

  it('renders scenarios as explicit tabs with secondary lifecycle actions grouped', () => {
    const onSwitch = vi.fn();
    const onCreate = vi.fn();
    const onDuplicate = vi.fn();
    const onRename = vi.fn();
    const onDelete = vi.fn();
    const view = render(
      <TestbenchDocumentTabs
        scenarios={SCENARIOS}
        activeScenarioId="half-adder"
        onSwitch={onSwitch}
        onCreate={onCreate}
        onDuplicate={onDuplicate}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    const tablist = view.getByRole('tablist', { name: 'Open testbenches' });
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    fireEvent.click(tabs[1]);
    expect(onSwitch).toHaveBeenCalledWith('edge-cases');

    fireEvent.click(view.getByTestId('ide-scenario-create-btn'));
    fireEvent.click(view.getByText('Manage testbench'));
    fireEvent.click(view.getByTestId('ide-scenario-duplicate-btn'));
    expect(onCreate).toHaveBeenCalledOnce();
    expect(onDuplicate).toHaveBeenCalledOnce();
    expect(view.container.querySelector('details')).toBeTruthy();
    expect(view.getByText('Manage testbench')).toBeTruthy();
  });

  it('renames and delete-confirms the active testbench inline', () => {
    const onRename = vi.fn();
    const onDelete = vi.fn();
    const view = render(
      <TestbenchDocumentTabs
        scenarios={SCENARIOS}
        activeScenarioId="half-adder"
        onSwitch={vi.fn()}
        onCreate={vi.fn()}
        onDuplicate={vi.fn()}
        onRename={onRename}
        onDelete={onDelete}
      />
    );

    fireEvent.click(view.getByText('Manage testbench'));
    fireEvent.click(view.getByTestId('ide-scenario-rename-btn'));
    const nameInput = view.getByTestId('ide-scenario-rename-input') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Primary truth table' } });
    fireEvent.submit(nameInput.closest('form')!);
    expect(onRename).toHaveBeenCalledWith('Primary truth table');

    fireEvent.click(view.getByTestId('ide-scenario-delete-btn'));
    expect(view.getByTestId('ide-scenario-delete-confirmation').textContent).toContain('Half Adder Cases');
    fireEvent.click(view.getByTestId('ide-scenario-delete-confirm'));
    expect(onDelete).toHaveBeenCalledWith('half-adder');
  });
});
