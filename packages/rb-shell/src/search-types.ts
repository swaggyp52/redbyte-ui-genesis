// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Command } from './CommandPalette';

export type SearchResultType = 'app' | 'command' | 'intent' | 'macro';

export interface AppSearchResult {
  type: 'app';
  id: string;
  name: string;
  description?: string;
}

export interface CommandSearchResult {
  type: 'command';
  id: Command;
  name: string;
  description: string;
}

export interface IntentSearchResult {
  type: 'intent';
  id: string;
  name: string;
  description: string;
  intentType: 'open-with';
  targetAppId: string;
}

export interface MacroSearchResult {
  type: 'macro';
  id: string;
  name: string;
  description: string;
}

export type SearchResult = AppSearchResult | CommandSearchResult | IntentSearchResult | MacroSearchResult;

export interface SearchResults {
  apps: AppSearchResult[];
  commands: CommandSearchResult[];
  intents: IntentSearchResult[];
  macros: MacroSearchResult[];
}
