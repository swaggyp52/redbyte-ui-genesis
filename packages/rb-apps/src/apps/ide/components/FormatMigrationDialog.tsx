import React from 'react';
import type { FormatMigrationPlan } from '../../../export/formatMigrationPlan';

/**
 * "Project update required" dialog.
 *
 * When a user opens a project saved in an older format, RedByte never upgrades it
 * silently. This dialog states honestly that an update is required, shows exactly
 * what will change, and offers four choices — open an upgraded *copy*, export the
 * original untouched as a backup, review the changes, or cancel. The original
 * file is never overwritten; only an in-memory upgraded copy is loaded, and it
 * becomes durable only when the user saves.
 */

export interface FormatMigrationDialogProps {
  readonly plan: FormatMigrationPlan;
  readonly fileName?: string | null;
  readonly onOpenUpgradedCopy: () => void;
  readonly onExportOriginalBackup: () => void;
  readonly onCancel: () => void;
}

export const FormatMigrationDialog: React.FC<FormatMigrationDialogProps> = ({
  plan,
  fileName,
  onOpenUpgradedCopy,
  onExportOriginalBackup,
  onCancel,
}) => {
  if (plan.status !== 'needs-migration') return null;

  return (
    <div className="ide-format-migration-overlay" role="presentation" onClick={onCancel}>
      <div
        className="ide-format-migration-dialog"
        data-testid="ide-format-migration-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ide-format-migration-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ide-format-migration-head">
          <h2 id="ide-format-migration-title">Project update required</h2>
          {fileName ? <span className="ide-format-migration-file">{fileName}</span> : null}
        </header>

        <p className="ide-format-migration-body">
          This project was saved in an older format
          {' '}
          (<strong data-testid="ide-format-migration-from">v{plan.fromVersion}</strong>). To open it,
          RedByte will upgrade a <strong>copy</strong> to <strong>v{plan.toVersion}</strong>. Your
          original file is not changed — export it as a backup first if you want to keep the old
          version, and the upgraded copy becomes permanent only when you save.
        </p>

        <details className="ide-format-migration-review" data-testid="ide-format-migration-review" open>
          <summary>Review what changes ({plan.changes.length})</summary>
          <ul className="ide-format-migration-changes" data-testid="ide-format-migration-changes">
            {plan.changes.map((change, i) => (
              <li key={i}>{change}</li>
            ))}
          </ul>
        </details>

        <div className="ide-format-migration-actions">
          <button
            type="button"
            className="ide-format-migration-cancel"
            data-testid="ide-format-migration-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ide-format-migration-backup"
            data-testid="ide-format-migration-backup"
            onClick={onExportOriginalBackup}
          >
            Export original backup
          </button>
          <button
            type="button"
            className="ide-format-migration-open"
            data-testid="ide-format-migration-open"
            onClick={onOpenUpgradedCopy}
          >
            Open upgraded copy
          </button>
        </div>
      </div>
    </div>
  );
};
