// Copyright (c) 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React from 'react';
import { IdeButton, IdeStatusPill } from './IdePrimitives';
import { SurfacePanel } from './SurfaceLayoutPrimitives';
import type { ProjectOutlineSummary } from '../projectOutline';

/**
 * Student-facing Project Overview panel.
 *
 * Lives on the Project surface directly under the Project Bridge. Where the
 * Bridge answers "what project is this?", this panel answers "what does my
 * project contain?" — counts, reusable modules, IO surface area. It is meant
 * to make large final-project designs feel navigable rather than chaotic.
 *
 * Pure presentational: the summary is pre-derived by the caller from runtime
 * truth (circuit + macros + customComponents + ioRows).
 */

export interface ProjectOverviewPanelProps {
  outline: ProjectOutlineSummary;
  onOpenDesign?: () => void;
  testId?: string;
}

const NODE_TYPE_LABELS: Record<string, string> = {
  INPUT: 'Input',
  OUTPUT: 'Output',
  AND: 'AND',
  OR: 'OR',
  NOT: 'NOT',
  NAND: 'NAND',
  NOR: 'NOR',
  XOR: 'XOR',
  XNOR: 'XNOR',
  DFF: 'D Flip-Flop',
  LATCH: 'Latch',
  MUX2: 'Mux 2:1',
  MUX4: 'Mux 4:1',
  CLOCK: 'Clock',
};

function formatNodeType(type: string): string {
  return NODE_TYPE_LABELS[type] ?? type;
}

export const ProjectOverviewPanel: React.FC<ProjectOverviewPanelProps> = ({
  outline,
  onOpenDesign,
  testId = 'ide-project-overview',
}) => {
  const hasAnything =
    outline.nodeCount > 0 ||
    outline.macros.length > 0 ||
    outline.customComponents.length > 0;

  const mappedInputs = outline.inputIoRows.filter((r) => r.pin).length;
  const mappedOutputs = outline.outputIoRows.filter((r) => r.pin).length;
  const topTypes = outline.nodeTypeBreakdown.slice(0, 6);

  return (
    <SurfacePanel className="ide-project-overview" testId={testId}>
      <header className="ide-project-overview-header">
        <div>
          <p className="ide-surface-block-label">Project Overview</p>
          <h3 className="ide-project-overview-title" data-testid={`${testId}-title`}>
            {hasAnything ? 'Project structure' : 'Empty project'}
          </h3>
          <p className="ide-project-overview-subtitle">
            {hasAnything
              ? 'Counts and reusable modules derived from the current design.'
              : 'Nothing yet — open Design to start placing nodes.'}
          </p>
        </div>
        {onOpenDesign && (
          <IdeButton
            tone="secondary"
            onClick={onOpenDesign}
            testId={`${testId}-open-design`}
          >
            Open Design
          </IdeButton>
        )}
      </header>

      <div className="ide-project-overview-stats" data-testid={`${testId}-stats`}>
        <OverviewStat
          label="Nodes"
          value={outline.nodeCount}
          testId={`${testId}-stat-nodes`}
        />
        <OverviewStat
          label="Connections"
          value={outline.connectionCount}
          testId={`${testId}-stat-connections`}
        />
        <OverviewStat
          label="Inputs"
          value={outline.boundaryInputCount}
          hint={`${mappedInputs}/${outline.inputIoRows.length} mapped`}
          testId={`${testId}-stat-inputs`}
        />
        <OverviewStat
          label="Outputs"
          value={outline.boundaryOutputCount}
          hint={`${mappedOutputs}/${outline.outputIoRows.length} mapped`}
          testId={`${testId}-stat-outputs`}
        />
      </div>

      {topTypes.length > 0 && (
        <section
          className="ide-project-overview-section"
          data-testid={`${testId}-types`}
        >
          <h4 className="ide-project-overview-section-title">Node types</h4>
          <ul className="ide-project-overview-chiprow">
            {topTypes.map((entry) => (
              <li key={entry.type}>
                <span className="ide-chip" data-testid={`${testId}-type-${entry.type}`}>
                  {formatNodeType(entry.type)} · {entry.count}
                </span>
              </li>
            ))}
            {outline.nodeTypeBreakdown.length > topTypes.length && (
              <li className="ide-project-overview-chiprow-more">
                +{outline.nodeTypeBreakdown.length - topTypes.length} more
              </li>
            )}
          </ul>
        </section>
      )}

      <section
        className="ide-project-overview-section"
        data-testid={`${testId}-macros`}
      >
        <h4 className="ide-project-overview-section-title">
          Macros
          <span className="ide-project-overview-section-count">
            {outline.macros.length}
          </span>
        </h4>
        {outline.macros.length === 0 ? (
          <p className="ide-project-overview-empty">
            No saved macros yet. Select a group of nodes in Design and choose
            "Save as macro" to build reusable modules.
          </p>
        ) : (
          <ul className="ide-project-overview-modulelist">
            {outline.macros.map((macro) => (
              <li
                key={macro.id}
                data-testid={`${testId}-macro-${macro.id}`}
                className="ide-project-overview-module"
              >
                <div className="ide-project-overview-module-name">{macro.name}</div>
                <div className="ide-project-overview-module-meta">
                  <IdeStatusPill tone="ok">{macro.ioSummary}</IdeStatusPill>
                  {macro.description && (
                    <span className="ide-project-overview-module-desc">
                      {macro.description}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="ide-project-overview-section"
        data-testid={`${testId}-custom-components`}
      >
        <h4 className="ide-project-overview-section-title">
          Custom components
          <span className="ide-project-overview-section-count">
            {outline.customComponents.length}
          </span>
        </h4>
        {outline.customComponents.length === 0 ? (
          <p className="ide-project-overview-empty">
            No custom composite components. Imported projects and authored
            reusable blocks will appear here.
          </p>
        ) : (
          <ul className="ide-project-overview-modulelist">
            {outline.customComponents.map((def) => (
              <li
                key={def.name}
                data-testid={`${testId}-custom-${def.name}`}
                className="ide-project-overview-module"
              >
                <div className="ide-project-overview-module-name">{def.name}</div>
                <div className="ide-project-overview-module-meta">
                  <IdeStatusPill tone="idle">{def.ioSummary}</IdeStatusPill>
                  {def.description && (
                    <span className="ide-project-overview-module-desc">
                      {def.description}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </SurfacePanel>
  );
};

interface OverviewStatProps {
  label: string;
  value: number;
  hint?: string;
  testId?: string;
}

const OverviewStat: React.FC<OverviewStatProps> = ({ label, value, hint, testId }) => (
  <div className="ide-project-overview-stat" data-testid={testId}>
    <span className="ide-project-overview-stat-label">{label}</span>
    <span className="ide-project-overview-stat-value">{value}</span>
    {hint && (
      <span
        className="ide-project-overview-stat-hint"
        data-testid={testId ? `${testId}-hint` : undefined}
      >
        {hint}
      </span>
    )}
  </div>
);
