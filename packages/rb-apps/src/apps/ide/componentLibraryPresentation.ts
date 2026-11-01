import type {
  ComponentDefinition,
  ComponentPortDefinition,
  ComponentPortWidth,
} from './componentDefinitions';

/**
 * Presentation facts the Component Library card layer derives from a
 * ComponentDefinition. Pure projection: nothing here changes runtime types,
 * serialization, simulation, or export semantics.
 */
export interface LibraryCardFacts {
  /** Compact interface line, e.g. "A, B → Y" or "4 in → 1 out". */
  portSummary: string;
  /** One port per line, for the card tooltip. */
  interfaceDetail: string;
  /**
   * Support chip when a definition is NOT fully supported end-to-end.
   * null means simulation and export are both supported, so the card stays
   * quiet instead of repeating "fully supported" on every tile.
   */
  capabilityBadge: 'Sim only' | 'Export only' | 'Structural' | null;
  /** Explains the badge (capability notes), for the tooltip. */
  capabilityTitle: string | null;
  /** True when any port width is parameter-driven (e.g. RegisterBus). */
  parametric: boolean;
}

function widthBits(width: ComponentPortWidth): number {
  return width.kind === 'fixed' ? width.bits : width.defaultBits;
}

function formatPortName(port: ComponentPortDefinition): string {
  const bits = widthBits(port.width);
  return bits > 1 ? `${port.displayName}[${bits - 1}:0]` : port.displayName;
}

const COMPACT_PORT_LIMIT = 4;

export function deriveLibraryCardFacts(definition: ComponentDefinition): LibraryCardFacts {
  const inputs = definition.ports.filter((port) => port.direction === 'input');
  const outputs = definition.ports.filter((port) => port.direction === 'output');

  let portSummary: string;
  if (definition.ports.length === 0) {
    portSummary = 'No ports';
  } else if (definition.ports.length <= COMPACT_PORT_LIMIT) {
    const left = inputs.map(formatPortName).join(', ');
    const right = outputs.map(formatPortName).join(', ');
    portSummary = left && right ? `${left} → ${right}` : left ? `${left} →` : `→ ${right}`;
  } else {
    portSummary = `${inputs.length} in → ${outputs.length} out`;
  }

  const interfaceDetail = [
    ...inputs.map((port) => `in ${formatPortName(port)}${port.optional ? ' (optional)' : ''}`),
    ...outputs.map((port) => `out ${formatPortName(port)}${port.optional ? ' (optional)' : ''}`),
  ].join('\n');

  const simSupported = definition.simulationCapability.supported;
  const exportSupported = definition.exportCapability.supported;
  let capabilityBadge: LibraryCardFacts['capabilityBadge'] = null;
  if (!simSupported || !exportSupported) {
    capabilityBadge = simSupported ? 'Sim only' : exportSupported ? 'Export only' : 'Structural';
  }
  const capabilityTitle = capabilityBadge
    ? [
        !simSupported ? (definition.simulationCapability.note ?? 'Simulation is not supported.') : null,
        !exportSupported ? (definition.exportCapability.note ?? 'VHDL export is not supported.') : null,
      ]
        .filter((note): note is string => Boolean(note))
        .join(' ')
    : null;

  return {
    portSummary,
    interfaceDetail,
    capabilityBadge,
    capabilityTitle,
    parametric: definition.ports.some((port) => port.width.kind === 'parameter'),
  };
}
