// Copyright (c) 2025 Connor Angiel — RedByte OS Genesis
// VHDL structural parser → ParsedHDL
//
// Supports the subset of VHDL used in intro FPGA labs:
//   - entity … port (…); end entity;
//   - architecture … is
//       component declarations (optional)
//       signal declarations
//     begin
//       component instantiations with port map
//     end architecture;
//
// Behavioural 'process' blocks are ignored with a warning.

import type { ParsedHDL, ParsedPort, ParsedInstance, ParsedHdlWarning } from './hdlToCircuit';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripComments(src: string): string {
  // VHDL line comments: -- to end of line
  return src.replace(/--[^\n]*/g, '');
}

function normaliseWs(src: string): string {
  return src.replace(/\r\n/g, '\n').replace(/\t/g, ' ').replace(/ {2,}/g, ' ');
}

// ─── Position helpers ─────────────────────────────────────────────────────────

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findIdentifierLineCol(
  source: string,
  ident: string,
): { line: number; col: number } | null {
  if (!ident || !ident.trim()) return null;
  const re = new RegExp(`\\b${escapeRegExp(ident.trim())}\\b`);
  const m = re.exec(source);
  if (!m) return null;
  let line = 1;
  let lastNl = -1;
  for (let i = 0; i < m.index; i++) {
    if (source.charCodeAt(i) === 10) { line++; lastNl = i; }
  }
  return { line, col: m.index - lastNl };
}

// ─── Warning event types ──────────────────────────────────────────────────────

type WarningEvent =
  | { kind: 'structural'; message: string }
  | { kind: 'named'; message: string; ident: string };

function mapWarningEvents(events: WarningEvent[], originalSource: string): ParsedHdlWarning[] {
  return events.map((e) => {
    if (e.kind === 'structural') return { message: e.message, kind: 'structural' as const };
    const pos = findIdentifierLineCol(originalSource, e.ident);
    return { message: e.message, kind: 'named' as const, ...(pos ?? {}) };
  });
}

// ─── Entity parser ────────────────────────────────────────────────────────────

function parseEntity(src: string): { name: string; ports: ParsedPort[]; hasGenerics: boolean } | null {
  // Match: entity <name> is [generic (...);] port ( ... );
  // The optional generic clause must be handled — without it, entities with generics fail silently.
  const entityRx = /entity\s+(\w+)\s+is\s+(?:generic\s*\([\s\S]*?\)\s*;[\s\n]*)?\s*port\s*\(([\s\S]*?)\)\s*;/i;
  const hasGenericsRx = /entity\s+\w+\s+is\s+generic\s*\(/i;
  const m = src.match(entityRx);
  if (!m) return null;
  const hasGenerics = hasGenericsRx.test(src);

  const entityName = m[1];
  const portBlock = m[2];
  const ports: ParsedPort[] = [];

  // Each port line: <name> [, <name>] : [in|out|inout] <type>
  const portLineRx = /([\w\s,]+?)\s*:\s*(in|out|inout)\s+([\w_]+(?:\s*\([\w\s\d]+\))?)\s*(?:;|$)/gi;
  let pm: RegExpExecArray | null;
  while ((pm = portLineRx.exec(portBlock)) !== null) {
    const names = pm[1].split(',').map((s) => s.trim()).filter(Boolean);
    const dir = pm[2].toLowerCase() === 'out' ? 'out' : 'in';
    const typeName = pm[3].trim();
    for (const name of names) {
      if (name) ports.push({ name, direction: dir, typeName });
    }
  }

  return { name: entityName, ports, hasGenerics };
}

// ─── Architecture parser ──────────────────────────────────────────────────────

function parseArchitecture(
  src: string,
  events: WarningEvent[],
): { instances: ParsedInstance[]; signals: string[] } {
  const instances: ParsedInstance[] = [];
  const signals: string[] = [];

  // Find architecture body
  const archRx = /architecture\s+\w+\s+of\s+\w+\s+is([\s\S]*?)begin([\s\S]*?)end\s+(?:architecture\s*)?\w*\s*;/i;
  const archM = src.match(archRx);
  if (!archM) {
    // Try simplified: just look for begin...end
    const simpleRx = /begin([\s\S]*?)end\s+(?:architecture\s*)?\w*\s*;/i;
    const sm = src.match(simpleRx);
    if (!sm) return { instances, signals };
    parseBeginBlock(sm[1], instances, signals, events);
    return { instances, signals };
  }

  // Signal declarations (between 'is' and 'begin')
  const declBlock = archM[1];
  const sigRx = /signal\s+([\w,\s]+?)\s*:\s*[\w_]+(?:\s*\([\w\s\d]+\))?\s*(?::=\s*['"\w]+)?\s*;/gi;
  let sigM: RegExpExecArray | null;
  while ((sigM = sigRx.exec(declBlock)) !== null) {
    const names = sigM[1].split(',').map((s) => s.trim()).filter(Boolean);
    signals.push(...names);
  }

  parseBeginBlock(archM[2], instances, signals, events);
  return { instances, signals };
}

function parseBeginBlock(
  body: string,
  instances: ParsedInstance[],
  _signals: string[],
  events: WarningEvent[],
): void {
  // Warn about process blocks
  if (/\bprocess\b/i.test(body)) {
    events.push({
      kind: 'structural',
      message: 'Behavioural PROCESS blocks detected — only structural port-map connections are imported.',
    });
  }

  // Concurrent signal assignments (a <= b) — ignored with warning
  if (/\w+\s*<=\s*\w+/.test(body)) {
    // Handle simple pass-through assignments by treating them as wire instances
    // e.g. F <= A; → create a Wire instance
    const assignRx = /(\w+)\s*<=\s*([\w\s()']+?)\s*;/g;
    let am: RegExpExecArray | null;
    while ((am = assignRx.exec(body)) !== null) {
      const lhs = am[1].trim();
      const rhs = am[2].trim();
      if (/^[\w]+$/.test(rhs)) {
        // Simple assignment: signal <= signal — create a Wire node
        instances.push({
          id: `wire_${lhs}`,
          componentType: 'Wire',
          portMap: { in: rhs, out: lhs },
        });
      } else {
        events.push({ kind: 'named', message: `Signal assignment '${lhs} <= ${rhs}' not fully supported — skipped`, ident: lhs });
      }
    }
  }

  // Component instantiations:
  // <label> : <component_name> port map ( ... );
  // <label> : entity <lib>.<component_name> port map ( ... );
  const instRx = /(\w+)\s*:\s*(?:entity\s+\w+\.)?\s*(\w+)\s+(?:generic\s+map\s*\([\s\S]*?\)\s*)?port\s+map\s*\(([\s\S]*?)\)\s*;/gi;
  let im: RegExpExecArray | null;
  while ((im = instRx.exec(body)) !== null) {
    const label = im[1].trim();
    const compName = im[2].trim();

    // Skip non-gate keywords that might match
    if (/^(signal|variable|constant|function|procedure|type|when|else|generate|if|for)$/i.test(compName)) {
      continue;
    }

    const portMapStr = im[3];
    const portMap: Record<string, string> = {};

    // Named port map: portName => signal
    const namedRx = /(\w+)\s*=>\s*([\w']+)/g;
    let nmm: RegExpExecArray | null;
    while ((nmm = namedRx.exec(portMapStr)) !== null) {
      const hdlPort = nmm[1].trim();
      const signal = nmm[2].trim().replace(/^'(.)'$/, '$1'); // strip '1' → 1
      portMap[hdlPort] = signal;
    }

    if (Object.keys(portMap).length === 0) {
      // Positional port map: fallback, just record positions as port0, port1, …
      const positional = portMapStr.split(',').map((s) => s.trim()).filter(Boolean);
      positional.forEach((sig, idx) => {
        portMap[`port${idx}`] = sig.replace(/^'(.)'$/, '$1');
      });
    }

    instances.push({ id: label, componentType: compName, portMap });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse VHDL source text and return a ParsedHDL intermediate representation.
 * Handles structural VHDL only; behavioural process blocks are noted as warnings.
 */
export function parseVhdl(source: string): ParsedHDL {
  const originalSource = source;
  const events: WarningEvent[] = [];
  const clean = normaliseWs(stripComments(source));

  const entity = parseEntity(clean);
  if (!entity) {
    events.push({ kind: 'structural', message: 'No entity declaration found. Make sure you paste a complete VHDL file.' });
  } else if (entity.hasGenerics) {
    events.push({
      kind: 'structural',
      message: 'Entity uses generics — generic values are not imported (ports are extracted, generic parameters are ignored).',
    });
  }

  const { instances, signals } = parseArchitecture(clean, events);

  return {
    entityName: entity?.name ?? 'unknown',
    ports: entity?.ports ?? [],
    instances,
    signals,
    warnings: mapWarningEvents(events, originalSource),
    lang: 'vhdl',
  };
}

/**
 * Returns all entity names found in the VHDL source (in order of appearance).
 * Does not parse ports — use parseVhdl() after selecting the desired entity.
 */
export function scanVhdlEntities(source: string): string[] {
  // Match entities with or without a generic clause before port
  const rx = /entity\s+(\w+)\s+is\s+(?:generic\s*\([\s\S]*?\)\s*;[\s\n]*)?\s*port\s*\(/gi;
  const names: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(source)) !== null) {
    names.push(m[1]);
  }
  return names;
}
