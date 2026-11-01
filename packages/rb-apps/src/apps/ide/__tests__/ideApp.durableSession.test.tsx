// @vitest-environment jsdom
/**
 * RB-DEBT-023 in the workbench: an import or a Save As changes the working session's identity.
 * Until that record has landed the workbench must not say Saved, must ask before the page
 * unloads, and must not let its session metadata name the new project; the next document then
 * opens what was acknowledged. Each document is a fresh module graph over one held disk.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  diskWithStoredProject,
  PROJECT_A,
  PROJECT_B,
  RUNTIME_RECORD,
  SESSION_META_RECORD,
  settle,
  type SessionDisk,
} from './sessionDiskFixture';

const runtimeOnly = (key: string) => key === RUNTIME_RECORD;
const A = PROJECT_A.meta!.projectId as string;
const B = PROJECT_B.meta!.projectId as string;
const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openWorkbenchDocument(disk: SessionDisk, search = '?mode=project') {
  const connection = disk.open();
  vi.resetModules();
  vi.stubGlobal('indexedDB', {});
  localStorage.setItem('rb-onboarding-v1-seen', '1');
  window.history.replaceState({}, '', `/os/${search}`);
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
  const saveState = () => view.getByTestId('ide-save-state').getAttribute('data-state');
  const unloadAsked = () => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };
  cleanups.push(() => view.unmount());
  return { connection, storage, view, rtl, useProjectRuntime, saveState, unloadAsked };
}

/** Records the moment the document would navigate (jsdom reports scripted navigations). */
function observeNavigation(disk: SessionDisk, onNavigate: () => void, quiet?: RegExp) {
  const navigations: Array<{ storedProject: string | null }> = [];
  const original = console.error.bind(console);
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (args.some((arg) => String(arg).includes('Not implemented: navigation'))) {
      navigations.push({ storedProject: disk.runtime()?.projectId ?? null });
      onNavigate();
    } else if (!quiet || !args.some((arg) => quiet.test(String(arg)))) original(...args);
  });
  return navigations;
}

describe('workbench identity writes (RB-DEBT-023)', () => {
  it('does not report an import as saved, keeps the leave guard and the old metadata until its record lands, then reopens it', async () => {
    const disk = await diskWithStoredProject(PROJECT_A);
    const first = await openWorkbenchDocument(disk);
    expect(first.useProjectRuntime.getState().projectId).toBe(A);
    // Let the boot's own writes and the first autosave finish: commits run in order, so a held
    // write would otherwise hold the import's recovery checkpoint behind it.
    await first.rtl.waitFor(() => expect(first.saveState()).toBe('saved'), { timeout: 10000 });
    const release = first.connection.hold(runtimeOnly);
    const file = new File([JSON.stringify(PROJECT_B)], 'imported-b.rbproj', { type: 'application/json' });
    // jsdom's File has no text(); the browser's does.
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(PROJECT_B) });
    first.rtl.fireEvent.change(first.view.getByTestId('ide-project-file-input'), { target: { files: [file] } });
    await first.rtl.waitFor(() => expect(first.useProjectRuntime.getState().projectId).toBe(B), { timeout: 10000 });
    await settle();
    expect(disk.runtime()?.projectId).toBe(A);
    expect(disk.meta()?.projectId).toBe(A);
    expect(first.saveState()).not.toBe('saved');
    expect(first.unloadAsked()).toBe(true);
    release();
    await first.rtl.waitFor(() => {
      expect(disk.runtime()?.projectId).toBe(B);
      expect(disk.meta()?.projectId).toBe(B);
    }, { timeout: 10000 });
    await first.rtl.waitFor(() => expect(first.saveState()).toBe('saved'), { timeout: 10000 });
    expect(first.unloadAsked()).toBe(false);
    first.connection.unload();
    first.view.unmount();

    const next = await openWorkbenchDocument(disk, '?mode=design');
    expect(next.useProjectRuntime.getState().projectId).toBe(B);
    expect(next.view.queryByTestId('ide-session-unfinished')).toBeNull();
  }, 120000);

  it('Save As: the copy is not reported saved, and its metadata does not land, until the working session names it', async () => {
    const disk = await diskWithStoredProject(PROJECT_A);
    const first = await openWorkbenchDocument(disk);
    await first.rtl.waitFor(() => expect(first.saveState()).toBe('saved'), { timeout: 10000 });
    const release = first.connection.hold(runtimeOnly);
    first.rtl.fireEvent.click(await first.view.findByTestId('ide-menu-file'));
    first.rtl.fireEvent.click(await first.view.findByTestId('ide-menu-item-project.save-as'));
    const name = await first.view.findByTestId('ide-save-as-name');
    first.rtl.fireEvent.change(name, { target: { value: 'Copy of A' } });
    first.rtl.fireEvent.click(first.view.getByTestId('ide-save-as-confirm'));
    await first.rtl.waitFor(() => expect(first.useProjectRuntime.getState().projectName).toBe('Copy of A'), { timeout: 10000 });
    const copyId = first.useProjectRuntime.getState().projectId;
    expect(copyId).not.toBe(A);
    await settle();
    expect(disk.runtime()?.projectId).toBe(A);
    expect(disk.meta()?.projectId).toBe(A);
    expect(first.saveState()).not.toBe('saved');
    expect(first.unloadAsked()).toBe(true);
    release();
    await first.rtl.waitFor(() => {
      expect(disk.runtime()?.projectId).toBe(copyId);
      expect(disk.meta()?.projectId).toBe(copyId);
    }, { timeout: 10000 });
    await first.rtl.waitFor(() => expect(first.saveState()).toBe('saved'), { timeout: 10000 });
    first.connection.unload();
    first.view.unmount();

    const next = await openWorkbenchDocument(disk, '?mode=design');
    expect(next.useProjectRuntime.getState().projectId).toBe(copyId);
    expect(next.useProjectRuntime.getState().projectName).toBe('Copy of A');
  }, 120000);

  it('reports a session record that is ahead of the stored working session instead of silently reopening the previous project', async () => {
    const disk = await diskWithStoredProject(PROJECT_A);
    // The metadata says it follows a working-session revision the disk never received.
    const storedRevision = disk.revisions.get(RUNTIME_RECORD) ?? 0;
    disk.values.set(SESSION_META_RECORD, JSON.stringify({ version: 1, savedAt: 1, projectId: B, currentMode: 'design',
      activeExampleId: null, projectKind: 'import', probedKeys: [], runtimeRevision: storedRevision + 1 }));
    const next = await openWorkbenchDocument(disk, '');
    const notice = await next.view.findByTestId('ide-session-unfinished', {}, { timeout: 10000 });
    expect(notice.getAttribute('role')).toBe('alert');
    expect(notice.textContent).toContain('did not finish saving');
    expect(notice.textContent).toContain(PROJECT_A.name);
    expect(next.useProjectRuntime.getState().projectId).toBe(A);
  }, 120000);

  it('Reload App waits for the last change to land before reloading', async () => {
    const disk = await diskWithStoredProject(PROJECT_A);
    const connection = disk.open();
    vi.resetModules();
    vi.stubGlobal('indexedDB', {});
    const storage = await import('../durableProjectStorage');
    storage._setBrowserSessionStorageForTests(connection.backend);
    const React = await import('react');
    const rtl = await import('@testing-library/react');
    const { ErrorBoundary } = await import('../../../components/ErrorBoundary');
    const { useProjectRuntime } = await import('../projectRuntime');
    if (!useProjectRuntime.persist.hasHydrated()) await useProjectRuntime.persist.rehydrate();
    const Failing = () => { throw new TypeError('Failed to fetch dynamically imported module: /assets/DesignSurface.js'); };
    // The boundary logs the error it caught; only navigations are of interest here.
    const navigations = observeNavigation(disk, () => connection.unload(), /RB_FATAL|Stack:|Component stack:|The above error|DesignSurface/);
    const view = rtl.render(React.createElement(ErrorBoundary, { fallbackTitle: 'Design workspace encountered an error', children: React.createElement(Failing) }));
    cleanups.push(() => view.unmount());
    const release = connection.hold(runtimeOnly);
    useProjectRuntime.getState().loadFromProject(PROJECT_B);
    rtl.fireEvent.click(view.getByTestId('error-boundary-reload-app'));
    await settle();
    expect(navigations).toEqual([]);
    release();
    await rtl.waitFor(() => expect(navigations).toEqual([{ storedProject: B }]), { timeout: 5000 });
  }, 120000);
});
