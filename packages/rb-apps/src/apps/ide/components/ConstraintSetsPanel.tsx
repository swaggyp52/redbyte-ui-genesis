import React, { useState } from 'react';
import {
  activeConstraintSet,
  type ConstraintSetsDocument,
} from '../constraintSets';
import { parseXdcPins } from '../../../import/xdcImport';

/**
 * Constraint-sets panel — a project may carry several named XDC constraint sets
 * (mirroring Vivado's constrs_1 / constrs_2), with exactly one active. This is
 * the Board & Constraints UI over the store's constraint-set authority: add a
 * set (captured from the current pin assignments), rename, remove, and choose
 * the active one. The active set is what Build & Export packages.
 *
 * Honest boundary: RedByte reads and organizes XDC text; it never runs Vivado
 * or programs a board. The pin counts come from the same bounded XDC reader used
 * across the workbench.
 */

export interface ConstraintSetsPanelProps {
  readonly doc: ConstraintSetsDocument;
  /** Generated XDC for the current pin assignments — seeds a captured set. */
  readonly liveXdcText?: string;
  /** Pins assigned in the live mapping — the implicit active set until one is captured. */
  readonly livePinCount?: number;
  readonly onAdd: (name: string, xdcText: string) => { ok: boolean; error?: string } | void;
  readonly onRemove: (id: string) => void;
  readonly onRename: (id: string, name: string) => { ok: boolean; error?: string } | void;
  readonly onSetActive: (id: string) => void;
}

function pinCount(xdcText: string): number {
  try {
    return Object.keys(parseXdcPins(xdcText).pinEntries).length;
  } catch {
    return 0;
  }
}

export const ConstraintSetsPanel: React.FC<ConstraintSetsPanelProps> = ({
  doc,
  liveXdcText, livePinCount,
  onAdd,
  onRemove,
  onRename,
  onSetActive,
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const active = activeConstraintSet(doc);
  const canCapture = !!liveXdcText && liveXdcText.trim().length > 0;

  const submitAdd = () => {
    const chosen = name.trim() || `Constraint set ${doc.sets.length + 1}`;
    const text = liveXdcText ?? '';
    const result = onAdd(chosen, text);
    if (result && result.ok === false) {
      setError(result.error ?? 'Could not add set');
      return;
    }
    setError(null);
    setName('');
  };

  const submitRename = (id: string) => {
    const result = onRename(id, renameValue.trim());
    if (result && result.ok === false) {
      setError(result.error ?? 'Could not rename set');
      return;
    }
    setError(null);
    setRenamingId(null);
    setRenameValue('');
  };

  return (
    <details className="ide-constraint-sets" data-testid="ide-constraint-sets" aria-label="Constraint sets" open={doc.sets.length > 0}>
      <summary className="ide-constraint-sets-head">
        <span className="ide-constraint-sets-title">Constraint sets</span>
        <span className="ide-constraint-sets-count" data-testid="ide-constraint-sets-count">
          {doc.sets.length} set{doc.sets.length === 1 ? '' : 's'}
        </span>
        {doc.sets.length === 0 ? <span className="ide-constraint-sets-live-note">live mapping is active · packaged as top.xdc</span> : null}
      </summary>
      <p className="ide-constraint-sets-note">
        One set is active at a time and is what Build &amp; Export packages as <code>top.xdc</code>.
      </p>

      {error ? (
        <div className="ide-constraint-sets-error" role="alert" data-testid="ide-constraint-sets-error">
          {error}
        </div>
      ) : null}

      {doc.sets.length === 0 || doc.activeId === null ? (
        <div className="ide-constraint-sets-live" data-testid="ide-constraint-sets-live" aria-label="Live mapping is the active constraints">
          <span className="ide-constraint-sets-live-name">Live mapping</span>
          <code>{livePinCount ?? pinCount(liveXdcText ?? '')} pins</code>
          <span className="ide-constraint-sets-live-note">active · packaged as top.xdc</span>
        </div>
      ) : null}
      {doc.sets.length === 0 ? (
        <p className="ide-constraint-sets-empty" data-testid="ide-constraint-sets-empty">
          Capture the live assignments as a named set to version them.
        </p>
      ) : (
        <ul className="ide-constraint-sets-list">
          {doc.sets.map((set) => {
            const isActive = set.id === doc.activeId;
            const isRenaming = renamingId === set.id;
            return (
              <li
                key={set.id}
                className={`ide-constraint-set-row${isActive ? ' is-active' : ''}`}
                data-testid={`ide-constraint-set-${set.id}`}
                data-active={isActive ? 'true' : 'false'}
              >
                <button
                  type="button"
                  className="ide-constraint-set-activate"
                  data-testid={`ide-constraint-set-activate-${set.id}`}
                  onClick={() => onSetActive(set.id)}
                  aria-pressed={isActive}
                  title={isActive ? 'Active constraint set' : 'Make active'}
                >
                  <span className={`ide-constraint-set-dot${isActive ? ' is-on' : ''}`} aria-hidden="true" />
                  {isActive ? (
                    <span className="ide-constraint-set-active-tag" data-testid={`ide-constraint-set-active-${set.id}`}>
                      Active
                    </span>
                  ) : (
                    <span className="ide-constraint-set-activate-label">Set active</span>
                  )}
                </button>

                {isRenaming ? (
                  <input
                    className="ide-constraint-set-rename-input"
                    data-testid={`ide-constraint-set-rename-input-${set.id}`}
                    value={renameValue}
                    autoFocus
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitRename(set.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onBlur={() => submitRename(set.id)}
                    aria-label={`Rename ${set.name}`}
                  />
                ) : (
                  <span className="ide-constraint-set-name" data-testid={`ide-constraint-set-name-${set.id}`}>
                    {set.name}
                  </span>
                )}

                <span className="ide-constraint-set-pins" data-testid={`ide-constraint-set-pins-${set.id}`}>
                  {pinCount(set.xdcText)} {pinCount(set.xdcText) === 1 ? 'pin' : 'pins'}
                </span>

                <span className="ide-constraint-set-ops">
                  <button
                    type="button"
                    className="ide-constraint-set-rename"
                    data-testid={`ide-constraint-set-rename-${set.id}`}
                    onClick={() => {
                      setRenamingId(set.id);
                      setRenameValue(set.name);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="ide-constraint-set-remove"
                    data-testid={`ide-constraint-set-remove-${set.id}`}
                    onClick={() => onRemove(set.id)}
                  >
                    Remove
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="ide-constraint-sets-add">
        <input
          className="ide-constraint-sets-add-name"
          data-testid="ide-constraint-sets-add-name"
          value={name}
          placeholder="New set name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canCapture) submitAdd();
          }}
          aria-label="New constraint set name"
        />
        <button
          type="button"
          className="ide-constraint-sets-add-btn"
          data-testid="ide-constraint-sets-add"
          onClick={submitAdd}
          disabled={!canCapture}
          title={canCapture ? 'Capture the current pin assignments as a set' : 'Assign at least one pin first'}
        >
          Capture current pins as set
        </button>
      </div>

      {active ? (
        <details className="ide-constraint-sets-preview" data-testid="ide-constraint-sets-active-preview">
          <summary>
            Active: <strong>{active.name}</strong> · {pinCount(active.xdcText)} pins
          </summary>
          <pre className="ide-constraint-sets-xdc" data-testid="ide-constraint-sets-active-xdc">
            {active.xdcText.trim() || '(no constraint text)'}
          </pre>
        </details>
      ) : null}
    </details>
  );
};
