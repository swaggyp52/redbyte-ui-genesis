// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Bounded VCD (Value Change Dump) reader.
 *
 * A VCD is a waveform produced by an *external* simulator. RedByte imports it as
 * evidence — it never executes anything and never claims the waveform as its own
 * work. This reader parses the common IEEE-1364 VCD subset:
 *   - `$timescale`, `$scope`/`$upscope`, `$var`, `$enddefinitions`
 *   - value-change body: `#<time>`, scalar `0!`/`1"`/`x#`/`z$`, vector `b1010 !`,
 *     real `r3.14 !`
 * Unsupported/malformed lines become diagnostics (with ranges) rather than
 * throwing, so a partially-understood dump still yields the signals it can.
 *
 * Deterministic: signals are returned in declaration order; changes preserve
 * file order (already time-sorted in a well-formed VCD).
 */

import { positionAt, type SourceDiagnostic, type SourceRange } from './sourceDiagnostics';

export interface VcdTimescale {
  magnitude: number;
  /** s, ms, us, ns, ps, fs. */
  unit: string;
}

export interface VcdSignal {
  /** VCD identifier code (short symbol, e.g. `!`, `"`, `#`). */
  id: string;
  /** Human reference name as declared (e.g. `clk`, `data`). */
  reference: string;
  /** Bit width (1 for scalars). */
  width: number;
  /** Declared var type (wire, reg, integer, …). */
  varType: string;
  /** Hierarchical scope path at declaration (outermost first). */
  scope: string[];
}

export interface VcdValueChange {
  time: number;
  /** The signal id this change applies to. */
  id: string;
  /** Normalized value: `0`/`1`/`x`/`z` for scalars, or a bit/real string for vectors. */
  value: string;
}

export interface VcdWaveform {
  timescale: VcdTimescale | null;
  signals: VcdSignal[];
  changes: VcdValueChange[];
  /** The largest `#time` seen (0 when none). */
  endTime: number;
  diagnostics: SourceDiagnostic[];
}

const TIMESCALE_UNITS = new Set(['s', 'ms', 'us', 'ns', 'ps', 'fs']);

function lineRange(text: string, lineStart: number, lineEnd: number): SourceRange {
  return { start: positionAt(text, lineStart), end: positionAt(text, lineEnd) };
}

/**
 * Parse a VCD document into a {@link VcdWaveform}. Never throws; problems are
 * reported as diagnostics.
 */
export function parseVcd(text: string): VcdWaveform {
  const diagnostics: SourceDiagnostic[] = [];
  const signals: VcdSignal[] = [];
  const signalIds = new Set<string>();
  const changes: VcdValueChange[] = [];
  const scopeStack: string[] = [];
  let timescale: VcdTimescale | null = null;
  let currentTime = 0;
  let endTime = 0;
  let inDefinitions = true;

  // Tokenize into whitespace-separated tokens while tracking each token's offset
  // for diagnostics. VCD is a free-form token stream, but keeping line offsets
  // for the command handlers is enough for useful diagnostics.
  const lines = splitLinesWithOffsets(text);

  for (const { content, start, end } of lines) {
    const trimmed = content.trim();
    if (trimmed.length === 0) continue;

    // Declaration commands.
    if (trimmed.startsWith('$')) {
      const command = trimmed.split(/\s+/)[0];
      switch (command) {
        case '$timescale': {
          const body = readCommandBody(trimmed, '$timescale');
          const parsed = parseTimescale(body);
          if (parsed) timescale = parsed;
          else diagnostics.push({ severity: 'warning', code: 'vcd.timescale', message: `Unrecognized timescale: "${body}"`, source: 'vcd', range: lineRange(text, start, end) });
          break;
        }
        case '$scope': {
          const parts = trimmed.replace(/\$end$/, '').trim().split(/\s+/);
          // $scope <type> <name> $end
          if (parts.length >= 3) scopeStack.push(parts[2]!);
          break;
        }
        case '$upscope': {
          scopeStack.pop();
          break;
        }
        case '$var': {
          // $var <type> <width> <id> <reference> [range] $end
          const parts = trimmed.replace(/\$end$/, '').trim().split(/\s+/);
          if (parts.length >= 5) {
            const varType = parts[1]!;
            const width = Number.parseInt(parts[2]!, 10);
            const id = parts[3]!;
            const reference = parts.slice(4).join(' ');
            if (!Number.isFinite(width) || width <= 0) {
              diagnostics.push({ severity: 'warning', code: 'vcd.var-width', message: `Invalid $var width in "${trimmed}"`, source: 'vcd', range: lineRange(text, start, end) });
            } else {
              if (!signalIds.has(id)) {
                signals.push({ id, reference, width, varType, scope: [...scopeStack] });
                signalIds.add(id);
              }
            }
          } else {
            diagnostics.push({ severity: 'warning', code: 'vcd.var', message: `Malformed $var: "${trimmed}"`, source: 'vcd', range: lineRange(text, start, end) });
          }
          break;
        }
        case '$enddefinitions': {
          inDefinitions = false;
          break;
        }
        // Ignored declaration commands (date/version/comment/dumpvars markers).
        case '$date':
        case '$version':
        case '$comment':
        case '$dumpvars':
        case '$dumpall':
        case '$dumpon':
        case '$dumpoff':
        case '$end':
          break;
        default:
          // Unknown $ command — ignore silently during definitions, note in body.
          if (!inDefinitions) {
            diagnostics.push({ severity: 'info', code: 'vcd.unknown-command', message: `Ignored command: "${command}"`, source: 'vcd', range: lineRange(text, start, end) });
          }
          break;
      }
      continue;
    }

    // Simulation body.
    if (trimmed.startsWith('#')) {
      const t = Number.parseInt(trimmed.slice(1), 10);
      if (Number.isFinite(t)) {
        currentTime = t;
        if (t > endTime) endTime = t;
      } else {
        diagnostics.push({ severity: 'warning', code: 'vcd.time', message: `Invalid timestamp: "${trimmed}"`, source: 'vcd', range: lineRange(text, start, end) });
      }
      continue;
    }

    const change = parseValueChange(trimmed);
    if (!change) {
      diagnostics.push({ severity: 'warning', code: 'vcd.value', message: `Unparsed value change: "${trimmed}"`, source: 'vcd', range: lineRange(text, start, end) });
      continue;
    }
    if (!signalIds.has(change.id)) {
      diagnostics.push({ severity: 'warning', code: 'vcd.unknown-signal', message: `Value change for undeclared signal id "${change.id}"`, source: 'vcd', range: lineRange(text, start, end) });
      continue;
    }
    changes.push({ time: currentTime, id: change.id, value: change.value });
  }

  if (signals.length === 0) {
    diagnostics.push({ severity: 'error', code: 'vcd.no-signals', message: 'No $var signal declarations found — not a usable VCD.', source: 'vcd' });
  }

  return { timescale, signals, changes, endTime, diagnostics };
}

/** The ordered value-change timeline for one signal id. */
export function signalTimeline(waveform: VcdWaveform, id: string): { time: number; value: string }[] {
  return waveform.changes.filter((c) => c.id === id).map((c) => ({ time: c.time, value: c.value }));
}

/** Look up a signal by its human reference name (first match). */
export function signalByReference(waveform: VcdWaveform, reference: string): VcdSignal | undefined {
  return waveform.signals.find((s) => s.reference === reference);
}

/** The value of a signal at (or most recently before) a given time. */
export function valueAtTime(waveform: VcdWaveform, id: string, time: number): string | undefined {
  let value: string | undefined;
  for (const change of waveform.changes) {
    if (change.id !== id) continue;
    if (change.time > time) break;
    value = change.value;
  }
  return value;
}

function parseTimescale(body: string): VcdTimescale | null {
  const compact = body.replace(/\s+/g, '');
  const match = /^(\d+)(s|ms|us|ns|ps|fs)$/.exec(compact);
  if (!match) return null;
  const magnitude = Number.parseInt(match[1]!, 10);
  const unit = match[2]!;
  if (!Number.isFinite(magnitude) || !TIMESCALE_UNITS.has(unit)) return null;
  return { magnitude, unit };
}

function parseValueChange(token: string): { id: string; value: string } | null {
  const head = token[0];
  if (head === '0' || head === '1' || head === 'x' || head === 'X' || head === 'z' || head === 'Z') {
    // Scalar: <value><id>
    const id = token.slice(1).trim();
    if (!id) return null;
    return { id, value: head.toLowerCase() };
  }
  if (head === 'b' || head === 'B' || head === 'r' || head === 'R') {
    // Vector/real: <b|r><value> <id>
    const rest = token.slice(1).trim();
    const spaceIdx = rest.indexOf(' ');
    if (spaceIdx === -1) {
      // Some dumps put a space; if none, the whole token after prefix up to last
      // char group is the value and the trailing token is the id — but VCD
      // requires a space. Treat as malformed.
      return null;
    }
    const value = rest.slice(0, spaceIdx);
    const id = rest.slice(spaceIdx + 1).trim();
    if (!value || !id) return null;
    return { id, value: (head === 'b' || head === 'B' ? 'b' : 'r') + value.toLowerCase() };
  }
  return null;
}

function readCommandBody(line: string, command: string): string {
  return line.slice(command.length).replace(/\$end$/, '').trim();
}

function splitLinesWithOffsets(text: string): { content: string; start: number; end: number }[] {
  const out: { content: string; start: number; end: number }[] = [];
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text.charCodeAt(i) === 10) {
      let end = i;
      // strip a trailing \r
      const content = text.slice(start, end).replace(/\r$/, '');
      out.push({ content, start, end });
      start = i + 1;
    }
  }
  return out;
}
