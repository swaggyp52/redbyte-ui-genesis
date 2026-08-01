import { describe, expect, it } from 'vitest';
import type { Circuit, CompositeNodeDef } from '@redbyte/rb-logic-core';
import {
  buildDesignHierarchyBreadcrumbs,
  deriveDesignHierarchy,
  deriveDesignSources,
  findDesignHierarchyNode,
  flattenDesignHierarchy,
} from '../designProjectProjection';

const innerDefinition: CompositeNodeDef = {
  name: 'InnerBlock',
  description: 'Real inner project composite',
  subcircuit: {
    nodes: [{ id: 'and-1', type: 'AND', label: 'Inner AND' }],
    connections: [],
  },
  inputMapping: { A: 'and-1.a', B: 'and-1.b' },
  outputMapping: { Y: 'and-1.out' },
};

const outerDefinition: CompositeNodeDef = {
  name: 'OuterBlock',
  description: 'Real outer project composite',
  subcircuit: {
    nodes: [{ id: 'inner-1', type: 'InnerBlock', label: 'Nested inner' }],
    connections: [],
  },
  inputMapping: { A: 'inner-1.A' },
  outputMapping: { Y: 'inner-1.Y' },
};

const topCircuit: Circuit = {
  nodes: [
    { id: 'input-a', type: 'INPUT', label: 'A' },
    { id: 'outer-1', type: 'OuterBlock', label: 'Datapath' },
    { id: 'output-y', type: 'OUTPUT', label: 'Y' },
  ],
  connections: [],
};

describe('Design hierarchy projection', () => {
  it('projects only real top-level and nested custom-component instances', () => {
    const projection = deriveDesignHierarchy({
      topModule: { id: 'project-1:top', name: 'student_top' },
      circuit: topCircuit,
      customComponents: [innerDefinition, outerDefinition],
      selectedNodeId: 'outer-1',
    });

    expect(projection.root.label).toBe('student_top');
    expect(projection.root.children.map((node) => node.nodeId)).toEqual([
      'input-a',
      'outer-1',
      'output-y',
    ]);
    const outer = projection.root.children[1];
    expect(outer).toMatchObject({
      kind: 'custom-component-instance',
      label: 'Datapath',
      selected: true,
      truncation: null,
    });
    expect(outer.children[0]).toMatchObject({
      nodeId: 'inner-1',
      kind: 'custom-component-instance',
      label: 'Nested inner',
    });
    expect(outer.children[0].children[0]).toMatchObject({
      nodeId: 'and-1',
      kind: 'component-instance',
      label: 'Inner AND',
      children: [],
    });
    expect(projection.cycleCount).toBe(0);
    expect(projection.depthLimitCount).toBe(0);
  });

  it('provides stable path IDs, lookup, and real breadcrumbs for integration', () => {
    const projection = deriveDesignHierarchy({
      topModule: { id: 'project/top', name: 'student_top' },
      circuit: topCircuit,
      customComponents: [innerDefinition, outerDefinition],
    });
    const nestedLeaf = projection.root.children[1].children[0].children[0];

    expect(nestedLeaf.hierarchyId).toBe(
      'top:project%2Ftop/instance:outer-1/instance:inner-1/instance:and-1',
    );
    expect(findDesignHierarchyNode(projection.root, nestedLeaf.hierarchyId)).toBe(nestedLeaf);
    expect(buildDesignHierarchyBreadcrumbs(projection.root, nestedLeaf.hierarchyId).map((item) => item.label)).toEqual([
      'student_top',
      'Datapath',
      'Nested inner',
      'Inner AND',
    ]);
    expect(flattenDesignHierarchy(projection.root)).toHaveLength(6);
  });

  it('stops recursive custom-component cycles on the real instance that closes the cycle', () => {
    const componentA: CompositeNodeDef = {
      name: 'ComponentA',
      subcircuit: { nodes: [{ id: 'b-1', type: 'ComponentB' }], connections: [] },
      inputMapping: {},
      outputMapping: {},
    };
    const componentB: CompositeNodeDef = {
      name: 'ComponentB',
      subcircuit: { nodes: [{ id: 'a-1', type: 'ComponentA' }], connections: [] },
      inputMapping: {},
      outputMapping: {},
    };
    const projection = deriveDesignHierarchy({
      topModule: { id: 'top', name: 'top' },
      circuit: { nodes: [{ id: 'a-top', type: 'ComponentA' }], connections: [] },
      customComponents: [componentA, componentB],
    });

    const closingInstance = projection.root.children[0].children[0].children[0];
    expect(closingInstance).toMatchObject({
      runtimeType: 'ComponentA',
      children: [],
      truncation: {
        reason: 'cycle',
        componentType: 'ComponentA',
        activeComponentTypes: ['ComponentA', 'ComponentB', 'ComponentA'],
      },
    });
    expect(projection.cycleCount).toBe(1);
  });

  it('enforces a bounded expansion depth without inventing placeholder children', () => {
    const projection = deriveDesignHierarchy({
      topModule: { id: 'top', name: 'top' },
      circuit: { nodes: [{ id: 'outer-top', type: 'OuterBlock' }], connections: [] },
      customComponents: [innerDefinition, outerDefinition],
      maxDepth: 2,
    });

    const limitedInstance = projection.root.children[0].children[0];
    expect(limitedInstance.runtimeType).toBe('InnerBlock');
    expect(limitedInstance.children).toEqual([]);
    expect(limitedInstance.truncation).toMatchObject({ reason: 'depth-limit' });
    expect(projection.depthLimitCount).toBe(1);
  });
});

describe('Design sources projection', () => {
  it('uses actual visual documents and does not fabricate generated source files', () => {
    const projection = deriveDesignSources({
      topModule: { id: 'project-1:top', name: 'student_top' },
      circuit: topCircuit,
      customComponents: [innerDefinition, outerDefinition],
    });

    expect(projection.entries.map((entry) => entry.kind)).toEqual([
      'visual-circuit',
      'custom-component',
      'custom-component',
    ]);
    expect(projection.entries.every((entry) => entry.fileBacked === false)).toBe(true);
    expect(projection.entries.every((entry) => entry.path === null)).toBe(true);
    expect(projection.entries.some((entry) => entry.label === 'top.vhd')).toBe(false);
    expect(projection.fileBackedCount).toBe(0);
    expect(projection.visualDocumentCount).toBe(3);
  });

  it('preserves only real file-backed HDL paths and languages supplied by project truth', () => {
    const projection = deriveDesignSources({
      topModule: { id: 'project-1:top', name: 'student_top' },
      circuit: topCircuit,
      customComponents: [],
      hdlSources: [
        { path: 'rtl/student_top.vhd', language: 'vhdl', text: 'entity student_top is end;' },
        { path: 'rtl/helper.v', language: 'verilog', text: 'module helper; endmodule' },
      ],
    });

    expect(projection.entries.filter((entry) => entry.fileBacked).map((entry) => ({
      path: entry.path,
      language: entry.language,
      characterCount: entry.characterCount,
    }))).toEqual([
      { path: 'rtl/student_top.vhd', language: 'vhdl', characterCount: 26 },
      { path: 'rtl/helper.v', language: 'verilog', characterCount: 24 },
    ]);
    expect(projection.entries.filter((entry) => entry.kind === 'hdl-source').every((entry) => entry.isTop === false)).toBe(true);
  });
});
