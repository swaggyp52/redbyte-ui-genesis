// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { isStudentModeEnabled } from './utils/uiMode';

const STUDENT_LAUNCHER_WHITELIST = new Set(['home', 'lab-workspace', 'help']);

// Convert registry entries into the minimal shape required by the Launcher UI.
export async function getAppsForLauncher() {
  const { listApps } = await import('./AppRegistry');
  const apps = listApps();
  const studentMode = isStudentModeEnabled();

  if (studentMode) {
    return apps
      .filter((app) => app.manifest.id !== 'launcher' && !app.manifest.hidden)
      .filter((app) => STUDENT_LAUNCHER_WHITELIST.has(app.manifest.id))
      .map((app) => ({
        id: app.manifest.id,
        name: app.manifest.name,
      }));
  }

  return apps
    .filter((app) => app.manifest.id !== 'launcher' && !app.manifest.hidden)
    .map((app) => ({
    id: app.manifest.id,
    name: app.manifest.name,
    }));
}
