import { describe, expect, it } from 'vitest';
import {
  getCanonicalIoSignalKey,
  getIoSignalLookupKeys,
  getStudentFacingIoLabel,
  normalizeIoSignalKey,
} from '../ioLabels';

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

describe('collision-safe IO signal keys', () => {
  const duplicateOutputs = [
    {
      id: 'leda',
      nodeId: 'leda_node',
      label: 'LED-A',
      direction: 'out' as const,
    },
    {
      id: 'leda_2',
      nodeId: 'leda_2_node',
      label: 'LEDA',
      direction: 'out' as const,
    },
  ];

  it('falls back to stable row ids when labels collide after normalization', () => {
    expect(getCanonicalIoSignalKey(duplicateOutputs[0], duplicateOutputs)).toBe('leda');
    expect(getCanonicalIoSignalKey(duplicateOutputs[1], duplicateOutputs)).toBe('leda_2');
  });

  it('does not offer ambiguous labels as lookup keys', () => {
    expect(getIoSignalLookupKeys(duplicateOutputs[0], duplicateOutputs)).toEqual([
      'leda',
      'leda_node',
    ]);
    expect(getIoSignalLookupKeys(duplicateOutputs[1], duplicateOutputs)).toEqual([
      'leda_2',
      'leda_2_node',
    ]);
  });
});
