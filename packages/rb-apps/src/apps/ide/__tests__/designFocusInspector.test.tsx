// @vitest-environment jsdom

import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { CompositeNodeDef } from '@redbyte/rb-logic-core';
import { DesignFocusInspector } from '../components/DesignFocusInspector';
import type { DesignFocusContext } from '../components/DesignFocusBanner';
import type { MacroDefinition } from '../macros/MacroLibrary';

const MACRO_CTX: DesignFocusContext = {
  kind: 'macro',
  macroId: 'macro-adder4',
  name: 'Adder4',
  ioSummary: '2 in · 1 out',
  description: 'Ripple-carry adder',
};

const COMPONENT_CTX: DesignFocusContext = {
  kind: 'custom-component',
  componentName: 'ALU',
  description: 'Arithmetic logic unit',
};

const MACRO_DEF: MacroDefinition = {
  id: 'macro-adder4',
  name: 'Adder4',
  description: 'Ripple-carry adder',
  inputs: [
    { id: 'in-a', label: 'A', nodeId: 'n1', portName: 'a' },
    { id: 'in-b', label: 'B', nodeId: 'n1', portName: 'b' },
  ],
  outputs: [
    { id: 'out-sum', label: 'SUM', nodeId: 'n2', portName: 'sum' },
  ],
  cluster: { nodes: [], connections: [] } as unknown as MacroDefinition['cluster'],
  createdAt: 0,
};

const COMPONENT_DEF: CompositeNodeDef = {
  name: 'ALU',
  description: 'Arithmetic logic unit',
  subcircuit: { nodes: [], connections: [] } as unknown as CompositeNodeDef['subcircuit'],
  inputMapping: { a: 'n1.in', b: 'n1.in', op: 'n1.in' },
  outputMapping: { result: 'n2.out' },
};

describe('DesignFocusInspector', () => {
  it('puts kind and name in the section title and renders port-by-port interface', () => {
    const { getByTestId } = render(
      <DesignFocusInspector context={MACRO_CTX} macro={MACRO_DEF} />
    );
    const root = getByTestId('ide-design-focus-inspector');
    expect(root.querySelector('.ide-inspector-title')?.textContent).toContain('Macro');
    expect(root.querySelector('.ide-inspector-title')?.textContent).toContain('Adder4');
    expect(
      getByTestId('ide-design-focus-inspector-input-count').textContent
    ).toBe('2');
    expect(
      getByTestId('ide-design-focus-inspector-output-count').textContent
    ).toBe('1');
    const inputList = getByTestId('ide-design-focus-inspector-input-list');
    expect(inputList.textContent).toContain('A');
    expect(inputList.textContent).toContain('B');
    const outputList = getByTestId('ide-design-focus-inspector-output-list');
    expect(outputList.textContent).toContain('SUM');
  });

  it('surfaces the description in the dock (not duplicated on the canvas banner)', () => {
    const { getByTestId } = render(
      <DesignFocusInspector context={MACRO_CTX} macro={MACRO_DEF} />
    );
    expect(getByTestId('ide-design-focus-inspector-description').textContent).toBe(
      'Ripple-carry adder'
    );
  });

  it('omits usage block for macros (no honest instance count)', () => {
    const { queryByTestId } = render(
      <DesignFocusInspector
        context={MACRO_CTX}
        macro={MACRO_DEF}
        instanceCount={5}
      />
    );
    expect(queryByTestId('ide-design-focus-inspector-usage')).toBeNull();
  });

  it('renders component ports derived from mappings and instance count', () => {
    const { getByTestId } = render(
      <DesignFocusInspector
        context={COMPONENT_CTX}
        componentDef={COMPONENT_DEF}
        instanceCount={3}
      />
    );
    const root = getByTestId('ide-design-focus-inspector');
    expect(root.querySelector('.ide-inspector-title')?.textContent).toContain('Custom component');
    expect(root.querySelector('.ide-inspector-title')?.textContent).toContain('ALU');
    expect(
      getByTestId('ide-design-focus-inspector-input-count').textContent
    ).toBe('3');
    expect(
      getByTestId('ide-design-focus-inspector-output-count').textContent
    ).toBe('1');
    const usage = getByTestId('ide-design-focus-inspector-usage');
    expect(usage.textContent).toContain('3 instances in this circuit');
  });

  it('pluralises correctly for a single component instance', () => {
    const { getByTestId } = render(
      <DesignFocusInspector
        context={COMPONENT_CTX}
        componentDef={COMPONENT_DEF}
        instanceCount={1}
      />
    );
    expect(
      getByTestId('ide-design-focus-inspector-usage').textContent
    ).toContain('1 instance in this circuit');
  });

  it('reports zero-usage truthfully for unused components', () => {
    const { getByTestId } = render(
      <DesignFocusInspector
        context={COMPONENT_CTX}
        componentDef={COMPONENT_DEF}
        instanceCount={0}
      />
    );
    expect(
      getByTestId('ide-design-focus-inspector-usage').textContent
    ).toContain('Not used in this circuit yet');
  });

  it('renders empty port messages when the asset has no inputs or outputs', () => {
    const emptyMacro: MacroDefinition = {
      ...MACRO_DEF,
      inputs: [],
      outputs: [],
    };
    const { getByTestId } = render(
      <DesignFocusInspector context={MACRO_CTX} macro={emptyMacro} />
    );
    expect(
      getByTestId('ide-design-focus-inspector-input-empty').textContent
    ).toBe('No inputs.');
    expect(
      getByTestId('ide-design-focus-inspector-output-empty').textContent
    ).toBe('No outputs.');
  });

  it('falls back gracefully when macro definition is missing', () => {
    const { getByTestId } = render(<DesignFocusInspector context={MACRO_CTX} />);
    expect(
      getByTestId('ide-design-focus-inspector-input-count').textContent
    ).toBe('0');
    expect(
      getByTestId('ide-design-focus-inspector-output-count').textContent
    ).toBe('0');
  });
});
