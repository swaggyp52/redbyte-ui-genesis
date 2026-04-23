import type { VerifyScheduleContract } from '../../fpga/boards/basys3/verifySchedule';
import type { HardwareBoardResourceType, HardwareTimingRole } from '@redbyte/rb-utils';
import { resolveBasys3SignalBinding } from '../../fpga/boards/basys3/basys3SignalSemantics';

export type IoSignalRole = 'clock' | 'reset' | 'input' | 'output';

export interface IoSignalRoleRow {
  label: string;
  direction: 'in' | 'out';
  id?: string;
  pin?: string;
  timingRole?: HardwareTimingRole;
  boardResourceType?: HardwareBoardResourceType;
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
    const boardBinding = resolveBasys3SignalBinding({
      id: row.id,
      label: row.label,
      pin: row.pin,
      direction: row.direction,
      timingRole: row.timingRole,
      boardResourceType: row.boardResourceType,
    });

    if (boardBinding?.role === 'clock') {
      roles[label] = 'clock';
    } else if (boardBinding?.role === 'reset') {
      roles[label] = 'reset';
    } else if (
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
