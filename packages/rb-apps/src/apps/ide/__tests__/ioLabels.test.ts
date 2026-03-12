import { describe, expect, it } from 'vitest';
import { getStudentFacingIoLabel, normalizeIoSignalKey } from '../ioLabels';

describe('getStudentFacingIoLabel', () => {
  it('prefers label over port and id', () => {
    expect(
      getStudentFacingIoLabel({
        label: 'SW0',
        port: 'out',
        id: 'internal_sw0',
      })
    ).toBe('SW0');
  });

  it('falls back to port when label is blank', () => {
    expect(
      getStudentFacingIoLabel({
        label: '   ',
        port: 'LD0',
        id: 'internal_ld0',
      })
    ).toBe('LD0');
  });

  it('falls back to id when label and port are blank', () => {
    expect(
      getStudentFacingIoLabel({
        label: '',
        port: ' ',
        id: 'q_internal',
      })
    ).toBe('q_internal');
  });

  it('uses provided fallback when row is missing', () => {
    expect(getStudentFacingIoLabel(undefined, 'fallback_label')).toBe('fallback_label');
  });
});

describe('normalizeIoSignalKey', () => {
  it('normalizes bracketed and punctuated keys consistently', () => {
    expect(normalizeIoSignalKey('LD[0]')).toBe('ld');
    expect(normalizeIoSignalKey('node_0.out')).toBe('node_0.out');
    expect(normalizeIoSignalKey('SW-0')).toBe('sw0');
  });
});
