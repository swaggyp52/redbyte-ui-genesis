import type { VerifyScheduleContract } from '../../fpga/boards/basys3/verifySchedule';

export type IoSignalRole = 'clock' | 'reset' | 'input' | 'output';

export interface IoSignalRoleRow {
  label: string;
  direction: 'in' | 'out';
}

export function deriveIoSignalRoles(
  ioRows: readonly IoSignalRoleRow[],
  scheduleContract: VerifyScheduleContract
): Record<string, IoSignalRole> {
  const roles: Record<string, IoSignalRole> = {};
  const clockName = scheduleContract.clockSignalName?.toLowerCase() ?? '';
  const resetName = scheduleContract.resetHint?.signalName?.toLowerCase() ?? '';

  for (const row of ioRows) {
    const label = row.label.trim();
    if (!label) continue;
    const lower = label.toLowerCase();

    if (
      clockName &&
      (lower === clockName ||
        lower === 'clk' ||
        lower === 'clock' ||
        lower === 'clk100mhz' ||
        lower.startsWith('clk_') ||
        lower.startsWith('clock_'))
    ) {
      roles[label] = 'clock';
    } else if (resetName && lower === resetName) {
      roles[label] = 'reset';
    } else if (
      lower === 'rst' ||
      lower === 'reset' ||
      lower === 'clr' ||
      lower === 'clear' ||
      lower === 'btnc' ||
      lower.startsWith('rst_') ||
      lower.startsWith('reset_') ||
      lower.startsWith('clr_') ||
      lower.startsWith('clear_')
    ) {
      roles[label] = 'reset';
    } else if (row.direction === 'in') {
      roles[label] = 'input';
    } else {
      roles[label] = 'output';
    }
  }

  return roles;
}