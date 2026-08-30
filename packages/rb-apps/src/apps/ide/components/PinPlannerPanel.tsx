import React, { useMemo, useRef, useState } from 'react';
import type { HardwareMappingDocumentV2 } from '@redbyte/rb-utils';
import {
  buildPinPlannerSummary,
  type PinAssignmentRow,
} from '../hardwarePinPlanner';
import {
  readAssignmentPin,
  type HardwareMappingV2EditOperation,
} from '../hardwareMappingV2EditorModel';
import { buildPlannerXdcLines, diffXdc } from '../hardwareXdcPreview';

/**
 * Pin Planner — an electrically-aware assignment table over the mapping
 * authority (`hardwareMappingV2`). It renders every design assignment with its
 * Basys3 board resource, flags pin conflicts and electrical issues, offers
 * one-click conflict repair, shows the exact XDC before/after of the last pin
 * edit, and a one-action undo. It never owns mapping truth — every edit is an
 * op dispatched back through `onEdit`.
 */

export interface PinPlannerPanelProps {
  readonly doc: HardwareMappingDocumentV2;
  readonly onEdit: (operation: HardwareMappingV2EditOperation) => void;
}

interface LastEdit {
  entryId: string;
  bitIndex?: number;
  previousPin: string;
  beforeLines: string[];
}

function assignmentKey(row: Pick<PinAssignmentRow, 'entryId' | 'bitIndex'>): string {
  return row.bitIndex === undefined ? row.entryId : `${row.entryId}:${row.bitIndex}`;
}

export const PinPlannerPanel: React.FC<PinPlannerPanelProps> = ({ doc, onEdit }) => {
  const summary = useMemo(() => buildPinPlannerSummary(doc), [doc]);
  const currentLines = useMemo(() => buildPlannerXdcLines(doc), [doc]);

  // One-step edit memory for the XDC before/after preview + undo.
  const [lastEdit, setLastEdit] = useState<LastEdit | null>(null);
  // Draft text per assignment while the engineer types (UI interaction state).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const docRef = useRef(doc);
  docRef.current = doc;

  const conflictPins = useMemo(
    () => new Set(summary.conflicts.map((conflict) => conflict.pin.toUpperCase())),
    [summary.conflicts]
  );
  const issuesByKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const issue of summary.issues) {
      const key = assignmentKey(issue);
      const list = map.get(key) ?? [];
      list.push(issue.message);
      map.set(key, list);
    }
    return map;
  }, [summary.issues]);

  const commitPin = (row: PinAssignmentRow, nextPin: string) => {
    const previousPin = readAssignmentPin(
      doc.entries.find((entry) => entry.id === row.entryId)!,
      row.bitIndex
    );
    const normalized = nextPin.trim().toUpperCase();
    if (normalized === previousPin.trim().toUpperCase()) return;
    setLastEdit({
      entryId: row.entryId,
      bitIndex: row.bitIndex,
      previousPin,
      beforeLines: buildPlannerXdcLines(docRef.current),
    });
    onEdit({ type: 'set_bit_pin', entryId: row.entryId, bitIndex: row.bitIndex, pin: normalized });
  };

  const undoLast = () => {
    if (!lastEdit) return;
    onEdit({
      type: 'set_bit_pin',
      entryId: lastEdit.entryId,
      bitIndex: lastEdit.bitIndex,
      pin: lastEdit.previousPin,
    });
    setLastEdit(null);
  };

  const resolveConflict = (pin: string, keep: { entryId: string; bitIndex?: number }) => {
    setLastEdit(null);
    onEdit({ type: 'resolve_conflict', pin, keep });
  };

  const xdcDiff = lastEdit ? diffXdc(lastEdit.beforeLines, currentLines) : null;

  return (
    <section className="ide-pin-planner" data-testid="ide-pin-planner" aria-label="Pin planner">
      <header className="ide-pin-planner-head">
        <div>
          <p className="ide-surface-block-label">Pin planner</p>
          <h4>Electrical assignment</h4>
        </div>
        <div className="ide-pin-planner-stats">
          <span data-testid="ide-pin-planner-mapped">
            {summary.mappedCount}/{summary.totalCount} mapped
          </span>
          <span
            className={summary.conflicts.length > 0 ? 'is-conflict' : ''}
            data-testid="ide-pin-planner-conflict-count"
          >
            {summary.conflicts.length} conflict{summary.conflicts.length === 1 ? '' : 's'}
          </span>
          {lastEdit ? (
            <button
              type="button"
              className="ide-pin-planner-undo"
              data-testid="ide-pin-planner-undo"
              onClick={undoLast}
            >
              Undo pin change
            </button>
          ) : null}
        </div>
      </header>

      {summary.conflicts.length > 0 ? (
        <div className="ide-pin-planner-conflicts" data-testid="ide-pin-planner-conflicts">
          {summary.conflicts.map((conflict) => (
            <div
              key={conflict.pin}
              className="ide-pin-planner-conflict"
              data-testid={`ide-pin-planner-conflict-${conflict.pin}`}
            >
              <span className="ide-pin-planner-conflict-pin">{conflict.pin}</span>
              <span className="ide-pin-planner-conflict-signals">
                {conflict.rows.map((row) => row.label).join(' ↔ ')}
              </span>
              <button
                type="button"
                className="ide-pin-planner-resolve"
                data-testid={`ide-pin-planner-resolve-${conflict.pin}`}
                onClick={() =>
                  resolveConflict(conflict.pin, {
                    entryId: conflict.rows[0].entryId,
                    bitIndex: conflict.rows[0].bitIndex,
                  })
                }
              >
                Keep {conflict.rows[0].label}, clear others
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="ide-pin-planner-table-scroll">
        <table className="ide-pin-planner-table" data-testid="ide-pin-planner-table">
          <thead>
            <tr>
              <th>Signal</th>
              <th>Dir</th>
              <th>Pin</th>
              <th>Board resource</th>
              <th>IO std</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((row) => {
              const key = assignmentKey(row);
              const isConflict = row.pin ? conflictPins.has(row.pin.toUpperCase()) : false;
              const issues = issuesByKey.get(key) ?? [];
              const draft = drafts[key];
              return (
                <tr
                  key={key}
                  className={`ide-pin-planner-row${isConflict ? ' is-conflict' : ''}${issues.length ? ' has-issue' : ''}`}
                  data-testid={`ide-pin-planner-row-${key}`}
                >
                  <td className="ide-pin-planner-label"><code>{row.label}</code></td>
                  <td className="ide-pin-planner-dir">{row.direction === 'in' ? 'in' : 'out'}</td>
                  <td>
                    <input
                      type="text"
                      className="ide-pin-planner-pin-input"
                      data-testid={`ide-pin-planner-pin-input-${key}`}
                      aria-label={`Pin for ${row.label}`}
                      value={draft ?? row.pin}
                      placeholder="—"
                      onChange={(event) =>
                        setDrafts((prev) => ({ ...prev, [key]: event.target.value.toUpperCase() }))
                      }
                      onBlur={() => {
                        if (draft !== undefined) {
                          commitPin(row, draft);
                          setDrafts((prev) => {
                            const next = { ...prev };
                            delete next[key];
                            return next;
                          });
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.currentTarget.blur();
                        }
                      }}
                    />
                  </td>
                  <td className="ide-pin-planner-resource">
                    {row.resource ? `${row.resource.label} · ${row.resource.packagePin}` : row.pin ? 'unknown' : '—'}
                  </td>
                  <td className="ide-pin-planner-iostd">{row.resource?.ioStandard ?? (row.pin ? '—' : '')}</td>
                  <td className="ide-pin-planner-status">
                    {isConflict ? (
                      <span className="ide-pin-planner-badge is-conflict" data-testid={`ide-pin-planner-status-${key}`}>
                        conflict
                      </span>
                    ) : issues.length > 0 ? (
                      <span
                        className="ide-pin-planner-badge is-issue"
                        title={issues.join('\n')}
                        data-testid={`ide-pin-planner-status-${key}`}
                      >
                        check
                      </span>
                    ) : row.pin ? (
                      <span className="ide-pin-planner-badge is-ok" data-testid={`ide-pin-planner-status-${key}`}>
                        ok
                      </span>
                    ) : (
                      <span className="ide-pin-planner-badge is-empty" data-testid={`ide-pin-planner-status-${key}`}>
                        open
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {xdcDiff && xdcDiff.changed ? (
        <div className="ide-pin-planner-xdc" data-testid="ide-pin-planner-xdc-diff">
          <p className="ide-pin-planner-xdc-title">
            XDC change · +{xdcDiff.addedCount} −{xdcDiff.removedCount}
          </p>
          <pre className="ide-pin-planner-xdc-body">
            {xdcDiff.lines
              .filter((line) => line.status !== 'unchanged')
              .map((line, index) => (
                <span
                  key={index}
                  className={`ide-pin-planner-xdc-line is-${line.status}`}
                  data-testid={`ide-pin-planner-xdc-${line.status}`}
                >
                  {line.status === 'added' ? '+ ' : '- '}
                  {line.line}
                  {'\n'}
                </span>
              ))}
          </pre>
        </div>
      ) : null}
    </section>
  );
};
