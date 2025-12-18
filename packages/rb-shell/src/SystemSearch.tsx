// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { filterSearchResults } from './searchRegistry';
import type { SearchResult } from './search-types';
import type { Command } from './CommandPalette';

interface SystemSearchProps {
  onExecuteApp: (appId: string) => void;
  onExecuteCommand: (command: Command) => void;
  onExecuteIntent: (intentId: string) => void;
  onExecuteMacro: (macroId: string) => void;
  onExecuteFile: (fileId: string, shiftKey: boolean) => void;
  onClose: () => void;
}

export const SystemSearch: React.FC<SystemSearchProps> = ({
  onExecuteApp,
  onExecuteCommand,
  onExecuteIntent,
  onExecuteMacro,
  onExecuteFile,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => filterSearchResults(query), [query]);

  const allResults: SearchResult[] = useMemo(() => {
    return [...results.apps, ...results.commands, ...results.intents, ...results.macros, ...results.files];
  }, [results]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, allResults.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = allResults[selectedIndex];
      if (!selected) return;

      switch (selected.type) {
        case 'app':
          onExecuteApp(selected.id);
          break;
        case 'command':
          onExecuteCommand(selected.id);
          break;
        case 'intent':
          onExecuteIntent(selected.id);
          break;
        case 'macro':
          onExecuteMacro(selected.id);
          break;
        case 'file':
          onExecuteFile(selected.id, event.shiftKey);
          break;
      }
      onClose();
      return;
    }
  };

  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case 'app':
        onExecuteApp(result.id);
        break;
      case 'command':
        onExecuteCommand(result.id);
        break;
      case 'intent':
        onExecuteIntent(result.id);
        break;
      case 'macro':
        onExecuteMacro(result.id);
        break;
      case 'file':
        onExecuteFile(result.id, false); // Mouse clicks are default-open
        break;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-start justify-center pt-32 z-[9999]"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-cyan-500/30 rounded-lg shadow-2xl w-[600px] overflow-hidden"
      >
        <div className="p-4 border-b border-slate-800 bg-slate-950">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search apps, commands, files, and actions..."
            className="w-full bg-slate-800 text-white px-4 py-2 rounded outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <div className="max-h-[500px] overflow-y-auto">
          {results.apps.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase bg-slate-950">
                Apps
              </div>
              {results.apps.map((app, index) => {
                const globalIndex = index;
                const isSelected = globalIndex === selectedIndex;
                return (
                  <button
                    key={app.id}
                    onClick={() => handleResultClick(app)}
                    className={`w-full text-left p-3 border-b border-slate-800 transition-colors ${
                      isSelected ? 'bg-cyan-900/30 text-cyan-300' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-medium text-sm">{app.name}</div>
                    {app.description && (
                      <div className="text-xs text-slate-500 mt-1">{app.description}</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {results.commands.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase bg-slate-950">
                Commands
              </div>
              {results.commands.map((cmd, index) => {
                const globalIndex = results.apps.length + index;
                const isSelected = globalIndex === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => handleResultClick(cmd)}
                    className={`w-full text-left p-3 border-b border-slate-800 transition-colors ${
                      isSelected ? 'bg-cyan-900/30 text-cyan-300' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-medium text-sm">{cmd.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{cmd.description}</div>
                  </button>
                );
              })}
            </div>
          )}

          {results.intents.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase bg-slate-950">
                Actions
              </div>
              {results.intents.map((intent, index) => {
                const globalIndex = results.apps.length + results.commands.length + index;
                const isSelected = globalIndex === selectedIndex;
                return (
                  <button
                    key={intent.id}
                    onClick={() => handleResultClick(intent)}
                    className={`w-full text-left p-3 border-b border-slate-800 transition-colors ${
                      isSelected ? 'bg-cyan-900/30 text-cyan-300' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-medium text-sm">{intent.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{intent.description}</div>
                  </button>
                );
              })}
            </div>
          )}

          {results.macros.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase bg-slate-950">
                Macros
              </div>
              {results.macros.map((macro, index) => {
                const globalIndex = results.apps.length + results.commands.length + results.intents.length + index;
                const isSelected = globalIndex === selectedIndex;
                return (
                  <button
                    key={macro.id}
                    onClick={() => handleResultClick(macro)}
                    className={`w-full text-left p-3 border-b border-slate-800 transition-colors ${
                      isSelected ? 'bg-cyan-900/30 text-cyan-300' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-medium text-sm">{macro.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{macro.description}</div>
                  </button>
                );
              })}
            </div>
          )}

          {results.files.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase bg-slate-950">
                Files
              </div>
              {results.files.map((file, index) => {
                const globalIndex = results.apps.length + results.commands.length + results.intents.length + results.macros.length + index;
                const isSelected = globalIndex === selectedIndex;
                return (
                  <button
                    key={file.id}
                    onClick={() => handleResultClick(file)}
                    className={`w-full text-left p-3 border-b border-slate-800 transition-colors ${
                      isSelected ? 'bg-cyan-900/30 text-cyan-300' : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-medium text-sm">{file.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{file.description}</div>
                  </button>
                );
              })}
            </div>
          )}

          {allResults.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">
              No results found for "{query}"
            </div>
          )}
        </div>

        <div className="p-2 border-t border-slate-800 text-xs text-slate-500 bg-slate-950">
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">↑↓</kbd> Navigate{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Enter</kbd> Execute{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Shift+Enter</kbd> Open With{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Esc</kbd> Close
        </div>
      </div>
    </div>
  );
};
