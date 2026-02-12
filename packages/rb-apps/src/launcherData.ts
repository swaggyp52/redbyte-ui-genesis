// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { isStudentModeEnabled } from './utils/uiMode';

// Convert registry entries into the minimal shape required by the Launcher UI.
export async function getAppsForLauncher() {
  const { listApps } = await import('./AppRegistry');
  const apps = listApps();
  const studentMode = isStudentModeEnabled();
  const hiddenInStudentMode = new Set(['toolchain-setup', 'terminal', 'system-log']);
  return apps
    .filter((app) => app.manifest.id !== 'launcher' && !app.manifest.hidden)
    .filter((app) => !(studentMode && hiddenInStudentMode.has(app.manifest.id)))
    .map((app) => ({
    id: app.manifest.id,
    name: app.manifest.name,
    }));
}
