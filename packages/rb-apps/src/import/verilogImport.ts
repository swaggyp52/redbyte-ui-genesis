// Copyright (c) 2025 Connor Angiel — RedByte OS Genesis
// Verilog structural parser → ParsedHDL
//
// Supports the subset used in intro FPGA labs:
//   - module <name> ( [port declarations] ); … endmodule
//   - input / output / wire declarations
//   - gate primitive instantiations: and, or, not, nand, nor, xor, xnor
//   - module instantiations: <ModuleName> [#(…)] <label> ( .port(signal) … );
//   - Behavioural always / assign blocks noted as warnings.

import type { ParsedHDL, ParsedPort, ParsedInstance } from './hdlToCircuit';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripComments(src: string): string {
  // Block comments: /* … */
  let s = src.replace(/\/\*[\s\S]*?\*\//g, '');
  // Line comments: // to EOL
  s = s.replace(/\/\/[^\n]*/g, '');
  return s;
}

function normaliseWs(src: string): string {
  return src.replace(/\r\n/g, '\n').replace(/\t/g, ' ').replace(/ {2,}/g, ' ');
}

// ─── Module header parser ─────────────────────────────────────────────────────

function parseModule(src: string): { name: string; ports: ParsedPort[] } | null {
  // Verilog 2001 / SystemVerilog inline port declarations:
  //   module top(input A, input B, output F); …
  const modRx = /module\s+(\w+)\s*(?:#\s*\([^)]*\))?\s*\(([\s\S]*?)\)\s*;/i;
  const m = src.match(modRx);
  if (!m) return null;

  const name = m[1];
  const portBlock = m[2];
  const ports: ParsedPort[] = [];

  // Inline-style: input/output/wire annotations in port list
  const inlineRx = /\b(input|output)\s+(?:wire\s+)?(?:\[\d+:\d+\]\s*)?(\w+)/g;
  let im: RegExpExecArray | null;
  while ((im = inlineRx.exec(portBlock)) !== null) {
    const dir: 'in' | 'out' = im[1].toLowerCase() === 'output' ? 'out' : 'in';
    ports.push({ name: im[2], direction: dir, typeName: 'logic' });
  }

  // If no inline directions, parse port names only and look for body declarations
  if (ports.length === 0) {
    const names = portBlock.split(',').map((s) => s.trim()).filter(Boolean);
    for (const n of names) {
      if (/^\w+$/.test(n)) ports.push({ name: n, direction: 'in', typeName: 'logic' });
    }
  }

  return { name, ports };
}

// ─── Body parser ──────────────────────────────────────────────────────────────

function parseBody(
  src: string,
  ports: ParsedPort[],
  warnings: string[],
): { instances: ParsedInstance[]; signals: string[] } {
  const instances: ParsedInstance[] = [];
  const signals: string[] = [];

  // Extract body: between first ';' (after module header) and 'endmodule'
  const bodyRx = /;([\s\S]*?)endmodule/i;
  const bm = src.match(bodyRx);
  const body = bm ? bm[1] : src;

  // Body-level port direction declarations (Verilog 2001 style):
  //   input A; output F;
  const portDeclRx = /\b(input|output)\s+(?:wire\s+)?(?:\[\d+:\d+\]\s*)?(\w+)\s*;/g;
  let pdm: RegExpExecArray | null;
  const knownPorts = new Map(ports.map((p) => [p.name, p]));
  while ((pdm = portDeclRx.exec(body)) !== null) {
    const dir: 'in' | 'out' = pdm[1].toLowerCase() === 'output' ? 'out' : 'in';
    const name = pdm[2];
    if (knownPorts.has(name)) {
      knownPorts.get(name)!.direction = dir;
    } else {
      ports.push({ name, direction: dir, typeName: 'logic' });
      knownPorts.set(name, ports[ports.length - 1]);
    }
  }

  // Wire declarations
  const wireRx = /\bwire\s+(?:\[\d+:\d+\]\s*)?(\w+)\s*;/g;
  let wm: RegExpExecArray | null;
  while ((wm = wireRx.exec(body)) !== null) {
    signals.push(wm[1]);
  }

  // Warn about always blocks
  if (/\balways\b/i.test(body)) {
    warnings.push('Behavioural always blocks detected — only structural connections are imported.');
  }

  // Warn about assign with complex expressions
  const assignRx = /\bassign\s+(\w+)\s*=\s*([\w\s|&^~!+\-]+?)\s*;/g;
  let asm: RegExpExecArray | null;
  while ((asm = assignRx.exec(body)) !== null) {
    const lhs = asm[1].trim();
    const rhs = asm[2].trim();
    if (/^[\w]+$/.test(rhs)) {
      // Simple pass-through: assign F = A;
      instances.push({
        id: `wire_${lhs}`,
        componentType: 'Wire',
        portMap: { in: rhs, out: lhs },
      });
    } else {
      warnings.push(`assign '${lhs} = ${rhs}' uses an operator expression — imported as a note only`);
    }
  }

  // ── Gate primitives (Verilog built-ins): and/or/not/nand/nor/xor/xnor ──
  // Syntax: <gate_type> [label] (out, in1 [, in2 …]);
  const gateRx = /\b(and|or|not|nand|nor|xor|xnor|buf)\s+(?:(\w+)\s*)?\(([^)]+)\)\s*;/gi;
  let gm: RegExpExecArray | null;
  let gateSeq = 0;
  while ((gm = gateRx.exec(body)) !== null) {
    const gateType = gm[1].toLowerCase();
    const label = gm[2] ?? `${gateType}_${gateSeq++}`;
    const argList = gm[3].split(',').map((s) => s.trim()).filter(Boolean);
    // Convention: first arg is output, rest are inputs
    const portMap: Record<string, string> = {};
    if (argList.length > 0) portMap['y'] = argList[0]; // output
    if (gateType === 'not' || gateType === 'buf') {
      if (argList.length > 1) portMap['a'] = argList[1];
    } else {
      if (argList.length > 1) portMap['a'] = argList[1];
      if (argList.length > 2) portMap['b'] = argList[2];
    }
    instances.push({ id: label, componentType: gateType, portMap });
  }

  // ── Module instantiations: <ModName> [#(…)] <label> (.portA(sigA), …); ──
  // Named port map style
  const modInstRx = /([A-Z]\w*)\s+(?:#\s*\([^)]*\)\s*)?(\w+)\s*\(([\s\S]*?)\)\s*;/g;
  let mim: RegExpExecArray | null;
  while ((mim = modInstRx.exec(body)) !== null) {
    const compName = mim[1].trim();
    const label = mim[2].trim();
    const portList = mim[3];

    // Skip keywords
    if (/^(always|initial|module|endmodule|assign|wire|input|output|reg|begin|end|if|else|for|case|endcase)$/i.test(compName)) continue;
    // Skip if already parsed as gate primitive
    if (/^(and|or|not|nand|nor|xor|xnor|buf)$/i.test(compName)) continue;

    const portMap: Record<string, string> = {};
    const namedRx = /\.(\w+)\s*\(\s*(\w+)\s*\)/g;
    let nm: RegExpExecArray | null;
    while ((nm = namedRx.exec(portList)) !== null) {
      portMap[nm[1]] = nm[2];
    }
    if (Object.keys(portMap).length === 0) {
      // Positional
      portList.split(',').forEach((sig, idx) => {
        portMap[`port${idx}`] = sig.trim();
      });
    }
    instances.push({ id: label, componentType: compName, portMap });
  }

  return { instances, signals };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse Verilog/SystemVerilog source text and return a ParsedHDL intermediate.
 */
export function parseVerilog(source: string): ParsedHDL {
  const warnings: string[] = [];
  const clean = normaliseWs(stripComments(source));

  const mod = parseModule(clean);
  if (!mod) {
    warnings.push('No module declaration found. Paste a complete Verilog file.');
  }

  const ports = mod?.ports ?? [];
  const { instances, signals } = parseBody(clean, ports, warnings);

  return {
    entityName: mod?.name ?? 'unknown',
    ports,
    instances,
    signals,
    warnings,
    lang: 'verilog',
  };
}
