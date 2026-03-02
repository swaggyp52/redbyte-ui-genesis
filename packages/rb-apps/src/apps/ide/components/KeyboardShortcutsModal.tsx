import React from 'react';

interface ShortcutRow {
  action: string;
  keys: string;
}

const SHORTCUTS: ShortcutRow[] = [
  { action: 'Select tool', keys: 'S' },
  { action: 'Wire tool', keys: 'W' },
  { action: 'Toggle grid snap', keys: 'G' },
  { action: 'Rotate selected gate', keys: 'R' },
  { action: 'Delete selected', keys: 'Delete / Backspace' },
  { action: 'Select all', keys: 'Ctrl+A' },
  { action: 'Undo', keys: 'Ctrl+Z' },
  { action: 'Redo', keys: 'Ctrl+Shift+Z' },
  { action: 'Save project', keys: 'Ctrl+S' },
  { action: 'Escape / deselect', keys: 'Esc' },
  { action: 'Pan canvas', keys: 'Space+drag' },
  { action: 'Switch to Design', keys: '1' },
  { action: 'Switch to Verify', keys: '2' },
  { action: 'Switch to Export', keys: '3' },
  { action: 'Switch to Hardware', keys: '4' },
  { action: 'Switch to Import', keys: '5' },
];

export interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ onClose }) => {
  return (
    <div
      className="ide-shortcuts-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="ide-shortcuts-modal"
    >
      <div className="ide-shortcuts-card">
        <div className="ide-shortcuts-header">
          <h2 className="ide-shortcuts-title">Keyboard Shortcuts</h2>
          <button
            className="ide-shortcuts-close"
            onClick={onClose}
            aria-label="Close shortcuts"
            data-testid="ide-shortcuts-close"
          >
            ✕
          </button>
        </div>
        <table className="ide-shortcuts-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Keys</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.map((row) => (
              <tr key={row.action}>
                <td>{row.action}</td>
                <td><kbd className="ide-kbd">{row.keys}</kbd></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
