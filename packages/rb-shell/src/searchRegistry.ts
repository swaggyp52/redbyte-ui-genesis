// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { listApps } from '@redbyte/rb-apps';
import type { AppSearchResult, CommandSearchResult, IntentSearchResult, SearchResults } from './search-types';

const COMMANDS: CommandSearchResult[] = [
  {
    type: 'command',
    id: 'focus-next-window',
    name: 'Focus Next Window',
    description: 'Cycle to the next window',
  },
  {
    type: 'command',
    id: 'close-focused-window',
    name: 'Close Window',
    description: 'Close the currently focused window',
  },
  {
    type: 'command',
    id: 'minimize-focused-window',
    name: 'Minimize Window',
    description: 'Minimize the currently focused window',
  },
  {
    type: 'command',
    id: 'snap-left',
    name: 'Snap Left',
    description: 'Snap window to left half of screen',
  },
  {
    type: 'command',
    id: 'snap-right',
    name: 'Snap Right',
    description: 'Snap window to right half of screen',
  },
  {
    type: 'command',
    id: 'snap-top',
    name: 'Snap Top',
    description: 'Snap window to top half of screen',
  },
  {
    type: 'command',
    id: 'snap-bottom',
    name: 'Snap Bottom',
    description: 'Snap window to bottom half of screen',
  },
  {
    type: 'command',
    id: 'center-window',
    name: 'Center Window',
    description: 'Center window on screen',
  },
];

const INTENT_TARGETS: IntentSearchResult[] = [
  {
    type: 'intent',
    id: 'open-in-playground',
    name: 'Open in Playground',
    description: 'Open a file in Logic Playground',
    intentType: 'open-with',
    targetAppId: 'logic-playground',
  },
];

export function getAllSearchableApps(): AppSearchResult[] {
  return listApps()
    .filter((app) => app.manifest.id !== 'launcher')
    .map((app) => ({
      type: 'app' as const,
      id: app.manifest.id,
      name: app.manifest.name,
      description: `Open ${app.manifest.name}`,
    }));
}

export function getAllSearchableCommands(): CommandSearchResult[] {
  return COMMANDS;
}

export function getAllSearchableIntents(): IntentSearchResult[] {
  return INTENT_TARGETS;
}

export function filterSearchResults(query: string): SearchResults {
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) {
    return {
      apps: getAllSearchableApps(),
      commands: getAllSearchableCommands(),
      intents: getAllSearchableIntents(),
    };
  }

  const apps = getAllSearchableApps().filter((app) => {
    const nameMatch = app.name.toLowerCase().includes(lowerQuery);
    const descMatch = app.description?.toLowerCase().includes(lowerQuery);
    return nameMatch || descMatch;
  });

  const commands = getAllSearchableCommands().filter((cmd) => {
    const nameMatch = cmd.name.toLowerCase().includes(lowerQuery);
    const descMatch = cmd.description.toLowerCase().includes(lowerQuery);
    return nameMatch || descMatch;
  });

  const intents = getAllSearchableIntents().filter((intent) => {
    const nameMatch = intent.name.toLowerCase().includes(lowerQuery);
    const descMatch = intent.description.toLowerCase().includes(lowerQuery);
    return nameMatch || descMatch;
  });

  return { apps, commands, intents };
}
