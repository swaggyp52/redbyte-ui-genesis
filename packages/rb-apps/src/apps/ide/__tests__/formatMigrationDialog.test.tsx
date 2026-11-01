// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormatMigrationDialog } from '../components/FormatMigrationDialog';
import { analyzeProjectForMigration } from '../../../export/formatMigrationPlan';

const v0Plan = analyzeProjectForMigration({ name: 'Legacy', circuit: { nodes: [], connections: [] } });

describe('FormatMigrationDialog', () => {
  it('renders nothing when no migration is needed', () => {
    const currentPlan = analyzeProjectForMigration({ kind: 'rb-project', version: 1, circuit: { nodes: [], connections: [] } });
    const { container } = render(
      <FormatMigrationDialog plan={currentPlan} onOpenUpgradedCopy={() => {}} onExportOriginalBackup={() => {}} onCancel={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('states the from-version and lists the changes honestly', () => {
    render(
      <FormatMigrationDialog plan={v0Plan} fileName="legacy.rbproj" onOpenUpgradedCopy={() => {}} onExportOriginalBackup={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByTestId('ide-format-migration-dialog')).toBeTruthy();
    expect(screen.getByTestId('ide-format-migration-from').textContent).toBe('v0');
    expect(screen.getByTestId('ide-format-migration-changes').textContent?.length).toBeGreaterThan(0);
  });

  it('wires the three actions', () => {
    const onOpenUpgradedCopy = vi.fn();
    const onExportOriginalBackup = vi.fn();
    const onCancel = vi.fn();
    render(
      <FormatMigrationDialog
        plan={v0Plan}
        onOpenUpgradedCopy={onOpenUpgradedCopy}
        onExportOriginalBackup={onExportOriginalBackup}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByTestId('ide-format-migration-backup'));
    expect(onExportOriginalBackup).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('ide-format-migration-open'));
    expect(onOpenUpgradedCopy).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('ide-format-migration-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
