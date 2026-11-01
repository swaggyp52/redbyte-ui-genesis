import { describe, expect, it } from 'vitest';
import {
  COMPONENT_SUPPORT_REGISTRY,
  NodeRegistry,
  getBoundaryInputNodeTypes,
  getBoundaryOutputNodeTypes,
} from '../index';

/**
 * Conformance gate: the support registry may only claim what the engine does.
 *
 * The registry drives Verify mode, the VHDL exporter and the export package
 * gate, so a capability it claims without an engine behind it becomes a
 * promise RedByte cannot keep: MUX4 claimed simulation, verification and VHDL
 * export while the engine had no MUX4 behaviour (its outputs read 0) and the
 * emitted `with s1 & s0 select` did not analyze.
 *
 * Importing from '../index' runs the built-in NodeRegistry registrations.
 */

/**
 * Design-boundary parts the exporter declares as top-level entity ports. Their
 * value comes from the board or the run harness, so their VHDL "export" is a
 * port declaration, not logic that needs a simulator behaviour. Listed by name
 * so a new exemption is a visible, reviewed change.
 */
const BOUNDARY_PORTS_EXPORTED_WITHOUT_SIMULATION = ['Button', 'CLOCK'];

describe('component support registry conformance', () => {
  it('registers an engine behaviour for every component that claims simulation', () => {
    const claimedWithoutBehaviour = COMPONENT_SUPPORT_REGISTRY
      .filter((entry) => entry.capabilities.simulation && !NodeRegistry.has(entry.type))
      .map((entry) => entry.type);
    expect(claimedWithoutBehaviour).toEqual([]);
  });

  it('claims verification only for components it simulates', () => {
    const verifiedWithoutSimulation = COMPONENT_SUPPORT_REGISTRY
      .filter((entry) => entry.capabilities.verification && !entry.capabilities.simulation)
      .map((entry) => entry.type);
    expect(verifiedWithoutSimulation).toEqual([]);
  });

  it('claims VHDL export only for components it simulates, apart from named boundary ports', () => {
    const exportedWithoutSimulation = COMPONENT_SUPPORT_REGISTRY
      .filter((entry) => entry.capabilities.vhdlExport && !entry.capabilities.simulation)
      .map((entry) => entry.type);
    expect(exportedWithoutSimulation).toEqual(BOUNDARY_PORTS_EXPORTED_WITHOUT_SIMULATION);

    // Each exemption really is a boundary port the exporter declares, never logic.
    const boundaryPorts = new Set<string>([...getBoundaryInputNodeTypes(), ...getBoundaryOutputNodeTypes()]);
    for (const type of BOUNDARY_PORTS_EXPORTED_WITHOUT_SIMULATION) {
      const entry = COMPONENT_SUPPORT_REGISTRY.find((candidate) => candidate.type === type);
      expect(entry?.category, type).toBe('io');
      expect(entry?.vhdlKind, type).toBe('boundary');
      expect(boundaryPorts.has(type), type).toBe(true);
    }
  });
});
