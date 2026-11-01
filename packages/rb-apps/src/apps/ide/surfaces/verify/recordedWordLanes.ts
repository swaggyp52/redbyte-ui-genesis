/**
 * Reading single-bit recorded outputs as one number.
 *
 * A two-bit counter records LD0 and LD1 as separate traces. Each trace is correct and neither
 * says "2". This groups boundary outputs that name themselves as bits of one word - LD0, LD1 or
 * Q[0], Q[1] or COUNT_0, COUNT_1 - so the instrument can show the value they spell together.
 *
 * It is a presentation of recorded samples and nothing more: it never invents a member, and a
 * tick where any member has no 0/1 sample has no word value. Naming is the only evidence used,
 * so the rule is strict - bit 0 must be present and the indices must be contiguous.
 */

export interface RecordedWordField {
  readonly id: string;
  readonly label: string;
}

export interface RecordedWordGroup {
  /** Stable key, e.g. `word:LD`. */
  readonly id: string;
  /** Conventional range label, e.g. `LD[1:0]`. */
  readonly label: string;
  readonly base: string;
  /** Members most-significant bit first, the order a reader writes the number in. */
  readonly members: readonly RecordedWordField[];
}

export interface RecordedWordValue {
  /** Binary digits, most-significant bit first, e.g. `10`. */
  readonly bits: string;
  readonly value: number;
}

const MEMBER = /^(.*?[A-Za-z_])(?:\[(\d+)\]|_?(\d+))$/;
const MAX_WORD_BITS = 16;

/** Groups fields into words. Fields that do not belong to a complete word are left alone. */
export function deriveRecordedWordGroups(fields: readonly RecordedWordField[]): RecordedWordGroup[] {
  const byBase = new Map<string, Map<number, RecordedWordField>>();
  for (const field of fields) {
    const match = MEMBER.exec(field.label.trim());
    if (!match) continue;
    const base = match[1].replace(/_$/, '');
    const index = Number(match[2] ?? match[3]);
    if (!base || !Number.isInteger(index)) continue;
    const members = byBase.get(base) ?? new Map<number, RecordedWordField>();
    // Two fields claiming the same bit is not a word this rule can read; drop the base.
    if (members.has(index)) {
      byBase.set(base, new Map([[-1, field]]));
      continue;
    }
    members.set(index, field);
    byBase.set(base, members);
  }
  const groups: RecordedWordGroup[] = [];
  for (const [base, members] of byBase) {
    const width = members.size;
    if (width < 2 || width > MAX_WORD_BITS || members.has(-1)) continue;
    const ordered: RecordedWordField[] = [];
    let contiguous = true;
    for (let bit = width - 1; bit >= 0; bit -= 1) {
      const member = members.get(bit);
      if (!member) {
        contiguous = false;
        break;
      }
      ordered.push(member);
    }
    if (!contiguous) continue;
    groups.push({ id: `word:${base}`, label: `${base}[${width - 1}:0]`, base, members: ordered });
  }
  return groups.sort((left, right) => left.label.localeCompare(right.label));
}

/** The word at one moment, or null when any member has no recorded 0/1 there. */
export function recordedWordAt(
  group: RecordedWordGroup,
  sampleOf: (fieldId: string) => string | null | undefined,
): RecordedWordValue | null {
  let bits = '';
  for (const member of group.members) {
    const sample = sampleOf(member.id);
    if (sample !== '0' && sample !== '1') return null;
    bits += sample;
  }
  return { bits, value: Number.parseInt(bits, 2) };
}

/** A word as one recording captured it: who its members were then, and its value at each tick. */
export interface RecordedWordLane extends RecordedWordGroup {
  readonly valueByTick: ReadonlyMap<number, RecordedWordValue>;
}

/** The parts of a recording this reads. Nothing here comes from the design as it is now. */
export interface RecordedWordSource {
  readonly report?: { readonly signalRoles?: Readonly<Record<string, string>> } | null;
  /** The boundary rows the run executed with: which node and port each recorded name was. */
  readonly executionInput?: {
    readonly ioRows?: readonly { readonly label: string; readonly nodeId?: string; readonly port?: string; readonly direction?: string }[];
  } | null;
  readonly waveform: readonly { readonly tick: number; readonly signals: Readonly<Record<string, string>> }[];
}

/**
 * The word lanes of one recording, read entirely from that recording: its output names are the
 * ones its own signal roles captured when it ran, and its values are its own samples.
 *
 * The first version grouped the live design's current output labels and then looked the values
 * up in the old recording. Renaming LD1 to RESULT in Design therefore removed the LD[1:0] lane
 * from a recording that had been made, and was still stored, with LD1 in it. A recording must
 * stay readable as it was recorded whatever the design is renamed to afterwards.
 */
export function deriveRecordedWordLanes(run: RecordedWordSource | null | undefined): RecordedWordLane[] {
  if (!run || run.waveform.length === 0) return [];
  const outputs = Object.entries(run.report?.signalRoles ?? {})
    .filter(([, role]) => role === 'output')
    .map(([name]) => ({ id: name, label: name }));
  // A recording keys its roles by the label as authored (LD1) and its samples by the same name
  // in the engine's spelling (ld1). Resolve each recorded name to that recording's own sample
  // key once; a name the recording has no sample key for stays unresolved and has no value.
  const sampleKeys = new Set<string>();
  for (const sample of run.waveform) for (const key of Object.keys(sample.signals)) sampleKeys.add(key);
  const byFolded = new Map<string, string>();
  for (const key of sampleKeys) if (!key.includes('.') && !byFolded.has(key.toLowerCase())) byFolded.set(key.toLowerCase(), key);
  // The output's own pin is the most direct evidence and is what the bit lanes below show, so
  // it is read first; the named boundary sample is the fallback for recordings without rows.
  const keysOf = (name: string): string[] => {
    const row = run.executionInput?.ioRows?.find((entry) => entry.label === name && entry.direction !== 'in');
    const candidates = [
      row?.nodeId ? `${row.nodeId}.${row.port || 'in'}` : undefined,
      sampleKeys.has(name) ? name : byFolded.get(name.toLowerCase()),
    ];
    return candidates.filter((key): key is string => key !== undefined && sampleKeys.has(key));
  };
  const lanes: RecordedWordLane[] = [];
  for (const group of deriveRecordedWordGroups(outputs)) {
    const keys = new Map(group.members.map((member) => [member.id, keysOf(member.label)]));
    const valueByTick = new Map<number, RecordedWordValue>();
    for (const sample of run.waveform) {
      const word = recordedWordAt(group, (name) => {
        for (const key of keys.get(name) ?? []) {
          const value = sample.signals[key];
          if (value !== undefined) return value;
        }
        return undefined;
      });
      if (word) valueByTick.set(sample.tick, word);
    }
    // A word no tick can supply is not shown as an empty lane.
    if (valueByTick.size > 0) lanes.push({ ...group, valueByTick });
  }
  return lanes;
}
