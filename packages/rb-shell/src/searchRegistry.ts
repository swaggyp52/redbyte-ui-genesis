// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { listApps, useFileSystemStore } from '@redbyte/rb-apps';
import { useMacroStore } from './macros/macroStore';
import type { AppSearchResult, CommandSearchResult, IntentSearchResult, MacroSearchResult, FileSearchResult, SearchResults } from './search-types';

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
  // Note: "File: Open With..." requires context-awareness (focused Files window + selected file)
  // which static intents don't support. Use Cmd/Ctrl+Shift+Enter in Files instead.
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

export function getAllSearchableFiles(): FileSearchResult[] {
  const allFiles = useFileSystemStore.getState().getAllFiles();

  return allFiles.map((file) => {
    // Extract extension from filename (everything after last dot)
    const extension = file.name.includes('.')
      ? file.name.split('.').pop() || ''
      : '';

    return {
      type: 'file' as const,
      id: file.id,
      name: file.name,
      description: `File • Modified ${file.modified}`,
      extension,
      resourceType: 'file' as const,
    };
  });
}

export function filterSearchResults(query: string): SearchResults {
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) {
    return {
      apps: getAllSearchableApps(),
      commands: getAllSearchableCommands(),
      intents: getAllSearchableIntents(),
      macros: getAllSearchableMacros(),
      files: getAllSearchableFiles(),
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

  // Files with deterministic scoring (prefix=2, contains=1) and stable sort
  const allFiles = getAllSearchableFiles();
  const filesWithScores = allFiles
    .map((file) => {
      const lowerName = file.name.toLowerCase();
      let score = 0;

      if (lowerName.startsWith(lowerQuery)) {
        score = 2; // Prefix match
      } else if (lowerName.includes(lowerQuery)) {
        score = 1; // Contains match
      }

      return { file, score };
    })
    .filter((item) => item.score > 0); // Exclude non-matches

  // Stable sort: score DESC, name ASC, id ASC
  filesWithScores.sort((a, b) => {
    // Score DESC (higher score first)
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    // Name ASC (alphabetical)
    const nameCompare = a.file.name.localeCompare(b.file.name);
    if (nameCompare !== 0) {
      return nameCompare;
    }
    // ID ASC (stable tie-break)
    return a.file.id.localeCompare(b.file.id);
  });

  const files = filesWithScores.map((item) => item.file);

  return { apps, commands, intents, macros, files };
}
