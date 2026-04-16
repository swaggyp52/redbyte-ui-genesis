import React from 'react';
import { IdeCallout, IdeStatusPill } from './IdePrimitives';
import { SurfacePanel } from './SurfaceLayoutPrimitives';
import { getProjectKindDisplayName, type ProjectKind, type ScenarioAuthority } from '../projectIdentity';
import type { ProjectHealth } from '../projectHealth';

// ProjectBridgePanel — single authoritative "what does this project actually describe"
// summary. All truth fields are pre-derived by the caller (usually ProjectSurface via
// workflowAuthority + projectHealth). This component is intentionally presentational:
// it does not guess state or compute readiness; it only renders.

export type ProjectBridgeImportFidelity = 'native' | 'full' | 'reconstructed' | 'partial';

export interface ProjectBridgePanelProps {
  projectName: string;
  projectKind: ProjectKind;
  sourceExampleId?: string | null;
  determinismHash: string;
  topModuleName: string;
  simulationTopName?: string | null;
  fpgaBoard: string;
  fpgaPart: string;
  importFidelity: ProjectBridgeImportFidelity;
  scenarioAuthority: ScenarioAuthority;
  health: ProjectHealth;
  readiness: {
    hasCircuit: boolean;
    hasIoMapping: boolean;
    hasVectors: boolean;
    missingRequiredCount: number;
  };
  hardwareReady: boolean;
  blockingIssueCount: number;
  testId?: string;
}

// Truthful hardware-readiness copy. We never claim "hardware proven" from app state
// alone — only that the project is ready for hardware handoff. Proof of an actual
// lab bring-up is tracked elsewhere (bitstream provenance + submission manifest).
function hardwareReadinessCopy(
  hardwareReady: boolean,
  readiness: ProjectBridgePanelProps['readiness']
): { tone: 'ok' | 'warn' | 'idle'; label: string; detail: string } {
  if (!readiness.hasCircuit) {
    return {
      tone: 'idle',
      label: 'No circuit',
      detail: 'Load or author a circuit before evaluating hardware readiness.',
    };
  }
  if (readiness.missingRequiredCount > 0) {
    return {
      tone: 'warn',
      label: 'Pins unmapped',
      detail: `${readiness.missingRequiredCount} required pin${readiness.missingRequiredCount === 1 ? ' is' : 's are'} still unmapped.`,
    };
  }
  if (!hardwareReady) {
    return {
      tone: 'warn',
      label: 'Not ready',
      detail: 'Finish mapping, run Verify, and refresh Export before claiming hardware readiness.',
    };
  }
  return {
    tone: 'ok',
    label: 'Ready for bring-up',
    detail: 'Mapping, comparison evidence, and export artifacts agree with the current circuit. Hardware bring-up has not been proven by this workspace.',
  };
}

function importFidelityCopy(fidelity: ProjectBridgeImportFidelity): {
  tone: 'ok' | 'warn' | 'error' | 'idle';
  label: string;
  detail: string;
} {
  switch (fidelity) {
    case 'native':
      return {
        tone: 'ok',
        label: 'Native',
        detail: 'Authored in RedByte. No external reconstruction was needed.',
      };
    case 'full':
      return {
        tone: 'ok',
        label: 'Full restore',
        detail: 'Imported manifest fully reconstructed the original circuit.',
      };
    case 'reconstructed':
      return {
        tone: 'warn',
        label: 'Reconstructed',
        detail: 'Circuit was rebuilt from HDL — some authoring details may not round-trip exactly.',
      };
    case 'partial':
      return {
        tone: 'error',
        label: 'Partial',
        detail: 'Only ports/shell were recovered from import. Internals are inspection-only until re-authored.',
      };
    default:
      return { tone: 'idle', label: '—', detail: '' };
  }
}

function verifyCopy(health: ProjectHealth): {
  tone: 'ok' | 'warn' | 'error' | 'idle';
  label: string;
  hash: string;
  detail: string;
} {
  const last = health.lastVerify;
  if (!last) {
    return { tone: 'idle', label: 'Not run', hash: '—', detail: 'No verify run recorded yet.' };
  }
  const hash = last.hash?.slice(0, 12) ?? '—';
  if (health.dirtySinceVerify) {
    return {
      tone: 'warn',
      label: 'Stale',
      hash,
      detail: 'Design changed since the last verify run.',
    };
  }
  if (last.status === 'pass') {
    return { tone: 'ok', label: 'Pass', hash, detail: 'Latest run matches expected outputs.' };
  }
  if (last.status === 'fail') {
    return { tone: 'error', label: 'Fail', hash, detail: 'Latest run differs from expected outputs.' };
  }
  return { tone: 'warn', label: last.status?.toUpperCase() ?? 'Unknown', hash, detail: 'Review verify state.' };
}

function exportCopy(health: ProjectHealth): {
  tone: 'ok' | 'warn' | 'error' | 'idle';
  label: string;
  hash: string;
  detail: string;
} {
  const last = health.lastExport;
  if (!last) {
    return { tone: 'idle', label: 'Not built', hash: '—', detail: 'No export bundle built yet.' };
  }
  const hash = last.hash?.slice(0, 12) ?? '—';
  if (last.status === 'blocked') {
    return { tone: 'error', label: 'Blocked', hash, detail: 'Last export attempt was blocked.' };
  }
  if (health.dirtySinceExport) {
    return {
      tone: 'warn',
      label: 'Stale bundle',
      hash,
      detail: 'Project changed since the bundle was built.',
    };
  }
  return { tone: 'ok', label: 'Current', hash, detail: 'Bundle matches the current design.' };
}

export const ProjectBridgePanel: React.FC<ProjectBridgePanelProps> = ({
  projectName,
  projectKind,
  sourceExampleId,
  determinismHash,
  topModuleName,
  simulationTopName,
  fpgaBoard,
  fpgaPart,
  importFidelity,
  scenarioAuthority,
  health,
  readiness,
  hardwareReady,
  blockingIssueCount,
  testId = 'ide-project-bridge',
}) => {
  const hw = hardwareReadinessCopy(hardwareReady, readiness);
  const fidelity = importFidelityCopy(importFidelity);
  const verify = verifyCopy(health);
  const exp = exportCopy(health);
  const shortHash = determinismHash ? determinismHash.slice(0, 12) : '—';
  const kindLabel = getProjectKindDisplayName(projectKind);
  const simTop = simulationTopName && simulationTopName !== topModuleName ? simulationTopName : null;

  return (
    <SurfacePanel className="ide-project-bridge" testId={testId}>
      <header className="ide-project-bridge-header">
        <div>
          <p className="ide-surface-block-label">Project Bridge</p>
          <h3 className="ide-project-bridge-title" data-testid={`${testId}-title`}>
            {projectName}
          </h3>
          <p className="ide-project-bridge-subtitle" data-testid={`${testId}-subtitle`}>
            {kindLabel}
            {sourceExampleId ? ` · ${sourceExampleId}` : ''}
          </p>
        </div>
        <div className="ide-project-bridge-header-right">
          <IdeStatusPill tone={hw.tone} testId={`${testId}-hardware-pill`}>
            {hw.label.toUpperCase()}
          </IdeStatusPill>
          <code className="ide-project-bridge-hash" data-testid={`${testId}-hash`}>
            {shortHash}
          </code>
        </div>
      </header>

      <dl className="ide-project-bridge-grid" data-testid={`${testId}-grid`}>
        <BridgeField
          label="Design top"
          value={topModuleName || 'top'}
          testId={`${testId}-design-top`}
        />
        <BridgeField
          label="Simulation top"
          value={simTop ?? '— same as design —'}
          testId={`${testId}-sim-top`}
          muted={!simTop}
        />
        <BridgeField
          label="Target board"
          value={fpgaBoard}
          testId={`${testId}-board`}
        />
        <BridgeField
          label="Target part"
          value={fpgaPart}
          mono
          testId={`${testId}-part`}
        />
        <BridgeField
          label="Import fidelity"
          value={fidelity.label}
          tone={fidelity.tone}
          hint={fidelity.detail}
          testId={`${testId}-fidelity`}
        />
        <BridgeField
          label="Scenario authority"
          value={scenarioAuthority.toUpperCase()}
          tone={
            scenarioAuthority === 'verified'
              ? 'ok'
              : scenarioAuthority === 'stale'
                ? 'warn'
                : scenarioAuthority === 'authored' || scenarioAuthority === 'draft'
                  ? 'idle'
                  : 'idle'
          }
          testId={`${testId}-scenario-authority`}
        />
        <BridgeField
          label="Verify"
          value={verify.label}
          tone={verify.tone}
          hint={verify.detail}
          secondary={verify.hash !== '—' ? `hash ${verify.hash}` : undefined}
          testId={`${testId}-verify`}
        />
        <BridgeField
          label="Export"
          value={exp.label}
          tone={exp.tone}
          hint={exp.detail}
          secondary={exp.hash !== '—' ? `hash ${exp.hash}` : undefined}
          testId={`${testId}-export`}
        />
      </dl>

      <IdeCallout
        tone={hw.tone === 'ok' ? 'success' : hw.tone === 'warn' ? 'warn' : 'info'}
        title={`Hardware: ${hw.label}`}
        testId={`${testId}-hardware-callout`}
      >
        <p style={{ margin: 0 }}>{hw.detail}</p>
        {blockingIssueCount > 0 && (
          <p
            style={{ margin: '0.5rem 0 0 0', fontSize: 12, opacity: 0.85 }}
            data-testid={`${testId}-blocking-count`}
          >
            {blockingIssueCount} blocking issue{blockingIssueCount === 1 ? '' : 's'} open.
          </p>
        )}
      </IdeCallout>
    </SurfacePanel>
  );
};

interface BridgeFieldProps {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'error' | 'idle';
  hint?: string;
  secondary?: string;
  mono?: boolean;
  muted?: boolean;
  testId?: string;
}

const BridgeField: React.FC<BridgeFieldProps> = ({
  label,
  value,
  tone,
  hint,
  secondary,
  mono,
  muted,
  testId,
}) => {
  return (
    <div className="ide-project-bridge-field" data-testid={testId}>
      <dt className="ide-project-bridge-field-label">{label}</dt>
      <dd className="ide-project-bridge-field-value">
        {tone ? (
          <IdeStatusPill tone={tone}>
            {mono ? <code>{value}</code> : value}
          </IdeStatusPill>
        ) : mono ? (
          <code className={muted ? 'is-muted' : undefined}>{value}</code>
        ) : (
          <span className={muted ? 'is-muted' : undefined}>{value}</span>
        )}
        {secondary && (
          <span className="ide-project-bridge-field-secondary" data-testid={testId ? `${testId}-secondary` : undefined}>
            {secondary}
          </span>
        )}
        {hint && (
          <span className="ide-project-bridge-field-hint" data-testid={testId ? `${testId}-hint` : undefined}>
            {hint}
          </span>
        )}
      </dd>
    </div>
  );
};
