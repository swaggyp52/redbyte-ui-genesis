// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { listApps } from '@redbyte/rb-apps';
import { useMacroStore } from './macros/macroStore';
import type { AppSearchResult, CommandSearchResult, IntentSearchResult, MacroSearchResult, SearchResults } from './search-types';

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
  {
    type: 'command',
    id: 'create-workspace',
    name: 'Create Workspace',
    description: 'Save current windows as named workspace',
  },
  {
    type: 'command',
    id: 'switch-workspace',
    name: 'Switch Workspace',
    description: 'Switch to a different workspace',
  },
  {
    type: 'command',
    id: 'delete-workspace',
    name: 'Delete Workspace',
    description: 'Delete a workspace',
  },
  {
    type: 'command',
    id: 'run-macro',
    name: 'Run Macro',
    description: 'Execute a saved macro sequence',
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

export function getAllSearchableMacros(): MacroSearchResult[] {
  const macros = useMacroStore.getState().listMacros();
  return macros.map((macro) => ({
    type: 'macro' as const,
    id: macro.id,
    name: macro.name,
    description: `Macro with ${macro.steps.length} step${macro.steps.length !== 1 ? 's' : ''}`,
  }));
}

export function filterSearchResults(query: string): SearchResults {
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) {
    return {
      apps: getAllSearchableApps(),
      commands: getAllSearchableCommands(),
      intents: getAllSearchableIntents(),
      macros: getAllSearchableMacros(),
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

  const macros = getAllSearchableMacros().filter((macro) => {
    const nameMatch = macro.name.toLowerCase().includes(lowerQuery);
    const descMatch = macro.description.toLowerCase().includes(lowerQuery);
    return nameMatch || descMatch;
  });

  return { apps, commands, intents, macros };
}
