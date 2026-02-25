/**
 * Wire-ID encode/decode utilities.
 *
 * Wire IDs are strings of the form:
 *   "{fromNodeId}.{fromPort}-{toNodeId}.{toPort}"
 *
 * Node IDs may contain hyphens (e.g. "node-v2-1", "alu-stage-1-regfile").
 * Port names are alphanumeric + underscore only — no dots or hyphens.
 *
 * All consumers (DesignSurface delete handler, diagnostic mappers, etc.)
 * must use these functions instead of re-implementing the format inline.
 */

export interface WireEndpoints {
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
}

/**
 * Encodes four wire endpoint strings into a canonical wire ID.
 */
export function encodeWireId(
  fromNodeId: string,
  fromPort: string,
  toNodeId: string,
  toPort: string
): string {
  return `${fromNodeId}.${fromPort}-${toNodeId}.${toPort}`;
}

/**
 * Decodes a wire ID into its four parts, or returns null if the ID is malformed.
 *
 * Because node IDs may contain hyphens, this scans every possible hyphen split
 * position and picks the first that yields a valid `{id}.{port}` on each side.
 */
export function parseWireId(wireId: string): WireEndpoints | null {
  // Split on every '-' and try each position as the separator between
  // the from-half and the to-half.
  const segments = wireId.split('-');
  for (let split = 1; split < segments.length; split++) {
    const fromPart = segments.slice(0, split).join('-');
    const toPart = segments.slice(split).join('-');
    const fromDot = fromPart.lastIndexOf('.');
    const toDot = toPart.lastIndexOf('.');
    if (fromDot < 0 || toDot < 0) continue;
    const fromPort = fromPart.slice(fromDot + 1);
    const toPort = toPart.slice(toDot + 1);
    // Port names must not contain dots or hyphens
    if (fromPort.includes('.') || fromPort.includes('-')) continue;
    if (toPort.includes('.') || toPort.includes('-')) continue;
    const fromNodeId = fromPart.slice(0, fromDot);
    const toNodeId = toPart.slice(0, toDot);
    if (fromNodeId.length > 0 && toNodeId.length > 0) {
      return { fromNodeId, fromPort, toNodeId, toPort };
    }
  }
  return null;
}
