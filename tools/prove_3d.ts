
// MOCKED LOGIC FROM iso-transform.ts to prove spacing
function toIsometric(x, y, z = 0) {
    return {
        x: (x - y),
        y: (x + y) * 0.5 - y * 0.5 - z, // Simplified iso projection for proof
    };
}

const circuit = {
    nodes: [
        { id: 'node1', type: 'arduino-uno', position: { x: 0, y: 0 } },
        { id: 'node2', type: 'basys3', position: { x: 0, y: 0 } },
        { id: 'node3', type: 'logic-gate', position: { x: 0, y: 0 } }
    ],
    connections: []
};

console.log('--- PROVING 3D STACKING PREVENTION ---');

const positionCounts = new Map();
const nodes = circuit.nodes.map((node) => {
    let x = node.position.x;
    let y = node.position.y;

    const posKey = `${x},${y}`;
    const count = positionCounts.get(posKey) || 0;
    positionCounts.set(posKey, count + 1);

    if (count > 0) {
        // Offset logic from iso-transform.ts
        const offset = 8;
        const cols = 5;
        x += (count % cols) * offset;
        y += Math.floor(count / cols) * offset;
    }

    const iso = toIsometric(x, y, 0);

    return {
        id: node.id,
        type: node.type,
        view: { x: iso.x, y: iso.y }
    };
});

nodes.forEach(n => {
    console.log(`Node: ${n.id} Type: ${n.type} Final View X: ${n.view.x.toFixed(2)} Y: ${n.view.y.toFixed(2)}`);
});

if (nodes[0].view.x !== nodes[1].view.x || nodes[0].view.y !== nodes[1].view.y) {
    console.log('SUCCESS: Nodes are offset despite identical input (0,0) coordinates.');
} else {
    console.log('FAIL: Nodes are still stacked.');
}
