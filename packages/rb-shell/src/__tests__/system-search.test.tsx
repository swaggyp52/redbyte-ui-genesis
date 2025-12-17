// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, vi } from 'vitest';
import { filterSearchResults } from '../searchRegistry';

describe('System Search', () => {
  describe('Search filtering', () => {
    it('returns all results when query is empty', () => {
      const results = filterSearchResults('');

      expect(results.apps.length).toBeGreaterThan(0);
      expect(results.commands.length).toBeGreaterThan(0);
      expect(results.intents.length).toBeGreaterThan(0);
    });

    it('filters apps by name (case-insensitive)', () => {
      const results = filterSearchResults('files');

      const filesApp = results.apps.find((app) => app.id === 'files');
      expect(filesApp).toBeTruthy();
      expect(filesApp?.name).toBe('Files');
    });

    it('filters apps by name partial match', () => {
      const results = filterSearchResults('set');

      const settingsApp = results.apps.find((app) => app.id === 'settings');
      expect(settingsApp).toBeTruthy();
    });

    it('filters commands by name', () => {
      const results = filterSearchResults('focus');

      const focusCommand = results.commands.find((cmd) => cmd.id === 'focus-next-window');
      expect(focusCommand).toBeTruthy();
    });

    it('filters commands by description', () => {
      const results = filterSearchResults('close');

      const closeCommand = results.commands.find((cmd) => cmd.id === 'close-focused-window');
      expect(closeCommand).toBeTruthy();
    });

    it('filters intents by name', () => {
      const results = filterSearchResults('playground');

      const playgroundIntent = results.intents.find((intent) => intent.id === 'open-in-playground');
      expect(playgroundIntent).toBeTruthy();
    });

    it('returns no results for non-matching query', () => {
      const results = filterSearchResults('xyz-nonexistent-app');

      expect(results.apps.length).toBe(0);
      expect(results.commands.length).toBe(0);
      expect(results.intents.length).toBe(0);
    });

    it('is case-insensitive', () => {
      const lowerResults = filterSearchResults('files');
      const upperResults = filterSearchResults('FILES');
      const mixedResults = filterSearchResults('FiLeS');

      expect(lowerResults.apps.length).toBe(upperResults.apps.length);
      expect(lowerResults.apps.length).toBe(mixedResults.apps.length);
    });

    it('excludes launcher from app results', () => {
      const results = filterSearchResults('');

      const launcherApp = results.apps.find((app) => app.id === 'launcher');
      expect(launcherApp).toBeUndefined();
    });
  });

  describe('Search result structure', () => {
    it('app results have correct structure', () => {
      const results = filterSearchResults('files');
      const filesApp = results.apps[0];

      expect(filesApp).toHaveProperty('type', 'app');
      expect(filesApp).toHaveProperty('id');
      expect(filesApp).toHaveProperty('name');
      expect(filesApp).toHaveProperty('description');
    });

    it('command results have correct structure', () => {
      const results = filterSearchResults('focus');
      const focusCommand = results.commands[0];

      expect(focusCommand).toHaveProperty('type', 'command');
      expect(focusCommand).toHaveProperty('id');
      expect(focusCommand).toHaveProperty('name');
      expect(focusCommand).toHaveProperty('description');
    });

    it('intent results have correct structure', () => {
      const results = filterSearchResults('playground');
      const playgroundIntent = results.intents[0];

      expect(playgroundIntent).toHaveProperty('type', 'intent');
      expect(playgroundIntent).toHaveProperty('id');
      expect(playgroundIntent).toHaveProperty('name');
      expect(playgroundIntent).toHaveProperty('description');
      expect(playgroundIntent).toHaveProperty('intentType');
      expect(playgroundIntent).toHaveProperty('targetAppId');
    });
  });

  describe('Search execution behavior', () => {
    it('app execution calls openWindow with correct appId', () => {
      const onExecuteApp = vi.fn();
      const results = filterSearchResults('files');
      const filesApp = results.apps.find((app) => app.id === 'files');

      if (filesApp) {
        onExecuteApp(filesApp.id);
      }

      expect(onExecuteApp).toHaveBeenCalledWith('files');
    });

    it('command execution calls executeCommand with correct command', () => {
      const onExecuteCommand = vi.fn();
      const results = filterSearchResults('focus');
      const focusCommand = results.commands.find((cmd) => cmd.id === 'focus-next-window');

      if (focusCommand) {
        onExecuteCommand(focusCommand.id);
      }

      expect(onExecuteCommand).toHaveBeenCalledWith('focus-next-window');
    });

    it('intent execution calls onExecuteIntent with correct intentId', () => {
      const onExecuteIntent = vi.fn();
      const results = filterSearchResults('playground');
      const playgroundIntent = results.intents.find((intent) => intent.id === 'open-in-playground');

      if (playgroundIntent) {
        onExecuteIntent(playgroundIntent.id);
      }

      expect(onExecuteIntent).toHaveBeenCalledWith('open-in-playground');
    });
  });

  describe('Priority order', () => {
    it('returns apps before commands when both match', () => {
      const results = filterSearchResults('');

      expect(results.apps.length).toBeGreaterThan(0);
      expect(results.commands.length).toBeGreaterThan(0);
    });

    it('returns commands before intents when both match', () => {
      const results = filterSearchResults('');

      expect(results.commands.length).toBeGreaterThan(0);
      expect(results.intents.length).toBeGreaterThan(0);
    });
  });
});
