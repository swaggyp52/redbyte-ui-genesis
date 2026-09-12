import type { VerifyWaveSample } from './verifyReport';

/** Lossless encoding inside existing browser storage, never the portable RBProject.
 * Long traces otherwise repeat every hierarchical endpoint name at every tick,
 * in both the active workspace and the saved project's retained recordings. */
interface PackedWaveform {
  $rbWaveform: 1;
  signals: string[];
  frames: Array<[number, Array<string | null>, VerifyWaveSample['mismatches'], Record<string, unknown>]>;
}

export function recordingStorageReplacer(key: string, value: unknown): unknown {
  if (key === 'normalizationMap' && Array.isArray(value) && value.length >= 64) {
    const records: unknown[] = []; const dictionary = new Map<string, number>();
    const order = value.map(record => {
      const json = JSON.stringify(record);
      if (!dictionary.has(json)) { dictionary.set(json, records.length); records.push(record); }
      return dictionary.get(json)!;
    });
    return { $rbRepeatedRecords: 1, records, order };
  }
  if (key === 'rows' && Array.isArray(value) && value.length >= 64 && value.every(row => row &&
    typeof row === 'object' && !Array.isArray(row) && Object.values(row).every(cell => cell == null || ['string', 'number', 'boolean'].includes(typeof cell)))) {
    const columns = [...new Set(value.flatMap(row => Object.keys(row)))];
    return { $rbRows: 1, columns, cells: value.map(row => columns.map(column => row[column] === undefined ? [] : row[column])) };
  }
  if (key !== 'waveform' || !Array.isArray(value) || value.length < 16 ||
    !value.every(sample => sample && typeof sample.tick === 'number' &&
      sample.signals && typeof sample.signals === 'object' && Array.isArray(sample.mismatches))) return value;
  const samples = value as VerifyWaveSample[];
  const signals = [...new Set(samples.flatMap(sample => Object.keys(sample.signals)))].sort();
  const packed: PackedWaveform = {
    $rbWaveform: 1, signals,
    frames: samples.map(({ tick, signals: values, mismatches, ...extra }) => [
      tick, signals.map(signal => Object.hasOwn(values, signal) ? values[signal] : null), mismatches, extra,
    ]),
  };
  return packed;
}

export function recordingStorageReviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && '$rbRepeatedRecords' in value) {
    const packed = value as { $rbRepeatedRecords: number; records: unknown[]; order: number[] };
    if (packed.$rbRepeatedRecords !== 1 || !Array.isArray(packed.records) || !Array.isArray(packed.order) ||
      !packed.order.every(index => Number.isInteger(index) && index >= 0 && index < packed.records.length)) throw new Error('Invalid retained normalization records');
    return packed.order.map(index => structuredClone(packed.records[index]));
  }
  if (value && typeof value === 'object' && '$rbRows' in value) {
    const packed = value as { $rbRows: number; columns: string[]; cells: unknown[][] };
    if (packed.$rbRows !== 1 || !Array.isArray(packed.columns) || !packed.columns.every(column => typeof column === 'string') ||
      !Array.isArray(packed.cells) || !packed.cells.every(row => Array.isArray(row) && row.length === packed.columns.length)) throw new Error('Invalid retained check rows');
    return packed.cells.map(row => Object.fromEntries(packed.columns.flatMap((column, index) => Array.isArray(row[index]) ? [] : [[column, row[index]]])));
  }
  if (!value || typeof value !== 'object' || !('$rbWaveform' in value)) return value;
  const packed = value as PackedWaveform;
  if (packed.$rbWaveform !== 1 || !Array.isArray(packed.signals) ||
    !packed.signals.every(signal => typeof signal === 'string') || !Array.isArray(packed.frames)) {
    throw new Error('Invalid retained waveform encoding');
  }
  return packed.frames.map(frame => {
    if (!Array.isArray(frame) || typeof frame[0] !== 'number' || !Array.isArray(frame[1]) ||
      frame[1].length !== packed.signals.length || !frame[1].every(item => item === null || typeof item === 'string') ||
      !Array.isArray(frame[2]) || !frame[3] || typeof frame[3] !== 'object') {
      throw new Error('Invalid retained waveform frame');
    }
    return { ...frame[3], tick: frame[0],
      signals: Object.fromEntries(packed.signals.flatMap((signal, index) => frame[1][index] === null ? [] : [[signal, frame[1][index]]])),
      mismatches: frame[2],
    };
  });
}
