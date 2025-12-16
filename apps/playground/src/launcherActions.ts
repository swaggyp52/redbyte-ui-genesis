import { getApp } from '@redbyte/rb-apps';
import { useWindowStore } from '@redbyte/rb-windowing';

export type LauncherActionId = 'open-settings' | 'open-docs' | 'create-project';

const DOCS_URL = '/docs';

function openAppWindow(appId: string): string | null {
  const app = getApp(appId);
  if (!app) return null;

  const store = useWindowStore.getState();
  const existing = app.manifest.singleton
    ? store.windows.find((window) => window.contentId === appId)
    : undefined;

  if (existing) {
    store.focusWindow(existing.id);
    return existing.id;
  }

  const created = store.createWindow({
    title: app.manifest.name,
    width: app.manifest.defaultSize?.width,
    height: app.manifest.defaultSize?.height,
    contentId: app.manifest.id,
  });

  return created.id;
}

export function executeLauncherAction(actionId: LauncherActionId): void {
  switch (actionId) {
    case 'open-settings': {
      openAppWindow('settings');
      break;
    }

    case 'open-docs': {
      const opened = openAppWindow('docs');
      if (!opened && typeof window !== 'undefined') {
        window.open(DOCS_URL, '_blank', 'noopener,noreferrer');
      }
      break;
    }

    case 'create-project': {
      // Placeholder for future project creation flow.
      break;
    }
  }
}
