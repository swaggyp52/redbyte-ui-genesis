import React, { useMemo } from 'react';
import { IdeButton, IdeChip, IdeStatusPill } from '../components/IdePrimitives';
import { SurfacePanel, SurfaceSectionTitle } from '../components/SurfaceLayoutPrimitives';
import type { HardwareBoardResourceType, HardwareTimingRole } from '@redbyte/rb-utils';

/**
 * ProjectConstraintSetsDocument — the Project-surface document view over the
 * SINGLE canonical hardware mapping.
 *
 * Authority map (consume, never duplicate):
 * - There is exactly ONE HardwareMappingDocumentV2 per project
 *   (projectRuntime state). NO named-constraint-set model exists anywhere in
 *   RedByte, so this document renders exactly one set — presented with the
 *   Vivado-familiar name "constrs_1" and marked active — and offers NO
 *   create/duplicate/switch affordances. Inventing those would fabricate an
 *   authority that does not exist.
 * - Signal rows are the flat ProjectIoRow projection the runtime derives from
 *   the V2 document + live circuit (the same rows ProjectSurface receives as
 *   `mappingRows`). This component accepts them structurally and derives
 *   mapped/required/problem counts — it never stores mapping state.
 * - XDC truth is generated (top.xdc from the Basys3 export contract). The
 *   optional `xdcArtifact` prop carries the real generated-artifact status from
 *   ExportViewModel.artifacts (category 'constraints'); when absent the source
 *   line says the file is generated at export time rather than pretending a
 *   stored file exists.
 * - The "100 MHz system clock" note is asserted only for the canonical Basys3
 *   clock pin W5 (BASYS3_CLOCK_PIN) — board metadata is never invented for
 *   other pins.
 *
 * Actions flow through optional callbacks (onOpenBoard → Map Pins / Hardware,
 * onOpenXdc → generated-file inspection). A missing callback renders the
 * affordance disabled with an honest reason.
 */

/**
 * Structural row shape — ProjectSurface's `ProjectMappingRow` (and the
 * runtime's `ProjectIoRow`) assign to this directly.
 */
export interface ProjectConstraintSignalRow {
  id: string;
  label: string;
  port: string;
  direction: 'in' | 'out';
  pin: string;
  required: boolean;
  timingRole?: HardwareTimingRole;
  boardResourceType?: HardwareBoardResourceType;
}

export interface ProjectConstraintXdcArtifact {
  path: string;
  status: 'ready' | 'blocked' | 'pending';
  note?: string;
}

export interface ProjectConstraintSetsDocumentProps {
  /** Target board display name (fpgaConfig.board). Defaults to Basys3. */
  board?: string;
  rows: readonly ProjectConstraintSignalRow[];
  /** Real generated-constraints artifact status from ExportViewModel, when available. */
  xdcArtifact?: ProjectConstraintXdcArtifact | null;
  /** Opens Map Pins / Hardware. */
  onOpenBoard?: () => void;
  /** Opens the generated XDC (Export generated-file inspection). */
  onOpenXdc?: () => void;
}

const NOT_WIRED_REASON = 'Not available from this surface yet.';
const BASYS3_CLOCK_PIN = 'W5';

const XDC_STATUS_LABEL: Record<ProjectConstraintXdcArtifact['status'], string> = {
  ready: 'generated',
  blocked: 'blocked upstream',
  pending: 'pending',
};

export const ProjectConstraintSetsDocument: React.FC<ProjectConstraintSetsDocumentProps> = ({
  board = 'Basys3',
  rows,
  xdcArtifact = null,
  onOpenBoard,
  onOpenXdc,
}) => {
  const requiredRows = useMemo(() => rows.filter((row) => row.required), [rows]);
  const mappedRequiredRows = useMemo(
    () => requiredRows.filter((row) => row.pin.trim().length > 0),
    [requiredRows]
  );
  const missingRequiredRows = useMemo(
    () => requiredRows.filter((row) => row.pin.trim().length === 0),
    [requiredRows]
  );
  const clockRow = useMemo(
    () =>
      rows.find(
        (row) => row.timingRole === 'clock' || row.boardResourceType === 'clock_pin'
      ) ?? null,
    [rows]
  );

  const mappedTone: 'idle' | 'ok' | 'warn' =
    requiredRows.length === 0 ? 'idle' : missingRequiredRows.length === 0 ? 'ok' : 'warn';

  return (
    <SurfacePanel testId="ide-project-constraint-sets">
      <SurfaceSectionTitle title="Constraint sets" meta="1 set" testId="ide-project-constrsets-header" />
      <div data-testid="ide-project-constrsets-active-set">
        <p>
          <strong data-testid="ide-project-constrsets-set-name">constrs_1</strong>{' '}
          <IdeChip tone="accent" testId="ide-project-constrsets-active-chip">
            Active
          </IdeChip>{' '}
          <IdeChip tone="neutral" testId="ide-project-constrsets-board">
            {board}
          </IdeChip>
        </p>
        <p data-testid="ide-project-constrsets-source">
          {xdcArtifact
            ? `${xdcArtifact.path} · ${XDC_STATUS_LABEL[xdcArtifact.status]}${
                xdcArtifact.note ? ` — ${xdcArtifact.note}` : ''
              }`
            : 'top.xdc — generated at export time'}
        </p>
        <p>
          <IdeStatusPill tone={mappedTone} testId="ide-project-constrsets-mapped">
            {mappedRequiredRows.length}/{requiredRows.length} required signals mapped
          </IdeStatusPill>
        </p>
        <p data-testid="ide-project-constrsets-clock">
          {clockRow === null
            ? 'No clock signal — combinational design.'
            : clockRow.pin.trim().length === 0
              ? `Clock ${clockRow.port} — board pin not assigned yet.`
              : `Clock ${clockRow.port} → ${clockRow.pin}${
                  clockRow.pin.trim().toUpperCase() === BASYS3_CLOCK_PIN
                    ? ' · Basys3 100 MHz system clock'
                    : ''
                }`}
        </p>
        <div data-testid="ide-project-constrsets-problems">
          {rows.length === 0 ? (
            <p data-testid="ide-project-constrsets-empty">
              No board-facing signals yet — add inputs and outputs in Design.
            </p>
          ) : missingRequiredRows.length === 0 ? (
            <p>No unmapped required signals.</p>
          ) : (
            <>
              <p>
                {missingRequiredRows.length} unmapped required{' '}
                {missingRequiredRows.length === 1 ? 'signal' : 'signals'}:
              </p>
              <ul>
                {missingRequiredRows.map((row) => (
                  <li key={row.id} data-testid={`ide-project-constrsets-problem-${row.id}`}>
                    {row.label} ({row.port})
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="ide-surface-actions" data-testid="ide-project-constrsets-actions">
          <IdeButton
            tone="secondary"
            onClick={onOpenBoard}
            disabled={!onOpenBoard}
            title={onOpenBoard ? 'Assign board pins in Map Pins.' : NOT_WIRED_REASON}
            testId="ide-project-constrsets-open-board"
          >
            Open Map Pins
          </IdeButton>
          <IdeButton
            tone="ghost"
            onClick={onOpenXdc}
            disabled={!onOpenXdc}
            title={onOpenXdc ? 'Inspect the generated constraints file.' : NOT_WIRED_REASON}
            testId="ide-project-constrsets-open-xdc"
          >
            View generated XDC
          </IdeButton>
        </div>
      </div>
      <p className="ide-panel-description" data-testid="ide-project-constrsets-single-note">
        RedByte keeps exactly one constraint set per project. Creating, duplicating, or switching
        named constraint sets is not available.
      </p>
    </SurfacePanel>
  );
};
