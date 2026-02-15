// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { isStudentModeActive, isStudentVisibleApp } from './studentAppGate';
import { getRedByteUiMode } from './utils/uiMode';

const STUDIO_LAUNCHER_WHITELIST = new Set(['home', 'lab-workspace', 'submission-inspector']);

// Convert registry entries into the minimal shape required by the Launcher UI.
export async function getAppsForLauncher() {
  const { listApps } = await import('./AppRegistry');
  const apps = listApps();
  const studentMode = isStudentModeActive();

  return apps
    .filter((app) => app.manifest.id !== 'launcher' && !app.manifest.hidden)
    .filter((app) => {
      if (studentMode) {
        if (getRedByteUiMode() === 'ta' && app.manifest.id === 'submission-inspector') {
          return true;
        }
        return isStudentVisibleApp(app.manifest.id);
      }
      return STUDIO_LAUNCHER_WHITELIST.has(app.manifest.id);
    })
    .map((app) => ({
    id: app.manifest.id,
    name: app.manifest.name,
    }));
}
