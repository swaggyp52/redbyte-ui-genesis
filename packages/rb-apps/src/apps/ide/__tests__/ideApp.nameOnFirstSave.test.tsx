// @vitest-environment jsdom
/**
 * A project is first saved under a name the student gives it. In rc.8 Save kept "Untitled
 * Project" without asking, and the Vivado package was then named after an internal id (owner
 * acceptance V8). A named project saves at once, as before.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { diskWithStoredProject, lifecycleProject, PROJECT_A, settle, type SessionDisk } from './sessionDiskFixture';

const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openWorkbench(disk: SessionDisk) {
  const connection = disk.open();
  vi.resetModules();
  vi.stubGlobal('indexedDB', {});
  localStorage.setItem('rb-onboarding-v1-seen', '1');
  window.history.replaceState({}, '', '/os/?mode=design');
  const storage = await import('../durableProjectStorage');
  storage._setBrowserSessionStorageForTests(connection.backend);
  const React = await import('react');
  const rtl = await import('@testing-library/react');
  const { ThemeProvider } = await import('@redbyte/rb-theme');
  const { IdeApp } = await import('../../IdeApp');
  const { useProjectRuntime } = await import('../projectRuntime');
  const view = rtl.render(React.createElement(ThemeProvider, null, React.createElement(IdeApp)));
  await rtl.waitFor(() => expect(view.getByTestId('ide-root')).toBeTruthy(), { timeout: 20000 });
  await settle();
  cleanups.push(() => view.unmount());
  return { view, rtl, useProjectRuntime };
}

describe('naming a project on its first save (acceptance V8)', () => {
  it('asks an untitled project for a name and saves it under that name', async () => {
    const disk = await diskWithStoredProject(lifecycleProject('rb-untitled-fixture', 'Untitled Project', 'untitled_fixture'));
    const { view, rtl, useProjectRuntime } = await openWorkbench(disk);
    rtl.fireEvent.click(await view.findByTestId('ide-topbar-save-btn'));
    const dialog = await view.findByTestId('ide-name-project-dialog');
    expect(dialog.textContent).toContain('Name this project');
    // An empty field is not reported as an error before the student types, but Save waits for a name.
    expect(dialog.querySelector('[role="alert"]')).toBeNull();
    expect((view.getByTestId('ide-name-project-confirm') as HTMLButtonElement).disabled).toBe(true);
    rtl.fireEvent.change(view.getByTestId('ide-name-project-name'), { target: { value: 'Majority vote' } });
    rtl.fireEvent.click(view.getByTestId('ide-name-project-confirm'));
    await rtl.waitFor(() => expect(useProjectRuntime.getState().projectName).toBe('Majority vote'), { timeout: 10000 });
    await rtl.waitFor(() => expect(view.queryByTestId('ide-name-project-dialog')).toBeNull(), { timeout: 10000 });
  }, 120000);

  it('saves a named project without asking', async () => {
    const disk = await diskWithStoredProject(PROJECT_A);
    const { view, rtl, useProjectRuntime } = await openWorkbench(disk);
    rtl.fireEvent.click(await view.findByTestId('ide-topbar-save-btn'));
    await settle();
    expect(view.queryByTestId('ide-name-project-dialog')).toBeNull();
    expect(useProjectRuntime.getState().projectName).toBe('Stored Project A');
  }, 120000);
});
