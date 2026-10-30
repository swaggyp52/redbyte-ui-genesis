import { beforeEach, describe, expect, it } from 'vitest';
import { useLogicViewStore } from '../useLogicViewStore';

/**
 * A plain click selects exactly what it hit, part or wire. A part left selected under a clicked
 * wire kept the inspector on the part, so the wire's Disconnect action never appeared, and Delete
 * removed the part along with the wire. Shift, Ctrl and Cmd still add to the selection.
 */
const WIRE = 'a_node.out-fa_node.A';

function selected() {
  const { nodes, wires } = useLogicViewStore.getState().selection;
  return { nodes: Array.from(nodes).sort(), wires: Array.from(wires).sort() };
}

beforeEach(() => {
  useLogicViewStore.setState({ selection: { nodes: new Set<string>(), wires: new Set<string>() } });
});

describe('a plain click replaces the whole selection', () => {
  it('selecting a wire releases the part that was selected', () => {
    useLogicViewStore.getState().selectNode('cout_node');
    useLogicViewStore.getState().selectWire(WIRE, false);
    expect(selected()).toEqual({ nodes: [], wires: [WIRE] });
  });

  it('selecting a part releases the wire that was selected', () => {
    useLogicViewStore.getState().selectWire(WIRE, false);
    useLogicViewStore.getState().selectNode('cout_node', false);
    expect(selected()).toEqual({ nodes: ['cout_node'], wires: [] });
  });

  it('a plain click on a wire already in a mixed selection leaves only that wire', () => {
    useLogicViewStore.getState().selectNode('cout_node');
    useLogicViewStore.getState().selectWire(WIRE, true);
    useLogicViewStore.getState().selectWire(WIRE, false);
    expect(selected()).toEqual({ nodes: [], wires: [WIRE] });
  });

  it('a plain click on a part already in a mixed selection leaves only that part', () => {
    useLogicViewStore.getState().selectNode('cout_node');
    useLogicViewStore.getState().selectWire(WIRE, true);
    useLogicViewStore.getState().selectNode('cout_node', false);
    expect(selected()).toEqual({ nodes: ['cout_node'], wires: [] });
  });
});

describe('an additive click keeps the other kind', () => {
  it('adds a wire to a selected part, and a part to them, without releasing either', () => {
    useLogicViewStore.getState().selectNode('cout_node');
    useLogicViewStore.getState().selectWire(WIRE, true);
    useLogicViewStore.getState().selectNode('sum_node', true);
    expect(selected()).toEqual({ nodes: ['cout_node', 'sum_node'], wires: [WIRE] });
  });

  it('removes only the clicked wire from a mixed selection', () => {
    useLogicViewStore.getState().selectNode('cout_node');
    useLogicViewStore.getState().selectWire(WIRE, true);
    useLogicViewStore.getState().selectWire(WIRE, true);
    expect(selected()).toEqual({ nodes: ['cout_node'], wires: [] });
  });
});
