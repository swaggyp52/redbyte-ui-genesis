// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultScenarioViewState, normalizeScenarioViewState, scenarioViewStorageKey } from '../scenarioViewState';
import { useScenarioViewState } from '../useScenarioViewState';

describe('scenario inspection preferences', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(cleanup);

  it('isolates repeated scenario names in different projects and delimiter-shaped ids', () => {
    expect(scenarioViewStorageKey({ projectId: 'one', scenarioId: 'default' }))
      .not.toBe(scenarioViewStorageKey({ projectId: 'two', scenarioId: 'default' }));
    expect(scenarioViewStorageKey({ projectId: 'a:b', scenarioId: 'c' }))
      .not.toBe(scenarioViewStorageKey({ projectId: 'a', scenarioId: 'b:c' }));
  });

  it('keeps two experiments distinct through switch, late old-scope callback, close and reopen', () => {
    const a = { projectId: 'project-one', scenarioId: 'reset-test' };
    const b = { projectId: 'project-one', scenarioId: 'enable-test' };
    const hook = renderHook(({ scope }) => useScenarioViewState(scope), { initialProps: { scope: a } });
    act(() => {
      hook.result.current.setField('selectedTick', 6);
      hook.result.current.setField('selectedSignal', 'ha0.sum');
      hook.result.current.setField('cursorA', 2);
      hook.result.current.setField('cursorB', 8);
      hook.result.current.setField('authoredRepresentation', 'table');
      hook.result.current.setField('studioMode', 'replay');
    });
    const oldScopeSetter = hook.result.current.setField;
    hook.rerender({ scope: b });
    expect(hook.result.current.state).toEqual(defaultScenarioViewState());
    act(() => {
      hook.result.current.setField('selectedTick', 11);
      hook.result.current.setField('selectedSignal', 'ha1.sum');
      hook.result.current.setField('authoredRepresentation', 'timeline');
      oldScopeSetter('cursorA', 4);
    });
    expect(hook.result.current.state.selectedTick).toBe(11);
    expect(hook.result.current.state.cursorA).toBeNull();
    hook.rerender({ scope: a });
    expect(hook.result.current.state).toMatchObject({
      selectedTick: 6, selectedSignal: 'ha0.sum', cursorA: 4, cursorB: 8,
      authoredRepresentation: 'table', studioMode: 'replay',
    });
    hook.unmount();
    const reopened = renderHook(() => useScenarioViewState(b));
    expect(reopened.result.current.state).toMatchObject({
      selectedTick: 11, selectedSignal: 'ha1.sum', authoredRepresentation: 'timeline',
      cursorA: null, cursorB: null, studioMode: 'scenario',
    });
    reopened.unmount();
    const anotherProject = renderHook(() => useScenarioViewState({ ...a, projectId: 'project-two' }));
    expect(anotherProject.result.current.state).toEqual(defaultScenarioViewState());
  });

  it('rejects invalid coordinates and malformed saved preferences without borrowing a global cursor', () => {
    expect(normalizeScenarioViewState({ selectedTick: -1, cursorA: Infinity, cursorB: 1.2, selectedSignal: 0 }))
      .toEqual(defaultScenarioViewState());
    const scope = { projectId: 'p', scenarioId: 's' };
    sessionStorage.setItem(scenarioViewStorageKey(scope), '{bad json');
    sessionStorage.setItem('rb.verify.ui.v1', JSON.stringify({ selectedTick: 37 }));
    const hook = renderHook(() => useScenarioViewState(scope));
    expect(hook.result.current.state).toEqual(defaultScenarioViewState());
  });
});
