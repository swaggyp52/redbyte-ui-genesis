import React, { useCallback, useMemo, useState } from 'react';
import type { BusDeclaration } from '@redbyte/rb-logic-core';
import { IdeButton } from './IdePrimitives';
import {
  groupIoRowsIntoBuses,
  planBusAssignment,
  type BusAssignmentPreviewEntry,
  type IoBusGroup,
} from '../ioBusGrouping';
import { getBasys3BoardResource } from '../../../fpga/boards/basys3/basys3Pins';

interface PlannerRow {
  id: string;
  label: string;
  direction: 'in' | 'out';
  pin: string;
  nodeId?: string;
}

export interface HardwareBusPlannerProps {
  rows: readonly PlannerRow[];
  /** First-class bus declarations; when present they own the grouping. */
  declaredBuses?: readonly BusDeclaration[];
  onSetMappingPin?: (rowId: string, packagePin: string) => void;
}

interface AppliedSnapshot {
  baseName: string;
  previousPins: { rowId: string; label: string; pin: string }[];
}

/**
 * Bulk bus mapping over the explicit `Base[N]` label convention — the same
 * convention Build & Export vectorizes, so a bus planned here ships as one
 * VHDL vector. Each apply is previewed member-by-member first and can be
 * reverted as a single action.
 */
export const HardwareBusPlanner: React.FC<HardwareBusPlannerProps> = ({ rows, declaredBuses, onSetMappingPin }) => {
  const groups = useMemo(() => groupIoRowsIntoBuses(rows, declaredBuses), [rows, declaredBuses]);
  const ownerByPin = useMemo(() => {
    const owners = new Map<string, { rowId: string; label: string }>();
    for (const row of rows) {
      const pin = row.pin.trim();
      if (pin) owners.set(pin, { rowId: row.id, label: row.label });
    }
    return owners;
  }, [rows]);

  const [activeBase, setActiveBase] = useState<string | null>(null);
  const [startIndex, setStartIndex] = useState(0);
  const [reverse, setReverse] = useState(false);
  const [lastApplied, setLastApplied] = useState<AppliedSnapshot | null>(null);

  const activeGroup: IoBusGroup | null = useMemo(() => {
    if (groups.length === 0) return null;
    return groups.find((group) => group.baseName === activeBase) ?? groups[0];
  }, [activeBase, groups]);

  const preview: BusAssignmentPreviewEntry[] = useMemo(() => {
    if (!activeGroup) return [];
    return planBusAssignment({
      group: activeGroup,
      familyPrefix: activeGroup.direction === 'in' ? 'SW' : 'LD',
      startIndex,
      reverse,
      resolveResource: (alias) => {
        const resource = getBasys3BoardResource(alias);
        return resource ? { packagePin: resource.packagePin } : null;
      },
      ownerByPin,
    });
  }, [activeGroup, ownerByPin, reverse, startIndex]);

  const blockedEntries = preview.filter((entry) => entry.state === 'occupied' || entry.state === 'unavailable');
  const applyCount = preview.filter((entry) => entry.state === 'ok').length;
  const alreadyHereCount = preview.filter((entry) => entry.state === 'already-assigned-here').length;
  const allAlreadyMapped = preview.length > 0 && alreadyHereCount === preview.length;
  // The primary action's label reflects what pressing it does, so it is never
  // the useless "Assign 0 pins": a fully-mapped bus reads as mapped (with
  // Reverse/Revert to change it), a blocked plan names the block, and only a
  // genuinely assignable plan invites assignment.
  const applyLabel = allAlreadyMapped
    ? 'Bus already mapped'
    : applyCount === 0
      ? blockedEntries.length > 0
        ? 'Resolve conflicts to assign'
        : 'No pins to assign'
      : `Assign ${applyCount} pin${applyCount === 1 ? '' : 's'}`;

  const applyPlan = useCallback(() => {
    if (!activeGroup || !onSetMappingPin || blockedEntries.length > 0) return;
    const previousPins = activeGroup.members.map((member) => ({
      rowId: member.rowId,
      label: member.label,
      pin: member.pin ?? '',
    }));
    for (const entry of preview) {
      if (entry.packagePin && entry.state !== 'already-assigned-here') {
        onSetMappingPin(entry.rowId, entry.packagePin);
      }
    }
    setLastApplied({ baseName: activeGroup.baseName, previousPins });
  }, [activeGroup, blockedEntries.length, onSetMappingPin, preview]);

  const revertPlan = useCallback(() => {
    if (!lastApplied || !onSetMappingPin) return;
    for (const previous of lastApplied.previousPins) {
      onSetMappingPin(previous.rowId, previous.pin);
    }
    setLastApplied(null);
  }, [lastApplied, onSetMappingPin]);

  if (groups.length === 0) return null;

  return (
    <section className="ide-hw-bus-planner" data-testid="ide-hw-bus-planner" aria-label="Bus mapping">
      <header className="ide-hw-bus-planner__header">
        <div>
          <p className="ide-surface-block-label">Bus mapping</p>
          <h4>
            {groups.length === 1
              ? `${groups[0].baseName}[${groups[0].msb}:${groups[0].lsb}]`
              : 'Map a whole bus in one step'}
          </h4>
        </div>
        {groups.length > 1 ? (
          <label className="ide-hw-bus-planner__group-pick">
            Bus
            <select
              value={activeGroup?.baseName ?? ''}
              onChange={(event) => {
                setActiveBase(event.target.value);
                setLastApplied(null);
              }}
              data-testid="ide-hw-bus-planner-pick"
            >
              {groups.map((group) => (
                <option key={`${group.baseName}-${group.direction}`} value={group.baseName}>
                  {group.baseName}[{group.msb}:{group.lsb}] · {group.direction === 'in' ? 'inputs' : 'outputs'}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      {activeGroup ? (
        <>
          <div className="ide-hw-bus-planner__controls">
            <label>
              Start at {activeGroup.direction === 'in' ? 'SW' : 'LD'}
              <input
                type="number"
                min={0}
                max={15}
                value={startIndex}
                onChange={(event) => setStartIndex(Math.max(0, Number.parseInt(event.target.value || '0', 10)))}
                data-testid="ide-hw-bus-planner-start"
                aria-label="Starting board index"
              />
            </label>
            <label className="ide-hw-bus-planner__reverse">
              <input
                type="checkbox"
                checked={reverse}
                onChange={(event) => setReverse(event.target.checked)}
                data-testid="ide-hw-bus-planner-reverse"
              />
              Reverse (MSB first)
            </label>
            {!activeGroup.contiguous ? (
              <span className="ide-hw-bus-planner__warn">
                Bit indices have gaps — members map in index order.
              </span>
            ) : null}
          </div>

          <ul className="ide-hw-bus-planner__preview" data-testid="ide-hw-bus-planner-preview">
            {preview.map((entry) => (
              <li key={entry.rowId} data-state={entry.state}>
                <code>{entry.label}</code>
                <span aria-hidden="true">→</span>
                <code>{entry.resourceAlias}</code>
                <small>
                  {entry.state === 'occupied'
                    ? `held by ${entry.occupiedBy}`
                    : entry.state === 'unavailable'
                      ? 'no such resource'
                      : entry.state === 'already-assigned-here'
                        ? 'already assigned'
                        : (entry.packagePin ?? '')}
                </small>
              </li>
            ))}
          </ul>

          <div className="ide-hw-bus-planner__actions">
            {allAlreadyMapped ? (
              <span className="ide-hw-bus-planner__mapped" data-testid="ide-hw-bus-planner-mapped">
                {applyLabel} — use Reverse to flip bit order, or Revert to undo.
              </span>
            ) : (
              <IdeButton
                tone="primary"
                onClick={applyPlan}
                disabled={!onSetMappingPin || blockedEntries.length > 0 || applyCount === 0}
                testId="ide-hw-bus-planner-apply"
              >
                {applyLabel}
              </IdeButton>
            )}
            {lastApplied && lastApplied.baseName === activeGroup.baseName ? (
              <IdeButton tone="ghost" onClick={revertPlan} testId="ide-hw-bus-planner-revert">
                Revert bus assignment
              </IdeButton>
            ) : null}
            {blockedEntries.length > 0 ? (
              <span className="ide-hw-bus-planner__blocked" data-testid="ide-hw-bus-planner-blocked">
                {blockedEntries.length} target{blockedEntries.length === 1 ? '' : 's'} blocked — pick another
                start index or clear the holding signals first.
              </span>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
};
