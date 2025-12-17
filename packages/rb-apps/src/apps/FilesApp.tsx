// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useEffect, useRef } from 'react';
import type { RedByteApp } from '../types';
import type { Intent } from '@redbyte/rb-shell';

interface FilesProps {
  onClose?: () => void;
  onDispatchIntent?: (intent: Intent) => void;
}

interface FileEntry {
  id: string;
  name: string;
  type: 'folder' | 'file';
  modified: string;
}

interface FolderData {
  id: string;
  name: string;
  entries: FileEntry[];
}

// Mock file system structure
const MOCK_FS: Record<string, FolderData> = {
  home: {
    id: 'home',
    name: 'Home',
    entries: [
      { id: 'desktop-link', name: 'Desktop', type: 'folder', modified: '2025-12-16 10:00' },
      { id: 'documents-link', name: 'Documents', type: 'folder', modified: '2025-12-16 10:00' },
      { id: 'downloads-link', name: 'Downloads', type: 'folder', modified: '2025-12-16 10:00' },
    ],
  },
  desktop: {
    id: 'desktop',
    name: 'Desktop',
    entries: [
      { id: 'project1', name: 'Project Files', type: 'folder', modified: '2025-12-15 14:30' },
      { id: 'notes', name: 'Notes.txt', type: 'file', modified: '2025-12-16 09:15' },
    ],
  },
  documents: {
    id: 'documents',
    name: 'Documents',
    entries: [
      { id: 'reports', name: 'Reports', type: 'folder', modified: '2025-12-14 16:20' },
      { id: 'readme', name: 'README.md', type: 'file', modified: '2025-12-13 11:45' },
      { id: 'config', name: 'config.json', type: 'file', modified: '2025-12-12 08:30' },
    ],
  },
  downloads: {
    id: 'downloads',
    name: 'Downloads',
    entries: [
      { id: 'archive', name: 'archive.zip', type: 'file', modified: '2025-12-11 15:00' },
    ],
  },
  project1: {
    id: 'project1',
    name: 'Project Files',
    entries: [
      { id: 'src', name: 'src', type: 'folder', modified: '2025-12-15 14:30' },
      { id: 'package', name: 'package.json', type: 'file', modified: '2025-12-15 12:00' },
    ],
  },
  reports: {
    id: 'reports',
    name: 'Reports',
    entries: [
      { id: 'q4', name: 'Q4-2024.pdf', type: 'file', modified: '2025-12-14 16:20' },
    ],
  },
};

// Map folder link IDs to actual folders
const FOLDER_LINKS: Record<string, string> = {
  'desktop-link': 'desktop',
  'documents-link': 'documents',
  'downloads-link': 'downloads',
};

const SIDEBAR_ROOTS = [
  { id: 'home', name: 'Home' },
  { id: 'desktop', name: 'Desktop' },
  { id: 'documents', name: 'Documents' },
];

const FilesComponent: React.FC<FilesProps> = ({ onClose, onDispatchIntent }) => {
  const [currentFolderId, setCurrentFolderId] = useState('home');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentFolder = MOCK_FS[currentFolderId] || MOCK_FS.home;
  const entries = currentFolder.entries;

  useEffect(() => {
    setSelectedIndex(0);
  }, [currentFolderId]);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const handleOpenWith = (entry: FileEntry) => {
    if (!onDispatchIntent) return;

    onDispatchIntent({
      type: 'open-with',
      payload: {
        sourceAppId: 'files',
        targetAppId: 'logic-playground',
        resourceId: entry.id,
        resourceType: entry.type,
      },
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose?.();
      return;
    }

    if (entries.length === 0) return;

    // Cmd/Ctrl+Enter: Open in Playground
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      const selected = entries[selectedIndex];
      if (selected && selected.type === 'file') {
        handleOpenWith(selected);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, entries.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = entries[selectedIndex];
      if (selected && selected.type === 'folder') {
        const targetId = FOLDER_LINKS[selected.id] || selected.id;
        if (MOCK_FS[targetId]) {
          setCurrentFolderId(targetId);
        }
      }
    }
  };

  const handleEntryClick = (entry: FileEntry, index: number) => {
    setSelectedIndex(index);
    if (entry.type === 'folder') {
      const targetId = FOLDER_LINKS[entry.id] || entry.id;
      if (MOCK_FS[targetId]) {
        setCurrentFolderId(targetId);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="h-full flex bg-slate-950 text-white"
      style={{ outline: 'none' }}
    >
      {/* Sidebar */}
      <div className="w-48 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-3 border-b border-slate-800">
          <h3 className="text-xs font-semibold text-slate-400 uppercase">Locations</h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {SIDEBAR_ROOTS.map((root) => (
            <button
              key={root.id}
              onClick={() => setCurrentFolderId(root.id)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-800 transition-colors ${
                currentFolderId === root.id ? 'bg-slate-800 text-cyan-400' : 'text-slate-300'
              }`}
            >
              {root.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main pane */}
      <div className="flex-1 flex flex-col">
        <div className="p-3 border-b border-slate-800">
          <h2 className="text-sm font-semibold">{currentFolder.name}</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <p className="text-sm">Empty folder</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-900 sticky top-0">
                <tr>
                  <th className="text-left p-3 text-xs font-medium text-slate-400">Name</th>
                  <th className="text-left p-3 text-xs font-medium text-slate-400">Type</th>
                  <th className="text-left p-3 text-xs font-medium text-slate-400">Modified</th>
                  <th className="text-left p-3 text-xs font-medium text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => {
                  const isSelected = index === selectedIndex;
                  return (
                    <tr
                      key={entry.id}
                      onClick={() => handleEntryClick(entry, index)}
                      className={`border-b border-slate-800 cursor-pointer transition-colors ${
                        isSelected ? 'bg-cyan-900/30 text-cyan-300' : 'hover:bg-slate-850'
                      }`}
                    >
                      <td className="p-3 text-sm">
                        {entry.type === 'folder' ? '📁' : '📄'} {entry.name}
                      </td>
                      <td className="p-3 text-sm text-slate-400">
                        {entry.type === 'folder' ? 'Folder' : 'File'}
                      </td>
                      <td className="p-3 text-sm text-slate-400">{entry.modified}</td>
                      <td className="p-3 text-sm">
                        {entry.type === 'file' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenWith(entry);
                            }}
                            className="text-xs px-2 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white"
                          >
                            Open in Playground
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-2 border-t border-slate-800 text-xs text-slate-500">
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">↑↓</kbd> Navigate{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Enter</kbd> Open{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Cmd/Ctrl+Enter</kbd> Open in Playground{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Esc</kbd> Close
        </div>
      </div>
    </div>
  );
};

export const FilesApp: RedByteApp = {
  manifest: {
    id: 'files',
    name: 'Files',
    iconId: 'files',
    category: 'system',
    defaultSize: { width: 800, height: 600 },
    minSize: { width: 600, height: 400 },
  },
  component: FilesComponent,
};
