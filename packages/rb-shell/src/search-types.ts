// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Command } from './CommandPalette';

export type SearchResultType = 'app' | 'command' | 'intent' | 'macro' | 'file' | 'knowledge';

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

export interface FileSearchResult {
  type: 'file';
  id: string; // resourceId from fsModel
  name: string; // display name (e.g., "Notes.txt")
  description: string; // path or metadata
  extension: string; // extracted extension (e.g., "txt")
  resourceType: 'file';
}

export interface KnowledgeSearchResult {
  type: 'knowledge';
  id: string;
  name: string;
  description: string;
  gateTypes?: string[];
}

export type SearchResult = AppSearchResult | CommandSearchResult | IntentSearchResult | MacroSearchResult | FileSearchResult | KnowledgeSearchResult;

export interface SearchResults {
  apps: AppSearchResult[];
  commands: CommandSearchResult[];
  intents: IntentSearchResult[];
  macros: MacroSearchResult[];
  files: FileSearchResult[];
  knowledge: KnowledgeSearchResult[];
}
