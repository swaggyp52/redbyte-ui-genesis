export const HARDWARE_ERROR_CODES = [
  'bridge_offline',
  'board_missing',
  'board_busy',
  'program_failed',
  'permission_denied',
  'bitstream_missing',
] as const;

export type HardwareErrorCode = (typeof HARDWARE_ERROR_CODES)[number];

export interface HardwareRemediation {
  code: HardwareErrorCode;
  title: string;
  action: string;
}

const REMEDIATION_MAP: Record<HardwareErrorCode, HardwareRemediation> = {
  bridge_offline: {
    code: 'bridge_offline',
    title: 'Bridge service is offline',
    action: 'Start bridge service and retry the hardware step.',
  },
  board_missing: {
    code: 'board_missing',
    title: 'Board is not detected',
    action: 'Reconnect Basys3 over USB and re-run board detect.',
  },
  board_busy: {
    code: 'board_busy',
    title: 'Board is busy',
    action: 'Cancel active program/capture run and retry.',
  },
  program_failed: {
    code: 'program_failed',
    title: 'Programming failed',
    action: 'Retry program step and confirm compatible bitstream.',
  },
  permission_denied: {
    code: 'permission_denied',
    title: 'Permission denied',
    action: 'Run with required device permissions and retry.',
  },
  bitstream_missing: {
    code: 'bitstream_missing',
    title: 'Bitstream missing',
    action: 'Provide known-good bitstream before program step.',
  },
};

export function getHardwareRemediation(code: HardwareErrorCode): HardwareRemediation {
  return REMEDIATION_MAP[code];
}

export function listHardwareRemediations(codes: HardwareErrorCode[]): HardwareRemediation[] {
  return Array.from(new Set(codes)).map((code) => REMEDIATION_MAP[code]);
}

export function mapHardwareErrorCode(error: unknown): HardwareErrorCode | null {
  if (typeof error !== 'string' || error.trim().length === 0) return null;
  const normalized = error.toLowerCase();

  if (normalized.includes('permission') || normalized.includes('eacces') || normalized.includes('eperm')) {
    return 'permission_denied';
  }

  if (normalized.includes('bitstream_required') || normalized.includes('bitstream missing')) {
    return 'bitstream_missing';
  }

  if (normalized.includes('busy') || normalized.includes('active run')) {
    return 'board_busy';
  }

  if (
    normalized.includes('bridge') && (normalized.includes('offline') || normalized.includes('unreachable'))
    || normalized.includes('fetch failed')
    || normalized.includes('econrefused')
  ) {
    return 'bridge_offline';
  }

  if (
    normalized.includes('board_missing')
    || normalized.includes('no board')
    || normalized.includes('no devices')
    || normalized.includes('detect_failed')
  ) {
    return 'board_missing';
  }

  if (normalized.includes('program') || normalized.includes('bitstream') || normalized.includes('run_failed')) {
    return 'program_failed';
  }

  return null;
}
