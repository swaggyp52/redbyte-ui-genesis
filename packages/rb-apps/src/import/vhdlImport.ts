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
  const inferredRegisters = new Set<string>();
  const ffPattern =
    /if\s+(.+?)\s*=\s*'1'\s+then\s+([A-Za-z_][A-Za-z0-9_]*(?:\[\d+\]|\(\d+\))?)\s*<=\s*'0'\s*;\s*elsif\s+rising_edge\((.+?)\)\s+then\s+(?:if\s+(.+?)\s*=\s*'1'\s+then\s+)?\2\s*<=\s*(.+?)\s*;\s*(?:end\s+if\s*;\s*)?end\s+if\s*;/gi;
  let ffMatch: RegExpExecArray | null;
  while ((ffMatch = ffPattern.exec(body)) !== null) {
    const resetExpr = normalizeSignalRef(ffMatch[1]);
    const regName = normalizeSignalRef(ffMatch[2]);
    const clkExpr = normalizeSignalRef(ffMatch[3]);
    const ceExpr = ffMatch[4] ? normalizeSignalRef(ffMatch[4]) : undefined;
    const dExpr = normalizeSignalRef(ffMatch[5]);
    if (inferredRegisters.has(regName)) continue;
    inferredRegisters.add(regName);

    const portMap: Record<string, string> = {
      D: dExpr,
      C: clkExpr,
      CLR: resetExpr,
      Q: regName,
    };
    if (ceExpr) {
      portMap.CE = ceExpr;
    }

    instances.push({
      id: `proc_ff_${regName.replace(/[^a-zA-Z0-9_]/g, '_')}`,
      componentType: 'FDCE',
      portMap,
    });
  }

  let bodyWithoutProcesses = body;
  const processRx = /process\s*\([\s\S]*?\)\s*begin([\s\S]*?)end\s+process\s*;/gi;
  let processMatch: RegExpExecArray | null;
  let processIndex = 0;
  while ((processMatch = processRx.exec(body)) !== null) {
    processIndex += 1;
    const processBody = processMatch[1];
    const parsed = parseSequentialProcess(processBody, processIndex);
    if (parsed && !inferredRegisters.has(parsed.portMap.Q)) {
      instances.push(parsed);
      inferredRegisters.add(parsed.portMap.Q);
    }
  }
  bodyWithoutProcesses = body.replace(processRx, '');

  parseConcurrentAssignments(bodyWithoutProcesses, instances, events);

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

function parseSequentialProcess(body: string, index: number): ParsedInstance | null {
  const collapsed = body.replace(/\s+/g, ' ').trim();
  const resetMatch = collapsed.match(
    /if\s+(.+?)\s*=\s*'1'\s+then\s+([A-Za-z_][A-Za-z0-9_]*(?:\[\d+\]|\(\d+\))?)\s*<=\s*'0'\s*;/i
  );
  if (!resetMatch) return null;
  const resetExpr = normalizeSignalRef(resetMatch[1]);
  const regName = normalizeSignalRef(resetMatch[2]);

  const clkMatch = collapsed.match(/rising_edge\((.+?)\)\s+then\s+([\s\S]+)\s*end\s+if\s*;$/i);
  if (!clkMatch) return null;
  const clkExpr = normalizeSignalRef(clkMatch[1]);
  let clockBranch = clkMatch[2].trim();
  if (clockBranch.endsWith('end if;')) {
    clockBranch = clockBranch.slice(0, -'end if;'.length).trim();
  }

  let ceExpr: string | undefined;
  let dExpr: string;

  const ceMatch = clockBranch.match(/if\s+(.+?)\s*=\s*'1'\s+then\s+(.+?)\s*<=\s*(.+?)\s*;\s*end\s+if\s*;?/i);
  if (ceMatch) {
    ceExpr = normalizeSignalRef(ceMatch[1]);
    dExpr = normalizeSignalRef(ceMatch[3]);
  } else {
    const directMatch = clockBranch.match(
      /([A-Za-z_][A-Za-z0-9_]*(?:\[\d+\]|\(\d+\))?)\s*<=\s*(.+?)\s*;?$/i
    );
    if (!directMatch) return null;
    dExpr = normalizeSignalRef(directMatch[2]);
  }

  const portMap: Record<string, string> = {
    D: dExpr,
    C: clkExpr,
    CLR: resetExpr,
    Q: regName,
  };
  if (ceExpr) {
    portMap.CE = ceExpr;
  }

  return {
    id: `proc_ff_${index}_${regName.replace(/[^a-zA-Z0-9_]/g, '_')}`,
    componentType: 'FDCE',
    portMap,
  };
}

type ExprNode =
  | { kind: 'signal'; value: string }
  | { kind: 'not'; value: ExprNode }
  | { kind: 'binary'; op: 'and' | 'or' | 'xor'; left: ExprNode; right: ExprNode };

function tokenizeExpr(raw: string): string[] {
  const tokens = raw.match(/\(|\)|\b(?:not|and|or|xor)\b|[A-Za-z_][A-Za-z0-9_]*(?:\[\d+\]|\(\d+\))?/gi);
  return tokens?.map((token) => normalizeSignalRef(token)) ?? [];
}

function parseExpr(raw: string): ExprNode | null {
  const tokens = tokenizeExpr(raw);
  let i = 0;

  function parsePrimary(): ExprNode | null {
    const token = tokens[i];
    if (!token) return null;
    if (token === '(') {
      i += 1;
      const inner = parseOr();
      if (tokens[i] === ')') i += 1;
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

function parseConcurrentAssignments(
  body: string,
  instances: ParsedInstance[],
  events: WarningEvent[],
): void {
  let syntheticGateCount = 0;
  const assignmentRx = /([A-Za-z_][A-Za-z0-9_]*(?:\[\d+\]|\(\d+\))?)\s*<=\s*([^;]+);/gi;
  let assignmentMatch: RegExpExecArray | null;

  function materialize(node: ExprNode, targetHint: string): string {
    if (node.kind === 'signal') return node.value;
    if (node.kind === 'not') {
      const source = materialize(node.value, `${targetHint}_n`);
      const out = `__expr_not_${syntheticGateCount}`;
      syntheticGateCount += 1;
      instances.push({
        id: `expr_not_${syntheticGateCount}`,
        componentType: 'NOT',
        portMap: { in: source, out },
      });
      return out;
    }
    const left = materialize(node.left, `${targetHint}_l`);
    const right = materialize(node.right, `${targetHint}_r`);
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

  while ((assignmentMatch = assignmentRx.exec(body)) !== null) {
    const lhs = normalizeSignalRef(assignmentMatch[1]);
    const rhs = assignmentMatch[2].trim();
    const expr = parseExpr(rhs);
    if (!expr) {
      events.push({
        kind: 'named',
        message: `Signal assignment '${lhs} <= ${rhs}' not fully supported — skipped`,
        ident: lhs,
      });
      continue;
    }
    const resolved = materialize(expr, lhs);
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
