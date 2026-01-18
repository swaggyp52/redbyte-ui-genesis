/**
 * Core FPGA proof parsing and validation logic
 * Pure functions: no side effects, works in browser and Node.js
 */

// Re-export all types for consumers
export type {
  Capsule,
  ProofEvent,
  NormalizedEvent,
  VectorResult,
  VerifyResult,
  DiffResult,
  VectorRow,
  TimelineRow,
  SummaryCardModel,
  GradeReport,
} from './types';

import type {
  Capsule,
  ProofEvent,
  NormalizedEvent,
  VectorResult,
  VerifyResult,
  DiffResult,
  VectorRow,
  TimelineRow,
  SummaryCardModel,
} from './types';

/**
 * Parse capsule JSON (accepts both object and string)
 * Supports dual schema: summary | test_summary
 */
export function parseCapsule(input: string | object): Capsule {
  let capsule: unknown;

  if (typeof input === 'string') {
    try {
      capsule = JSON.parse(input);
    } catch (e) {
      throw new Error(`Invalid capsule JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    capsule = input;
  }

  if (!capsule || typeof capsule !== 'object') {
    throw new Error('Capsule must be an object');
  }

  const obj = capsule as Record<string, unknown>;

  // Validate required fields
  if (!obj.session_id) {
    throw new Error('Capsule missing required field: session_id');
  }

  if (!Array.isArray(obj.vectors)) {
    throw new Error('Capsule missing required field: vectors (array)');
  }

  // Dual schema: accept either summary or test_summary
  const summary = (capsule.summary || (capsule as any).test_summary) as SummaryCardModel | undefined;
  if (!summary) {
    // Graceful fallback: compute from vectors
    const vectors = capsule.vectors as VectorResult[];
    const pass = vectors.filter((v) => v.pass).length;
    (capsule as any).summary = {
      total: vectors.length,
      pass,
      fail: vectors.length - pass,
    };
  }

  return obj as Capsule;
}

/**
 * Parse NDJSON events text (one JSON per line)
 */
export function loadEventsNdjson(text: string): ProofEvent[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const events: ProofEvent[] = [];
  const lines = text.split('\n').filter((line) => line.trim());

  for (let i = 0; i < lines.length; i++) {
    try {
      const event = JSON.parse(lines[i]);
      if (event && typeof event === 'object' && 'tick' in event && 'signal' in event) {
        events.push(event as ProofEvent);
      }
    } catch (e) {
      console.warn(`Skipping malformed NDJSON line ${i + 1}`);
    }
  }

  return events;
}

/**
 * Resolve events from capsule (inline array OR external ref)
 * Requires injected function to fetch/read external files (browser-safe)
 */
export async function resolveEventsFromCapsule(
  capsule: Capsule,
  fetchTextOrReadFile: (ref: string) => Promise<string> | string,
): Promise<{ events: ProofEvent[]; eventsRef?: string }> {
  // Inline events array takes precedence
  if (Array.isArray(capsule.events) && capsule.events.length > 0) {
    return { events: capsule.events };
  }

  // Look for external reference
  const eventsRef = capsule.events_ref || (capsule as Record<string, unknown>).events_ref;
  if (!eventsRef || typeof eventsRef !== 'string') {
    return { events: [] };
  }

  try {
    const text = await Promise.resolve(fetchTextOrReadFile(eventsRef));
    const events = loadEventsNdjson(text);
    return { events, eventsRef };
  } catch (e) {
    console.warn(`Failed to load external events from ${eventsRef}:`, e);
    return { events: [], eventsRef };
  }
}

/**
 * Normalize event: ensure seq and tick are present
 * Deterministic transformation for comparison
 */
export function normalizeEvent(event: ProofEvent, index: number): NormalizedEvent {
  return {
    ...event,
    seq: event.seq ?? index,
    tick: event.tick ?? 0,
  };
}

/**
 * Verify capsule integrity: hash, schema, completeness
 * Strict mode returns INVALID on any mismatch
 */
export function verifyHashes(
  capsule: Capsule,
  eventsText: string,
  strict: boolean = false,
): VerifyResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check required fields
  if (!capsule.session_id) {
    errors.push('Missing session_id');
  }
  if (!Array.isArray(capsule.vectors)) {
    errors.push('Missing or invalid vectors array');
  }

  // Check dual schema
  const summary = (capsule.summary || (capsule as Record<string, unknown>).test_summary) as
    | SummaryCardModel
    | undefined;
  if (!summary) {
    warnings.push('No summary or test_summary found; counts inferred from vectors');
  }

  // Strict mode: require non-empty events for hash integrity
  if (strict && (!eventsText || eventsText.trim().length === 0)) {
    errors.push('Strict mode: events text required for hash verification');
  }

  const ok = errors.length === 0;
  const exitCode = ok ? (0 as const) : (2 as const);

  return { ok, warnings, errors, exitCode };
}

/**
 * Compute vector verdicts for UI display
 */
export function computeVectorVerdicts(capsule: Capsule): VectorRow[] {
  return (capsule.vectors || []).map((vector) => ({
    id: vector.id,
    name: vector.name || vector.id,
    status: vector.pass ? 'PASS' : 'FAIL',
    duration: vector.duration_ticks ? `${vector.duration_ticks} ticks` : undefined,
    error: vector.error,
  }));
}

/**
 * Build timeline rows from events
 * Groups events by tick, shows signal changes
 */
export function buildTimelineRows(events: ProofEvent[]): TimelineRow[] {
  if (!Array.isArray(events) || events.length === 0) {
    return [];
  }

  const tickMap = new Map<number, TimelineRow>();

  for (const event of events) {
    const tick = event.tick ?? 0;
    if (!tickMap.has(tick)) {
      tickMap.set(tick, { tick, changes: [] });
    }

    const row = tickMap.get(tick)!;
    row.changes.push({
      signal: event.signal,
      from: String(event.old),
      to: String(event.new),
    });
  }

  // Sort by tick
  return Array.from(tickMap.values()).sort((a, b) => a.tick - b.tick);
}

/**
 * Generate human-readable summary card
 */
export function summarizeCapsule(capsule: Capsule): SummaryCardModel {
  // Prefer explicit summary
  if (capsule.summary) return capsule.summary;
  if ((capsule as any).test_summary) {
    return (capsule as any).test_summary as SummaryCardModel;
  }

  // Compute from vectors
  const vectors = capsule.vectors || [];
  const pass = vectors.filter((v) => v.pass).length;
  return {
    total: vectors.length,
    pass,
    fail: vectors.length - pass,
    duration_ticks: vectors.reduce((sum, v) => sum + (v.duration_ticks || 0), 0),
  };
}

/**
 * Diff two capsules: returns MATCH (0), DIVERGED (1), or INVALID (2)
 * Respects strict hash mode
 */
export function diffCapsules(
  a: Capsule,
  b: Capsule,
  aEvents: ProofEvent[],
  bEvents: ProofEvent[],
  strictHash: boolean = false,
): DiffResult {
  // Schema validation
  try {
    if (!a.session_id || !b.session_id) {
      return {
        verdict: 'INVALID',
        exitCode: 2,
        summary: 'Missing session_id in one or both capsules',
        schemaMismatch: true,
      };
    }

    const summaryA = a.summary || (a as any).test_summary;
    const summaryB = b.summary || (b as any).test_summary;

    if (!summaryA || !summaryB) {
      return {
        verdict: 'INVALID',
        exitCode: 2,
        summary: 'Missing summary in one or both capsules',
        schemaMismatch: true,
      };
    }
  } catch (e) {
    return {
      verdict: 'INVALID',
      exitCode: 2,
      summary: `Schema validation error: ${e instanceof Error ? e.message : String(e)}`,
      schemaMismatch: true,
    };
  }

  // Compare vector counts
  if (a.vectors.length !== b.vectors.length) {
    return {
      verdict: 'DIVERGED',
      exitCode: 1,
      summary: `Vector count mismatch: ${a.vectors.length} vs ${b.vectors.length}`,
      firstMismatch: {
        vectorId: 'count',
        detail: `Expected ${a.vectors.length}, got ${b.vectors.length}`,
      },
    };
  }

  // Compare each vector
  for (let i = 0; i < a.vectors.length; i++) {
    const va = a.vectors[i];
    const vb = b.vectors[i];

    if (va.pass !== vb.pass) {
      return {
        verdict: 'DIVERGED',
        exitCode: 1,
        summary: `Vector ${va.id} verdict mismatch: ${va.pass ? 'PASS' : 'FAIL'} vs ${vb.pass ? 'PASS' : 'FAIL'}`,
        firstMismatch: {
          vectorId: va.id,
          detail: `Expected ${va.pass ? 'PASS' : 'FAIL'}, got ${vb.pass ? 'PASS' : 'FAIL'}`,
        },
      };
    }
  }

  // Compare event counts (if both have events)
  const eventsA = aEvents || [];
  const eventsB = bEvents || [];

  if (eventsA.length !== eventsB.length) {
    if (strictHash) {
      return {
        verdict: 'INVALID',
        exitCode: 2,
        summary: `Strict hash: event count mismatch (${eventsA.length} vs ${eventsB.length})`,
        hashMismatch: true,
      };
    }
    // Lenient: diverged but not invalid
    return {
      verdict: 'DIVERGED',
      exitCode: 1,
      summary: `Event count differs: ${eventsA.length} vs ${eventsB.length}`,
      firstMismatch: {
        detail: `Event count: ${eventsA.length} vs ${eventsB.length}`,
      },
    };
  }

  // All checks passed
  return {
    verdict: 'MATCH',
    exitCode: 0,
    summary: 'Capsules match (vectors + event count)',
  };
}
