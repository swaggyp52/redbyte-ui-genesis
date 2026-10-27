// @vitest-environment jsdom
/**
 * RB-DEBT-023: the studio's rail links leave the document. A link followed while the working
 * session's last write is still pending reopened the previous project in the next document.
 * Each document here is a fresh module graph over one held session disk; a commit that has not
 * landed when its document navigates away never lands.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  diskWithStoredProject,
  PROJECT_A,
  PROJECT_B,
  RUNTIME_RECORD,
  settle,
  type SessionDisk,
} from '@redbyte/rb-apps/apps/ide/__tests__/sessionDiskFixture';

const runtimeOnly = (key: string) => key === RUNTIME_RECORD;
const cleanups: Array<() => void> = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

interface Navigation { how: string; storedProject: string | null }

/** Records the moment the document would navigate: a followed link or a scripted navigation. */
function observeNavigation(disk: SessionDisk, onNavigate: () => void): Navigation[] {
  const navigations: Navigation[] = [];
  const record = (how: string) => {
    navigations.push({ how, storedProject: disk.runtime()?.projectName ?? null });
    onNavigate();
  };
  const onClick = (event: MouseEvent) => {
    const anchor = (event.target as Element | null)?.closest?.('a[href]');
    if (anchor && !event.defaultPrevented && event.button === 0) record(`link ${anchor.getAttribute('href')}`);
  };
  window.addEventListener('click', onClick);
  cleanups.push(() => window.removeEventListener('click', onClick));
  const original = console.error.bind(console);
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (args.some((arg) => String(arg).includes('Not implemented: navigation'))) record('script');
    else original(...args);
  });
  return navigations;
}

async function openStudioDocument(disk: SessionDisk) {
  const connection = disk.open();
  vi.resetModules();
  vi.stubGlobal('indexedDB', {});
  window.history.replaceState({}, '', '/os/?studio=meridian&stage=design');
  const storage = await import('@redbyte/rb-apps/apps/ide/durableProjectStorage');
  storage._setBrowserSessionStorageForTests(connection.backend);
  const React = await import('react');
  const rtl = await import('@testing-library/react');
  const { MeridianStudio } = await import('../MeridianStudio');
  const { useProjectRuntime } = await import('@redbyte/rb-apps/runtime');
  const view = rtl.render(React.createElement(MeridianStudio));
  await rtl.waitFor(() => expect(view.getByTestId('meridian-project')).toBeTruthy(), { timeout: 15000 });
  return { connection, storage, React, rtl, view, useProjectRuntime };
}

/** The classic workbench, booted the way the rail's Classic link opens it. */
async function openWorkbenchDocument(disk: SessionDisk, search: string) {
  const connection = disk.open();
  vi.resetModules();
  vi.stubGlobal('indexedDB', {});
  localStorage.setItem('rb-onboarding-v1-seen', '1');
  window.history.replaceState({}, '', `/os/${search}`);
  const storage = await import('@redbyte/rb-apps/apps/ide/durableProjectStorage');
  storage._setBrowserSessionStorageForTests(connection.backend);
  const React = await import('react');
  const rtl = await import('@testing-library/react');
  const { ThemeProvider } = await import('@redbyte/rb-theme');
  const { IdeApp } = await import('@redbyte/rb-apps/apps/IdeApp');
  const { useProjectRuntime } = await import('@redbyte/rb-apps/runtime');
  const view = rtl.render(React.createElement(ThemeProvider, null, React.createElement(IdeApp)));
  await rtl.waitFor(() => expect(view.getByTestId('ide-root')).toBeTruthy(), { timeout: 20000 });
  await settle();
  return { connection, view, rtl, useProjectRuntime };
}

describe('studio rail navigation after an import (RB-DEBT-023)', () => {
  it('waits for the import to land, then the classic workbench opens the imported project', async () => {
    const disk = await diskWithStoredProject(PROJECT_A);
    const studio = await openStudioDocument(disk);
    expect(studio.view.getByTestId('meridian-project').textContent).toBe(PROJECT_A.name);
    const release = studio.connection.hold(runtimeOnly);
    await studio.rtl.act(async () => { studio.useProjectRuntime.getState().loadFromProject(PROJECT_B); });
    expect(studio.view.getByTestId('meridian-project').textContent).toBe(PROJECT_B.name);
    const navigations = observeNavigation(disk, () => studio.connection.unload());
    studio.rtl.fireEvent.click(studio.view.container.querySelector('a.mrd-rail-classic')!);
    await settle();
    const pendingWhileHeld = navigations.length;
    release();
    await studio.rtl.waitFor(() => expect(navigations.length).toBeGreaterThan(0), { timeout: 5000 }).catch(() => undefined);
    studio.view.unmount();

    const workbench = await openWorkbenchDocument(disk, '?mode=design');
    expect(workbench.useProjectRuntime.getState().projectName).toBe(PROJECT_B.name);
    expect(pendingWhileHeld).toBe(0);
    expect(navigations).toEqual([{ how: 'script', storedProject: PROJECT_B.name }]);
    workbench.view.unmount();
  }, 90000);

  it('keeps the student in the studio when the write fails, with the reason and a Leave anyway path', async () => {
    const disk = await diskWithStoredProject(PROJECT_A);
    const studio = await openStudioDocument(disk);
    studio.connection.failNext(runtimeOnly);
    await studio.rtl.act(async () => { studio.useProjectRuntime.getState().loadFromProject(PROJECT_B); });
    const navigations = observeNavigation(disk, () => studio.connection.unload());
    studio.rtl.fireEvent.click(studio.view.container.querySelector('a.mrd-rail-classic')!);
    const notice = await studio.view.findByTestId('meridian-leave-notice', {}, { timeout: 5000 });
    expect(notice.getAttribute('role')).toBe('alert');
    expect(notice.textContent).toContain('Controlled quota failure');
    expect(navigations).toEqual([]);
    studio.rtl.fireEvent.click(studio.view.getByTestId('meridian-leave-anyway'));
    expect(navigations).toEqual([{ how: 'script', storedProject: PROJECT_A.name }]);
    studio.view.unmount();
  }, 90000);

  it('asks before the page unloads while a change is not yet acknowledged, and not after', async () => {
    const disk = await diskWithStoredProject(PROJECT_A);
    const studio = await openStudioDocument(disk);
    const release = studio.connection.hold(runtimeOnly);
    await studio.rtl.act(async () => { studio.useProjectRuntime.getState().loadFromProject(PROJECT_B); });
    const pending = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(pending);
    expect(pending.defaultPrevented).toBe(true);
    release();
    await studio.storage.runtimePersistence.flush();
    const settled = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(settled);
    expect(settled.defaultPrevented).toBe(false);
    studio.view.unmount();
  }, 90000);
});
