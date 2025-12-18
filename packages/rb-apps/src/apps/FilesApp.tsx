// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useEffect, useRef } from 'react';
import type { RedByteApp } from '../types';
import type { Intent } from '@redbyte/rb-shell';
import {
  createInitialFsState,
  createFolder,
  createFile,
  renameEntry,
  deleteEntry,
  getChildren,
  getPath,
  resolveFolderLink,
  getFallbackFolderId,
} from './files/fsModel';
import type { FileSystemState, FileEntry } from './files/fsTypes';
import { TextInputModal, ConfirmModal, OpenWithModal } from './files/modals';
import {
  getFileActionTargets,
  isFileActionEligible,
  type FileActionTarget,
} from './files/fileActionTargets';
import { resolveDefaultTarget } from '../stores/fileAssociationsStore';

interface FilesProps {
  onClose?: () => void;
  onDispatchIntent?: (intent: Intent) => void;
}

const SIDEBAR_ROOTS = [
  { id: 'home', name: 'Home' },
  { id: 'desktop', name: 'Desktop' },
  { id: 'documents', name: 'Documents' },
];

type ModalType = 'create-folder' | 'create-file' | 'rename' | 'delete' | 'open-with';

interface ModalState {
  type: ModalType;
  targetId?: string;
  targets?: FileActionTarget[];
  resourceType?: 'file' | 'folder';
  extension?: string;
}

const FilesComponent: React.FC<FilesProps> = ({ onClose, onDispatchIntent }) => {
  const [fs, setFs] = useState<FileSystemState>(() => createInitialFsState());
  const [currentFolderId, setCurrentFolderId] = useState('home');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [backStack, setBackStack] = useState<string[]>([]);
  const [forwardStack, setForwardStack] = useState<string[]>([]);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [modalValue, setModalValue] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const entries = getChildren(currentFolderId, fs);
  const breadcrumbPath = getPath(currentFolderId, fs);

  useEffect(() => {
    setSelectedIndex(0);
  }, [currentFolderId]);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Centralized navigation helper
  const navigateTo = (targetId: string, fromHistory = false) => {
    if (!fs.folders[targetId]) return;

    if (!fromHistory) {
      // Push current folder onto back stack
      setBackStack((prev) => [...prev, currentFolderId]);
      // Clear forward stack on new navigation
      setForwardStack([]);
    }

    setCurrentFolderId(targetId);
  };

  const goBack = () => {
    if (backStack.length === 0) return;

    const targetId = backStack[backStack.length - 1];
    setBackStack((prev) => prev.slice(0, -1));
    setForwardStack((prev) => [...prev, currentFolderId]);
    setCurrentFolderId(targetId);
  };

  const goForward = () => {
    if (forwardStack.length === 0) return;

    const targetId = forwardStack[forwardStack.length - 1];
    setForwardStack((prev) => prev.slice(0, -1));
    setBackStack((prev) => [...prev, currentFolderId]);
    setCurrentFolderId(targetId);
  };

  const handleOpenWith = (entry: FileEntry, targetAppId: string) => {
    if (!onDispatchIntent) return;

    onDispatchIntent({
      type: 'open-with',
      payload: {
        sourceAppId: 'files',
        targetAppId,
        resourceId: entry.id,
        resourceType: entry.type,
      },
    });
  };

  const openOpenWithModal = () => {
    if (entries.length === 0) return;
    const selected = entries[selectedIndex];
    if (!selected) return;

    // Only files are eligible for file actions
    if (!isFileActionEligible(selected)) return;

    const targets = getFileActionTargets(selected);

    // Extract extension from filename (everything after last dot)
    const extension = selected.name.includes('.')
      ? selected.name.split('.').pop() || ''
      : '';

    setModal({
      type: 'open-with',
      targetId: selected.id,
      targets,
      resourceType: selected.type,
      extension,
    });
  };

  // Operation handlers
  const openCreateFolderModal = () => {
    setModal({ type: 'create-folder' });
    setModalValue('New Folder');
    setModalError(null);
  };

  const openCreateFileModal = () => {
    setModal({ type: 'create-file' });
    setModalValue('New File.txt');
    setModalError(null);
  };

  const openRenameModal = () => {
    if (entries.length === 0) return;
    const selected = entries[selectedIndex];
    if (!selected) return;

    // Check if root folder (resolve link first)
    const resolvedId = resolveFolderLink(selected.id);
    if (fs.roots.includes(resolvedId)) return;

    setModal({ type: 'rename', targetId: selected.id });
    setModalValue(selected.name);
    setModalError(null);
  };

  const openDeleteModal = () => {
    if (entries.length === 0) return;
    const selected = entries[selectedIndex];
    if (!selected) return;

    // Check if root folder (resolve link first)
    const resolvedId = resolveFolderLink(selected.id);
    if (fs.roots.includes(resolvedId)) return;

    setModal({ type: 'delete', targetId: selected.id });
  };

  const handleOpenWithSelect = (target: FileActionTarget) => {
    if (!modal || modal.type !== 'open-with' || !modal.targetId) return;

    const entry = entries.find((e) => e.id === modal.targetId);
    if (!entry) return;

    handleOpenWith(entry, target.appId);
    setModal(null);
  };

  const handleModalConfirm = () => {
    if (!modal) return;

    try {
      if (modal.type === 'create-folder') {
        const newFs = createFolder(currentFolderId, modalValue, fs);
        setFs(newFs);
        setModal(null);
      } else if (modal.type === 'create-file') {
        const newFs = createFile(currentFolderId, modalValue, fs);
        setFs(newFs);
        setModal(null);
      } else if (modal.type === 'rename' && modal.targetId) {
        const newFs = renameEntry(modal.targetId, modalValue, fs);
        setFs(newFs);
        setModal(null);
      } else if (modal.type === 'delete' && modal.targetId) {
        const newFs = deleteEntry(modal.targetId, fs);
        setFs(newFs);

        // Navigate to fallback if deleting current folder
        if (modal.targetId === currentFolderId) {
          const fallbackId = getFallbackFolderId(currentFolderId, fs);
          setCurrentFolderId(fallbackId);
        }

        // Clamp selection index
        const newEntries = getChildren(currentFolderId, newFs);
        if (selectedIndex >= newEntries.length) {
          setSelectedIndex(Math.max(0, newEntries.length - 1));
        }

        setModal(null);
      }
    } catch (error) {
      if (error instanceof Error) {
        setModalError(error.message);
      }
    }
  };

  const handleModalCancel = () => {
    setModal(null);
    setModalValue('');
    setModalError(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Guard: ignore if event target is input/textarea
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }

    // Escape priority: modal first, then window
    if (event.key === 'Escape') {
      event.preventDefault();
      if (modal) {
        handleModalCancel();
      } else {
        onClose?.();
      }
      return;
    }

    // When modal is open, block all other shortcuts
    if (modal) {
      return;
    }

    // Alt+Left: Back
    if (event.altKey && event.key === 'ArrowLeft') {
      event.preventDefault();
      goBack();
      return;
    }

    // Alt+Right: Forward
    if (event.altKey && event.key === 'ArrowRight') {
      event.preventDefault();
      goForward();
      return;
    }

    // Cmd/Ctrl+Shift+N: Create Folder
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'N') {
      event.preventDefault();
      openCreateFolderModal();
      return;
    }

    // Cmd/Ctrl+N: Create File
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key === 'n') {
      event.preventDefault();
      openCreateFileModal();
      return;
    }

    // F2: Rename
    if (event.key === 'F2') {
      event.preventDefault();
      openRenameModal();
      return;
    }

    // Delete: Delete entry
    if (event.key === 'Delete') {
      event.preventDefault();
      openDeleteModal();
      return;
    }

    if (entries.length === 0) return;

    // Cmd/Ctrl+Shift+Enter: Open With... modal
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      openOpenWithModal();
      return;
    }

    // Cmd/Ctrl+Enter: Open with default target (uses file associations + fallback)
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      const selected = entries[selectedIndex];

      // Only files are eligible for default-open behavior
      if (!selected || !isFileActionEligible(selected)) return;

      // Get eligible targets for this file
      const eligibleTargets = getFileActionTargets(selected);
      if (eligibleTargets.length === 0) return; // No targets available

      // Extract extension from filename (everything after last dot)
      const extension = selected.name.includes('.')
        ? selected.name.split('.').pop() || ''
        : '';

      // Resolve default target (uses saved default or falls back to first eligible)
      const targetId = resolveDefaultTarget(selected.type, extension, eligibleTargets);

      // Find the target's appId
      const target = eligibleTargets.find((t) => t.id === targetId);
      if (target) {
        handleOpenWith(selected, target.appId);
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
        const targetId = resolveFolderLink(selected.id);
        navigateTo(targetId);
      }
    }
  };

  const handleEntryClick = (entry: FileEntry, index: number) => {
    setSelectedIndex(index);
    if (entry.type === 'folder') {
      const targetId = resolveFolderLink(entry.id);
      navigateTo(targetId);
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
              onClick={() => navigateTo(root.id)}
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
        {/* Header with back/forward + breadcrumbs */}
        <div className="p-3 border-b border-slate-800 flex items-center gap-2">
          {/* Back/Forward buttons */}
          <button
            onClick={goBack}
            disabled={backStack.length === 0}
            className="px-2 py-1 text-sm rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Back (Alt+Left)"
          >
            ←
          </button>
          <button
            onClick={goForward}
            disabled={forwardStack.length === 0}
            className="px-2 py-1 text-sm rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Forward (Alt+Right)"
          >
            →
          </button>

          {/* Breadcrumb navigation */}
          <div className="flex items-center gap-1 text-sm flex-1">
            {breadcrumbPath.map((segment, index) => (
              <React.Fragment key={segment.id}>
                {index > 0 && <span className="text-slate-600">/</span>}
                <button
                  onClick={() => navigateTo(segment.id)}
                  className={`px-2 py-1 rounded transition-colors ${
                    segment.id === currentFolderId
                      ? 'text-cyan-400 font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {segment.name}
                </button>
              </React.Fragment>
            ))}
          </div>
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
                              handleOpenWith(entry, 'logic-playground');
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

        <div className="p-2 border-t border-slate-800 text-xs text-slate-500 flex items-center justify-between">
          <div>
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">↑↓</kbd> Navigate{' '}
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Enter</kbd> Open{' '}
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Alt+←→</kbd> Back/Forward
          </div>
          <div>
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Ctrl/Cmd+N</kbd> New File{' '}
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Ctrl/Cmd+Shift+N</kbd> New Folder{' '}
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">F2</kbd> Rename{' '}
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Del</kbd> Delete{' '}
            <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Ctrl/Cmd+Shift+Enter</kbd> Open With...
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal && modal.type === 'create-folder' && (
        <TextInputModal
          title="Create Folder"
          label="Folder name"
          value={modalValue}
          error={modalError}
          onValueChange={setModalValue}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
          confirmDisabled={!modalValue.trim()}
        />
      )}

      {modal && modal.type === 'create-file' && (
        <TextInputModal
          title="Create File"
          label="File name"
          value={modalValue}
          error={modalError}
          onValueChange={setModalValue}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
          confirmDisabled={!modalValue.trim()}
        />
      )}

      {modal && modal.type === 'rename' && (
        <TextInputModal
          title="Rename"
          label="New name"
          value={modalValue}
          error={modalError}
          onValueChange={setModalValue}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
          confirmDisabled={!modalValue.trim()}
        />
      )}

      {modal && modal.type === 'delete' && modal.targetId && (
        <ConfirmModal
          title="Delete"
          message={`Are you sure you want to delete "${entries.find((e) => e.id === modal.targetId)?.name}"? ${
            entries.find((e) => e.id === modal.targetId)?.type === 'folder'
              ? 'This will delete all contents recursively.'
              : ''
          }`}
          onConfirm={handleModalConfirm}
          onCancel={handleModalCancel}
        />
      )}

      {modal && modal.type === 'open-with' && modal.targets && modal.resourceType && modal.extension !== undefined && (
        <OpenWithModal
          targets={modal.targets}
          resourceType={modal.resourceType}
          extension={modal.extension}
          onSelect={handleOpenWithSelect}
          onCancel={handleModalCancel}
        />
      )}
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
