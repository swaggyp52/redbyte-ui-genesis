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
// A clocked process in the register template (REGISTER_PROCESS_RX) is rebuilt as a
// register whose next state, enable and reset are rebuilt as gates. Anything the parser does not
// rebuild exactly (another process, an expression outside and/or/xor/not, ...) is a warning
// flagged dropsLogic, and parsedHdlToCircuit then keeps only the port scaffold.

import type { ParsedHDL, ParsedPort, ParsedInstance, ParsedHdlWarning } from './hdlToCircuit';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripComments(src: string): string {
  // VHDL line comments: -- to end of line
  return src.replace(/--[^\n]*/g, '');
}

function normaliseWs(src: string): string {
  return src.replace(/\r\n/g, '\n').replace(/\t/g, ' ').replace(/ {2,}/g, ' ');
}

function normalizeSignalRef(raw: string): string {
  return raw.replace(/\(\s*(\d+)\s*\)/g, '[$1]').trim();
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

/** dropsLogic: the construct was not rebuilt, so the circuit cannot be the design (ParsedHdlWarning). */
type WarningEvent =
  | { kind: 'structural'; message: string; dropsLogic?: true }
  | { kind: 'named'; message: string; ident: string; dropsLogic?: true };

function mapWarningEvents(events: WarningEvent[], originalSource: string): ParsedHdlWarning[] {
  return events.map((e) => {
    const drops = e.dropsLogic ? { dropsLogic: true as const } : {};
    if (e.kind === 'structural') return { message: e.message, kind: 'structural' as const, ...drops };
    const pos = findIdentifierLineCol(originalSource, e.ident);
    return { message: e.message, kind: 'named' as const, ...(pos ?? {}), ...drops };
  });
}

// ─── Entity parser ────────────────────────────────────────────────────────────

function parseEntity(src: string): { name: string; ports: ParsedPort[]; hasGenerics: boolean } | null {
  // Match entity header first, then parse the port parenthesis block with a
  // small balanced-parenthesis scanner (regex alone breaks on vector types).
  const entityRx = /entity\s+(\w+)\s+is/i;
  const hasGenericsRx = /entity\s+\w+\s+is\s+generic\s*\(/i;
  const m = src.match(entityRx);
  if (!m) return null;
  const hasGenerics = hasGenericsRx.test(src);

  const entityName = m[1];
  const portKeyword = src.slice(m.index ?? 0).search(/\bport\s*\(/i);
  if (portKeyword < 0) return null;
  const portStart = (m.index ?? 0) + portKeyword;
  const openParen = src.indexOf('(', portStart);
  if (openParen < 0) return null;
  let depth = 0;
  let closeParen = -1;
  for (let idx = openParen; idx < src.length; idx += 1) {
    const ch = src[idx];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        closeParen = idx;
        break;
      }
    }
  }
  if (closeParen < 0) return null;
  const portBlock = src.slice(openParen + 1, closeParen);
  const ports: ParsedPort[] = [];

  // Each port line: <name> [, <name>] : [in|out|inout] <type>
  const portLineRx = /([\w\s,]+?)\s*:\s*(in|out|inout)\s+([\w_]+(?:\s*\([\w\s\d]+\))?)\s*(?:;|$)/gi;
  let pm: RegExpExecArray | null;
  while ((pm = portLineRx.exec(portBlock)) !== null) {
    const names = pm[1].split(',').map((s) => s.trim()).filter(Boolean);
    const dir = pm[2].toLowerCase() === 'out' ? 'out' : 'in';
    const typeName = pm[3].trim();
    const vectorMatch = typeName.match(/std_logic_vector\s*\(\s*(\d+)\s+downto\s+(\d+)\s*\)/i);
    for (const name of names) {
      if (!name) continue;
      if (vectorMatch) {
        const msb = Number.parseInt(vectorMatch[1], 10);
        const lsb = Number.parseInt(vectorMatch[2], 10);
        for (let index = msb; index >= lsb; index -= 1) {
          ports.push({
            name: `${name}[${index}]`,
            direction: dir,
            typeName: 'STD_LOGIC',
          });
        }
        continue;
      }
      ports.push({ name, direction: dir, typeName });
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

  const archStart = src.search(/architecture\s+\w+\s+of\s+\w+\s+is/i);
  if (archStart < 0) {
    return { instances, signals };
  }
  const archSlice = src.slice(archStart);
  const beginMatch = archSlice.match(/\bbegin\b/i);
  if (!beginMatch || beginMatch.index === undefined) {
    return { instances, signals };
  }
  const beginIndex = beginMatch.index;
  const declBlock = archSlice.slice(0, beginIndex);
  let body = archSlice.slice(beginIndex + beginMatch[0].length);
  body = body.replace(/end\s+(?:architecture\s+)?\w*\s*;\s*$/i, '');

  // Signal declarations (between 'is' and 'begin')
  const sigRx = /signal\s+([\w,\s]+?)\s*:\s*[\w_]+(?:\s*\([\w\s\d]+\))?\s*(?::=\s*['"\w]+)?\s*;/gi;
  let sigM: RegExpExecArray | null;
  while ((sigM = sigRx.exec(declBlock)) !== null) {
    const names = sigM[1].split(',').map((s) => s.trim()).filter(Boolean);
    signals.push(...names);
  }

  parseBeginBlock(body, instances, signals, events);
  return { instances, signals };
}

function parseBeginBlock(
  body: string,
  instances: ParsedInstance[],
  _signals: string[],
  events: WarningEvent[],
): void {
  const materialize = createExprMaterializer(instances);
  const bodyWithoutProcesses = parseRegisterProcesses(body, instances, events, materialize);
  parseConcurrentAssignments(bodyWithoutProcesses, instances, events, materialize);

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

    // Named port map: portName => actual
    const namedRx = /(\w+)\s*=>\s*([^,]+)/g;
    let nmm: RegExpExecArray | null;
    while ((nmm = namedRx.exec(portMapStr)) !== null) {
      portMap[nmm[1].trim()] = portActual(nmm[2]);
    }

    if (Object.keys(portMap).length === 0) {
      // Positional port map: fallback, just record positions as port0, port1, …
      const positional = portMapStr.split(',').map((s) => s.trim()).filter(Boolean);
      positional.forEach((sig, idx) => {
        portMap[`port${idx}`] = portActual(sig);
      });
    }

    instances.push({ id: label, componentType: compName, portMap });
  }
}

/**
 * A port-map actual as the importer wires it: a constant '0'/'1' loses its quotes (0, 1), a
 * signal or one bit of a vector is normalised (SW(3) -> SW[3]). Anything else is kept as
 * written, so it resolves to no source and the importer names it instead of guessing.
 */
function portActual(raw: string): string {
  const actual = raw.trim();
  if (/^'[01]'$/.test(actual)) return actual.slice(1, 2);
  return normalizeSignalRef(actual);
}

/** A signal reference the parser rebuilds: an identifier, optionally one bit of a vector. */
const SIGNAL_REF = String.raw`[A-Za-z_][A-Za-z0-9_]*(?:\[\d+\]|\(\s*\d+\s*\))?`;

/**
 * The one process shape the importer rebuilds, with nothing else in the process (whitespace
 * collapsed):
 *   if <reset> = '1' then <q> <= '0';
 *   elsif rising_edge(<clock>) then [if <enable> = '1' then] <q> <= <next>; [end if;]
 *   end if;
 * It becomes a Register1 with an active-high asynchronous clear (FDCE). Reset, enable and next
 * state may be and/or/xor/not expressions, rebuilt as gates; the clock is a signal.
 */
const REGISTER_PROCESS_RX = new RegExp(
  String.raw`^if\s+(.+?)\s*=\s*'1'\s+then\s+(${SIGNAL_REF})\s*<=\s*'0'\s*;\s*` +
    String.raw`elsif\s+rising_edge\s*\(\s*(${SIGNAL_REF})\s*\)\s+then\s+` +
    String.raw`(?:if\s+(.+?)\s*=\s*'1'\s+then\s+\2\s*<=\s*([^;]+?)\s*;\s*end\s+if\s*;|\2\s*<=\s*([^;]+?)\s*;)\s*` +
    String.raw`end\s+if\s*;$`,
  'i',
);

/** [label :] process [(sensitivity)] [is] <declarations> begin <statements> end process [label]; */
const PROCESS_RX =
  /(?:\b\w+\s*:\s*)?\bprocess\b\s*(?:\(([^()]*(?:\([^()]*\)[^()]*)*)\))?\s*(?:\bis\b)?([\s\S]*?)\bbegin\b([\s\S]*?)\bend\s+process\b[^;]*;/gi;

/**
 * Rebuild every register process (REGISTER_PROCESS_RX) and name every other process, which is
 * not imported. Returns the body without its processes, for the concurrent statements.
 */
function parseRegisterProcesses(
  body: string,
  instances: ParsedInstance[],
  events: WarningEvent[],
  materialize: (node: ExprNode) => string,
): string {
  const registers = new Set<string>();
  let processMatch: RegExpExecArray | null;
  PROCESS_RX.lastIndex = 0;
  while ((processMatch = PROCESS_RX.exec(body)) !== null) {
    const sensitivity = (processMatch[1] ?? '').replace(/\s+/g, ' ').trim();
    const statements = processMatch[3].replace(/\s+/g, ' ').trim();
    const register = processMatch[2].trim() ? null : REGISTER_PROCESS_RX.exec(statements);
    if (!register) {
      const preview = statements.length > 60 ? `${statements.slice(0, 57)}...` : statements;
      events.push({
        kind: 'structural',
        message:
          `PROCESS (${sensitivity}) "${preview}" not imported: RedByte rebuilds only a register process ` +
          `(if <reset> = '1' then <q> <= '0'; elsif rising_edge(<clock>) then [if <enable> = '1' then] <q> <= <next>; end if;).`,
        dropsLogic: true,
      });
      continue;
    }
    const regName = normalizeSignalRef(register[2]);
    if (registers.has(regName.toLowerCase())) {
      events.push({ kind: 'named', message: `Register '${regName}' is assigned in more than one process — not imported`, ident: regName, dropsLogic: true });
      continue;
    }
    registers.add(regName.toLowerCase());
    const roles: Array<[string, string | undefined]> = [
      ['next state', register[5] ?? register[6]],
      ['reset', register[1]],
      ['enable', register[4]],
    ];
    const parsed = roles.map(([role, raw]) => ({ role, raw, expr: raw === undefined ? null : parseExpr(raw) }));
    const unsupported = parsed.find((part) => part.raw !== undefined && !part.expr);
    if (unsupported) {
      events.push({
        kind: 'named',
        message: `Register '${regName}' ${unsupported.role} '${unsupported.raw!.trim()}' not imported: only and, or, xor, not, '0' and '1' are rebuilt`,
        ident: regName,
        dropsLogic: true,
      });
      continue;
    }
    const [next, reset, enable] = parsed.map((part) => (part.expr ? materialize(part.expr) : undefined));
    const portMap: Record<string, string> = {
      D: next!,
      C: normalizeSignalRef(register[3]),
      CLR: reset!,
      Q: regName,
    };
    if (enable !== undefined) portMap.CE = enable;
    instances.push({ id: `proc_ff_${regName.replace(/[^a-zA-Z0-9_]/g, '_')}`, componentType: 'FDCE', portMap });
  }
  const rest = body.replace(PROCESS_RX, ' ');
  if (/\bprocess\b/i.test(rest)) {
    events.push({ kind: 'structural', message: 'A PROCESS block could not be parsed — not imported.', dropsLogic: true });
  }
  return rest;
}

type ExprNode =
  | { kind: 'signal'; value: string }
  | { kind: 'not'; value: ExprNode }
  | { kind: 'binary'; op: 'and' | 'or' | 'xor'; left: ExprNode; right: ExprNode };

/** Parentheses, the constants '0' and '1', not/and/or/xor and signal references (one bit at most). */
const EXPR_TOKEN_RX = /\(|\)|'[01]'|\b(?:not|and|or|xor)\b|[A-Za-z_][A-Za-z0-9_]*(?:\[\d+\]|\(\s*\d+\s*\))?/gi;

/** Null when the text holds anything else: an expression is rebuilt whole or not at all. */
function tokenizeExpr(raw: string): string[] | null {
  if (raw.replace(EXPR_TOKEN_RX, '').trim() !== '') return null;
  return (raw.match(EXPR_TOKEN_RX) ?? []).map((token) => normalizeSignalRef(token));
}

/** A constant '0'/'1' is a signal leaf; parsedHdlToCircuit ties it to Ground/PowerSource. */
function parseExpr(raw: string): ExprNode | null {
  const tokenized = tokenizeExpr(raw);
  if (!tokenized) return null;
  const tokens: string[] = tokenized;
  let i = 0;

  function parsePrimary(): ExprNode | null {
    const token = tokens[i];
    if (!token) return null;
    if (token === '(') {
      i += 1;
      const inner = parseOr();
      if (tokens[i] !== ')') return null;
      i += 1;
      return inner;
    }
    if (/^(and|or|xor|not)$/i.test(token)) return null;
    i += 1;
    return { kind: 'signal', value: token };
  }

  function parseNotExpr(): ExprNode | null {
    if (tokens[i]?.toLowerCase() === 'not') {
      i += 1;
      const child = parseNotExpr();
      return child ? { kind: 'not', value: child } : null;
    }
    return parsePrimary();
  }

  function parseAnd(): ExprNode | null {
    let left = parseNotExpr();
    while (left && tokens[i]?.toLowerCase() === 'and') {
      i += 1;
      const right = parseNotExpr();
      if (!right) return null;
      left = { kind: 'binary', op: 'and', left, right };
    }
    return left;
  }

  function parseXor(): ExprNode | null {
    let left = parseAnd();
    while (left && tokens[i]?.toLowerCase() === 'xor') {
      i += 1;
      const right = parseAnd();
      if (!right) return null;
      left = { kind: 'binary', op: 'xor', left, right };
    }
    return left;
  }

  function parseOr(): ExprNode | null {
    let left = parseXor();
    while (left && tokens[i]?.toLowerCase() === 'or') {
      i += 1;
      const right = parseXor();
      if (!right) return null;
      left = { kind: 'binary', op: 'or', left, right };
    }
    return left;
  }

  const parsed = parseOr();
  return parsed && i === tokens.length ? parsed : null;
}

/**
 * Rebuilds a parsed expression as gate instances and returns the signal carrying its value. One
 * materializer per architecture, so register next states and concurrent assignments never reuse
 * a gate id.
 */
function createExprMaterializer(instances: ParsedInstance[]): (node: ExprNode) => string {
  let syntheticGateCount = 0;

  function materialize(node: ExprNode): string {
    if (node.kind === 'signal') return node.value;
    if (node.kind === 'not') {
      const source = materialize(node.value);
      const out = `__expr_not_${syntheticGateCount}`;
      syntheticGateCount += 1;
      instances.push({
        id: `expr_not_${syntheticGateCount}`,
        componentType: 'NOT',
        portMap: { in: source, out },
      });
      return out;
    }
    const left = materialize(node.left);
    const right = materialize(node.right);
    const out = `__expr_${node.op}_${syntheticGateCount}`;
    syntheticGateCount += 1;
    const componentType = node.op.toUpperCase();
    instances.push({
      id: `expr_${node.op}_${syntheticGateCount}`,
      componentType,
      portMap: { a: left, b: right, out },
    });
    return out;
  }

  return materialize;
}

function parseConcurrentAssignments(
  body: string,
  instances: ParsedInstance[],
  events: WarningEvent[],
  materialize: (node: ExprNode) => string,
): void {
  const assignmentRx = /([A-Za-z_][A-Za-z0-9_]*(?:\[\d+\]|\(\d+\))?)\s*<=\s*([^;]+);/gi;
  let assignmentMatch: RegExpExecArray | null;

  while ((assignmentMatch = assignmentRx.exec(body)) !== null) {
    const lhs = normalizeSignalRef(assignmentMatch[1]);
    const rhs = assignmentMatch[2].trim();
    const expr = parseExpr(rhs);
    if (!expr) {
      events.push({
        kind: 'named',
        message: `Signal assignment '${lhs} <= ${rhs}' not fully supported — skipped`,
        ident: lhs,
        dropsLogic: true,
      });
      continue;
    }
    const resolved = materialize(expr);
    if (resolved !== lhs) {
      instances.push({
        id: `wire_${lhs.replace(/[^a-zA-Z0-9_]/g, '_')}`,
          componentType: 'ALIAS',
        portMap: { in: resolved, out: lhs },
      });
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse VHDL source text and return a ParsedHDL intermediate representation.
 * Handles structural VHDL and register processes; every construct it does not rebuild is a
 * warning flagged dropsLogic.
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
