// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { listApps } from './AppRegistry';

// Convert registry entries into the minimal shape required by the Launcher UI.
export function getAppsForLauncher() {
  const apps = listApps();
  return apps
    .filter((app) => app.manifest.id !== 'launcher')
    .map((app) => ({
    id: app.manifest.id,
    name: app.manifest.name,
    }));
}
