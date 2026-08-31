import { describe, expect, it } from 'vitest';
import {
  COMPONENT_DEFINITION_REGISTRY,
  type ComponentDefinition,
} from '../componentDefinitions';
import { deriveLibraryCardFacts } from '../componentLibraryPresentation';

function definitionByType(runtimeType: string): ComponentDefinition {
  const definition = COMPONENT_DEFINITION_REGISTRY.definitions.find(
    (entry) => entry.runtimeType === runtimeType
  );
  if (!definition) throw new Error(`missing definition ${runtimeType}`);
  return definition;
}

describe('deriveLibraryCardFacts', () => {
  it('renders a compact name-level interface for small gates', () => {
    const definition = definitionByType('AND');
    const facts = deriveLibraryCardFacts(definition);
    const inputNames = definition.ports
      .filter((p) => p.direction === 'input')
      .map((p) => p.displayName);
    const outputNames = definition.ports
      .filter((p) => p.direction === 'output')
      .map((p) => p.displayName);
    expect(facts.portSummary).toBe(`${inputNames.join(', ')} → ${outputNames.join(', ')}`);
    expect(facts.parametric).toBe(false);
    // Fully supported gates carry no capability chip — silence means full support.
    expect(facts.capabilityBadge).toBeNull();
    expect(facts.capabilityTitle).toBeNull();
    for (const name of [...inputNames, ...outputNames]) {
      expect(facts.interfaceDetail).toContain(name);
    }
  });

  it('marks boundary-limited components as Structural with the boundary note', () => {
    const definition = definitionByType('RegisterBus');
    const facts = deriveLibraryCardFacts(definition);
    expect(facts.parametric).toBe(true);
    expect(facts.capabilityBadge).toBe('Structural');
    expect(facts.capabilityTitle).toContain('does not certify');
  });

  it('collapses wide interfaces to direction counts', () => {
    const definition = definitionByType('RegisterBus');
    const facts = deriveLibraryCardFacts(definition);
    const inputs = definition.ports.filter((p) => p.direction === 'input').length;
    const outputs = definition.ports.filter((p) => p.direction === 'output').length;
    if (definition.ports.length > 4) {
      expect(facts.portSummary).toBe(`${inputs} in → ${outputs} out`);
    } else {
      expect(facts.portSummary).toContain('[7:0]');
    }
  });

  it('shows vector widths and optional ports in the tooltip detail', () => {
    const definition = definitionByType('RegisterBus');
    const facts = deriveLibraryCardFacts(definition);
    expect(facts.interfaceDetail).toContain('[7:0]');
    const optionalPorts = definition.ports.filter((p) => p.optional);
    for (const port of optionalPorts) {
      expect(facts.interfaceDetail).toContain(`${port.displayName} (optional)`);
    }
  });

  it('derives a Sim only chip when export support is absent', () => {
    const base = definitionByType('AND');
    const synthetic: ComponentDefinition = {
      ...base,
      exportCapability: { supported: false, source: 'component-support-registry', note: 'No HDL contract.' },
    };
    const facts = deriveLibraryCardFacts(synthetic);
    expect(facts.capabilityBadge).toBe('Sim only');
    expect(facts.capabilityTitle).toBe('No HDL contract.');
  });

  it('never crashes on an empty interface', () => {
    const base = definitionByType('AND');
    const facts = deriveLibraryCardFacts({ ...base, ports: [] });
    expect(facts.portSummary).toBe('No ports');
    expect(facts.interfaceDetail).toBe('');
  });
});
