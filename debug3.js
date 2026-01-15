const { CircuitEngine } = require('./packages/rb-logic-core/dist/rb-logic-core.cjs');
const circuit = {
  nodes: [
    { id: 'in', type: 'INPUT', position: { x: 0, y: 0 }, state: {}, config: {}, rotation: 0 },
    { id: 'not', type: 'NOT', position: { x: 50, y: 0 }, state: {}, config: {}, rotation: 0 },
  ],
  connections: [
    { from: { nodeId: 'in', portName: 'out' }, to: { nodeId: 'not', portName: 'in' } },
  ],
};

const eng = new CircuitEngine(circuit);
eng.setNodeState('in', { isOn: true });
console.log('INPUT node outputs:', eng.getNodeOutputs('in'));
eng.stabilize(50);
console.log('After stabilize - INPUT outputs:', eng.getNodeOutputs('in'));
console.log('NOT outputs:', eng.getNodeOutputs('not'));
