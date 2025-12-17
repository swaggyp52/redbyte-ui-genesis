// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useRef, useState, useMemo } from 'react';

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
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #5b8cff',
          borderRadius: 8,
          padding: '1rem',
          minWidth: 400,
          maxWidth: 600,
          maxHeight: '80vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 1rem 0', color: '#fff' }}>Switch Workspace</h2>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type to filter..."
          style={{
            width: '100%',
            padding: '0.5rem',
            marginBottom: '1rem',
            backgroundColor: '#2a2a2a',
            border: '1px solid #5b8cff',
            borderRadius: 4,
            color: '#fff',
            outline: 'none',
          }}
        />

        {filteredWorkspaces.length === 0 && (
          <div style={{ color: '#999', padding: '1rem', textAlign: 'center' }}>
            No workspaces found
          </div>
        )}

        {filteredWorkspaces.map((workspace, index) => {
          const isSelected = index === selectedIndex;
          const isCurrent = workspace.id === currentWorkspaceId;

          return (
            <div
              key={workspace.id}
              onClick={() => handleWorkspaceClick(workspace.id)}
              style={{
                padding: '0.75rem',
                margin: '0.25rem 0',
                backgroundColor: isSelected ? '#2a2a2a' : 'transparent',
                border: `1px solid ${isSelected ? '#5b8cff' : 'transparent'}`,
                borderRadius: 4,
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{workspace.name}</span>
              {isCurrent && (
                <span style={{ color: '#5b8cff', fontSize: '0.875rem' }}>
                  (Current)
                </span>
              )}
            </div>
          );
        })}

        <div style={{ marginTop: '1rem', color: '#999', fontSize: '0.875rem' }}>
          <div>↑↓: Navigate</div>
          <div>Enter: Switch</div>
          <div>Esc: Cancel</div>
        </div>
      </div>
    </div>
  );
};
