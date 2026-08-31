// Copyright Ac 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Module parameters / generics.
 *
 * VHDL generics and Verilog parameters let a module be reused at different
 * widths/values. The bounded parsers detect a generic clause but drop it; this
 * is the model that lets RedByte *represent* declared parameters and an
 * instance's bindings, and resolve the effective value (binding, else default),
 * honestly marking anything unset. Pure and deterministic — no evaluation of
 * expressions, just declaration + override resolution.
 */

export type ParameterKind = 'integer' | 'natural' | 'positive' | 'string' | 'boolean' | 'std_logic' | 'unknown';

export interface ModuleParameter {
  name: string;
  kind: ParameterKind;
  /** Declared default value, as source text (undefined when the declaration has none). */
  defaultValue?: string;
}

export interface ParameterBinding {
  name: string;
  /** Override value, as source text. */
  value: string;
}

export interface ResolvedParameter {
  name: string;
  kind: ParameterKind;
  /** Effective value, or undefined when neither a binding nor a default exists. */
  value: string | undefined;
  source: 'binding' | 'default' | 'unset';
}

export interface ParameterValidation {
  ok: boolean;
  errors: string[];
}

const KINDS: readonly ParameterKind[] = ['integer', 'natural', 'positive', 'string', 'boolean', 'std_logic', 'unknown'];

const VHDL_TYPE_KIND: Record<string, ParameterKind> = {
  integer: 'integer',
  natural: 'natural',
  positive: 'positive',
  string: 'string',
  boolean: 'boolean',
  std_logic: 'std_logic',
};

/** Map a VHDL generic type name (or Verilog-ish hint) to a parameter kind. */
export function parameterKindFromTypeName(typeName: string): ParameterKind {
  const key = typeName.trim().toLowerCase();
  return VHDL_TYPE_KIND[key] ?? 'unknown';
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeKind(value: unknown): ParameterKind {
  if (typeof value !== 'string') return 'unknown';
  const lower = value.trim().toLowerCase();
  return (KINDS as readonly string[]).includes(lower) ? (lower as ParameterKind) : 'unknown';
}

/** Normalize an arbitrary value into a deterministic, de-duplicated parameter list. */
export function normalizeParameters(value: unknown): ModuleParameter[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const params: ModuleParameter[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const kind = normalizeKind(entry.kind);
    const param: ModuleParameter = { name, kind };
    if (typeof entry.defaultValue === 'string' && entry.defaultValue.length > 0) {
      param.defaultValue = entry.defaultValue;
    }
    params.push(param);
  }
  return params.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Normalize bindings; the last binding for a name wins. */
export function normalizeBindings(value: unknown): ParameterBinding[] {
  if (!Array.isArray(value)) return [];
  const byName = new Map<string, string>();
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!name) continue;
    byName.set(name, typeof entry.value === 'string' ? entry.value : '');
  }
  return [...byName.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => (a.name < b.name ? -1 : 1));
}

/**
 * Resolve each declared parameter's effective value: a matching binding wins,
 * else the declared default, else unset. Bindings for undeclared parameters do
 * not appear (they are surfaced by {@link validateBindings}).
 */
export function resolveParameters(
  params: readonly ModuleParameter[],
  bindings: readonly ParameterBinding[]
): ResolvedParameter[] {
  const bindingByName = new Map(bindings.map((b) => [b.name, b.value]));
  return params.map((param) => {
    if (bindingByName.has(param.name)) {
      return { name: param.name, kind: param.kind, value: bindingByName.get(param.name), source: 'binding' as const };
    }
    if (param.defaultValue !== undefined) {
      return { name: param.name, kind: param.kind, value: param.defaultValue, source: 'default' as const };
    }
    return { name: param.name, kind: param.kind, value: undefined, source: 'unset' as const };
  });
}

/** Validate bindings against declared parameters: a binding for an undeclared parameter is an error. */
export function validateBindings(
  params: readonly ModuleParameter[],
  bindings: readonly ParameterBinding[]
): ParameterValidation {
  const declared = new Set(params.map((p) => p.name));
  const errors: string[] = [];
  for (const binding of bindings) {
    if (!declared.has(binding.name)) {
      errors.push(`Binding for undeclared parameter "${binding.name}".`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** True when every declared parameter resolves to a value (none left unset). */
export function allParametersResolved(resolved: readonly ResolvedParameter[]): boolean {
  return resolved.every((r) => r.source !== 'unset');
}
