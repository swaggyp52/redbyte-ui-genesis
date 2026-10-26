import { getVhdlLogicNodeTypes } from '@redbyte/rb-logic-core';

/**
 * VHDL-2008 reserved words. An entity with one of these names does not
 * analyze; VHDL is case-insensitive, so `And` is `and`.
 */
export const VHDL_RESERVED_WORDS: ReadonlySet<string> = new Set([
  'abs', 'access', 'after', 'alias', 'all', 'and', 'architecture', 'array', 'assert', 'assume',
  'assume_guarantee', 'attribute', 'begin', 'block', 'body', 'buffer', 'bus', 'case', 'component',
  'configuration', 'constant', 'context', 'cover', 'default', 'disconnect', 'downto', 'else',
  'elsif', 'end', 'entity', 'exit', 'fairness', 'file', 'for', 'force', 'function', 'generate',
  'generic', 'group', 'guarded', 'if', 'impure', 'in', 'inertial', 'inout', 'is', 'label',
  'library', 'linkage', 'literal', 'loop', 'map', 'mod', 'nand', 'new', 'next', 'nor', 'not',
  'null', 'of', 'on', 'open', 'or', 'others', 'out', 'package', 'parameter', 'port', 'postponed',
  'procedure', 'process', 'property', 'protected', 'pure', 'range', 'record', 'register', 'reject',
  'release', 'rem', 'report', 'restrict', 'restrict_guarantee', 'return', 'rol', 'ror', 'select',
  'sequence', 'severity', 'shared', 'signal', 'sla', 'sll', 'sra', 'srl', 'strong', 'subtype',
  'then', 'to', 'transport', 'type', 'unaffected', 'units', 'until', 'use', 'variable', 'vmode',
  'vprop', 'vunit', 'wait', 'when', 'while', 'with', 'xnor', 'xor',
]);

/**
 * Why a module name cannot be an exported entity, or null when it can. A name
 * equal to a primitive type would also capture every gate of that type.
 */
export function moduleNameCollision(name: string, topEntity?: string): string | null {
  const lowered = name.trim().toLowerCase();
  if (VHDL_RESERVED_WORDS.has(lowered)) return 'is a VHDL reserved word';
  const primitive = [...getVhdlLogicNodeTypes(), 'Delay', 'Counter4Bit', 'RSLatch', 'Button', 'Clock', 'Switch', 'Lamp', 'INPUT', 'OUTPUT', 'Wire']
    .find((type) => type.toLowerCase() === lowered);
  if (primitive) return `is the name of the built-in ${primitive} part`;
  if (topEntity && topEntity.toLowerCase() === lowered) return 'is the top entity name';
  return null;
}
