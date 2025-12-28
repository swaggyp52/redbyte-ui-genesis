// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Modal, Input } from '@redbyte/rb-primitives';

export interface Workspace {
  id: string;
  name: string;
}

interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  currentWorkspaceId?: string;
  onSelect: (workspaceId: string) => void;
  onClose: () => void;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({
  workspaces,
  currentWorkspaceId,
  onSelect,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredWorkspaces = useMemo(() => {
    if (!query) return workspaces;
    const lowerQuery = query.toLowerCase();
    return workspaces.filter((w) => w.name.toLowerCase().includes(lowerQuery));
  }, [workspaces, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredWorkspaces.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = filteredWorkspaces[selectedIndex];
      if (!selected) return;
      onSelect(selected.id);
      onClose();
      return;
    }
  };

  const handleWorkspaceClick = (workspaceId: string) => {
    onSelect(workspaceId);
    onClose();
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Switch Workspace"
      variant="center"
      size="md"
      closeOnEsc={true}
      closeOnBackdrop={true}
      initialFocusRef={inputRef}
    >
      <div className="space-y-4">
        {/* Search Input */}
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type to filter..."
          size="md"
          aria-label="Filter workspaces"
        />

        {/* Workspace List */}
        <div className="max-h-96 overflow-y-auto">
          {filteredWorkspaces.length === 0 && (
            <div className="text-gray-400 text-center py-8">No workspaces found</div>
          )}

          {filteredWorkspaces.map((workspace, index) => {
            const isSelected = index === selectedIndex;
            const isCurrent = workspace.id === currentWorkspaceId;

            return (
              <button
                key={workspace.id}
                onClick={() => handleWorkspaceClick(workspace.id)}
                className={`
                  w-full text-left px-3 py-2 my-1 rounded flex items-center justify-between
                  transition-colors
                  ${isSelected ? 'bg-slate-700 border border-cyan-500' : 'border border-transparent hover:bg-slate-700/50'}
                  focus:outline-none focus:ring-2 focus:ring-cyan-500
                `}
                role="option"
                aria-selected={isSelected}
              >
                <span className="text-gray-100">{workspace.name}</span>
                {isCurrent && <span className="text-cyan-400 text-sm">(Current)</span>}
              </button>
            );
          })}
        </div>

        {/* Keyboard Hints */}
        <div className="text-gray-400 text-sm space-y-1 pt-3 border-t border-slate-700">
          <div>↑↓: Navigate</div>
          <div>Enter: Switch</div>
          <div>Esc: Cancel</div>
        </div>
      </div>
    </Modal>
  );
};
