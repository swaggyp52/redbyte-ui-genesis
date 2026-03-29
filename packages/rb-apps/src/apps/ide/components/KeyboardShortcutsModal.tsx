import React, { useEffect } from 'react';

interface ShortcutRow {
  action: string;
  keys: string;
}

interface ShortcutSection {
  label: string;
  rows: ShortcutRow[];
}

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    label: 'Global',
    rows: [
      { action: 'Switch to Design', keys: '1' },
      { action: 'Switch to Verify', keys: '2' },
      { action: 'Switch to Export', keys: '3' },
      { action: 'Switch to Map Pins', keys: '4' },
      { action: 'Switch to Import', keys: '5' },
      { action: 'Save project', keys: 'Ctrl+S' },
      { action: 'Undo', keys: 'Ctrl+Z' },
      { action: 'Redo', keys: 'Ctrl+Shift+Z' },
      { action: 'Keyboard shortcuts', keys: '?' },
    ],
  },
  {
    label: 'Design',
    rows: [
      { action: 'Select tool', keys: 'S' },
      { action: 'Wire tool', keys: 'W' },
      { action: 'Toggle grid snap', keys: 'G' },
      { action: 'Rotate selected gate', keys: 'R' },
      { action: 'Delete selected', keys: 'Delete / Backspace' },
      { action: 'Select all', keys: 'Ctrl+A' },
      { action: 'Copy selection', keys: 'Ctrl+C' },
      { action: 'Paste', keys: 'Ctrl+V' },
      { action: 'Duplicate selection', keys: 'Ctrl+D' },
      { action: 'Escape / deselect', keys: 'Esc' },
      { action: 'Pan canvas', keys: 'Space+drag' },
    ],
  },
  {
    label: 'Verify',
    rows: [
      { action: 'Next failure', keys: 'J / \u2193' },
      { action: 'Previous failure', keys: 'K / \u2191' },
      { action: 'Fit waveform to view', keys: 'F' },
      { action: 'Step through ticks', keys: '\u2190 / \u2192' },
    ],
  },
];

export interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ onClose }) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

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
            {SHORTCUT_SECTIONS.map((section) => (
              <React.Fragment key={section.label}>
                <tr className="ide-shortcuts-section-row" data-testid={`ide-shortcuts-section-${section.label.toLowerCase()}`}>
                  <td colSpan={2} className="ide-shortcuts-section-label">{section.label}</td>
                </tr>
                {section.rows.map((row) => (
                  <tr key={row.action}>
                    <td>{row.action}</td>
                    <td><kbd className="ide-kbd">{row.keys}</kbd></td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
