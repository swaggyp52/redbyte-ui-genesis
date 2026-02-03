import { PART_DEFINITIONS } from './parts';
const createUnionFind = () => {
    const parent = new Map();
    const add = (key) => {
        if (!parent.has(key))
            parent.set(key, key);
    };
    const find = (key) => {
        const existing = parent.get(key);
        if (!existing) {
            parent.set(key, key);
            return key;
        }
        if (existing === key)
            return key;
        const root = find(existing);
        parent.set(key, root);
        return root;
    };
    const union = (a, b) => {
        add(a);
        add(b);
        const rootA = find(a);
        const rootB = find(b);
        if (rootA !== rootB)
            parent.set(rootB, rootA);
    };
    const keys = () => Array.from(parent.keys());
    return { parent, add, find, union, keys };
};
const stableHash32 = (str) => {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
};
const pinKey = (nodeId, pinId) => `${nodeId}:${pinId}`;
const collectValidWirePins = (graph) => {
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const valid = new Set();
    const addIfValid = (nodeId, pinId) => {
        const node = nodeById.get(nodeId);
        if (!node)
            return;
        const def = PART_DEFINITIONS[node.type];
        if (!def)
            return;
        if (!def.pins.some((pin) => pin.id === pinId))
            return;
        valid.add(pinKey(nodeId, pinId));
    };
    graph.wires.forEach((wire) => {
        addIfValid(wire.sourceNodeId, wire.sourcePinId);
        addIfValid(wire.targetNodeId, wire.targetPinId);
    });
    return valid;
};
const buildBreadboardGroups = (pinIds) => {
    const rowLeft = new Map();
    const rowRight = new Map();
    const railsTop = [];
    const railsBottom = [];
    pinIds.forEach((pinId) => {
        const match = /^([A-J])(\d+)$/.exec(pinId);
        if (match) {
            const row = match[1];
            const column = match[2];
            if (row >= 'A' && row <= 'E') {
                if (!rowLeft.has(column))
                    rowLeft.set(column, []);
                rowLeft.get(column).push(pinId);
            }
            else {
                if (!rowRight.has(column))
                    rowRight.set(column, []);
                rowRight.get(column).push(pinId);
            }
            return;
        }
        if (pinId.startsWith('RAIL_TOP_')) {
            railsTop.push(pinId);
        }
        if (pinId.startsWith('RAIL_BOTTOM_')) {
            railsBottom.push(pinId);
        }
    });
    const groups = [];
    rowLeft.forEach((pins) => groups.push(pins));
    rowRight.forEach((pins) => groups.push(pins));
    if (railsTop.length > 0)
        groups.push(railsTop);
    if (railsBottom.length > 0)
        groups.push(railsBottom);
    return groups;
};
export const computeNetlist = (graph) => {
    const uf = createUnionFind();
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const wiredPins = collectValidWirePins(graph);
    graph.nodes.forEach((node) => {
        const def = PART_DEFINITIONS[node.type];
        if (!def)
            return;
        if (node.type === 'breadboard-half') {
            const pinIds = def.pins.map((pin) => pin.id);
            const groups = buildBreadboardGroups(pinIds);
            groups.forEach((group) => {
                const groupKeys = group.map((pinId) => pinKey(node.id, pinId));
                const isActive = groupKeys.some((key) => wiredPins.has(key));
                if (!isActive)
                    return;
                groupKeys.forEach((key) => uf.add(key));
                for (let i = 1; i < groupKeys.length; i += 1) {
                    uf.union(groupKeys[0], groupKeys[i]);
                }
            });
            return;
        }
        def.pins.forEach((pin) => {
            uf.add(pinKey(node.id, pin.id));
        });
    });
    graph.wires.forEach((wire) => {
        const sourceKey = pinKey(wire.sourceNodeId, wire.sourcePinId);
        const targetKey = pinKey(wire.targetNodeId, wire.targetPinId);
        if (!wiredPins.has(sourceKey) || !wiredPins.has(targetKey))
            return;
        uf.union(sourceKey, targetKey);
    });
    const components = new Map();
    uf.keys().forEach((key) => {
        const root = uf.find(key);
        if (!components.has(root))
            components.set(root, []);
        components.get(root).push(key);
    });
    const nets = [];
    const pinToNetId = {};
    components.forEach((pins) => {
        const sorted = [...pins].sort();
        const id = `net_${stableHash32(sorted.join('|'))}`;
        const pinRefs = sorted.map((key) => {
            const [nodeId, pinId] = key.split(':');
            pinToNetId[key] = id;
            return { nodeId, pinId };
        });
        nets.push({ id, pins: pinRefs });
    });
    nets.sort((a, b) => a.id.localeCompare(b.id));
    return { nets, pinToNetId };
};
export const sampleNetValue = (netId, netlist, pinStates) => {
    const net = netlist.nets.find((entry) => entry.id === netId);
    if (!net)
        return 0;
    for (const pin of net.pins) {
        const key = pinKey(pin.nodeId, pin.pinId);
        if (pinStates[key] !== undefined) {
            return pinStates[key];
        }
    }
    return 0;
};
const MAX_NET_HISTORY = 2000;
export const buildNetHistory = (timeline, netlist) => {
    const pinStates = {};
    const netValues = new Map();
    const history = {};
    netlist.nets.forEach((net) => {
        history[net.id] = [];
        netValues.set(net.id, 0);
    });
    const events = [...timeline.events].sort((a, b) => a.seq - b.seq);
    for (const event of events) {
        if (event.type !== 'SIM_PIN_DIFF' || !event.pinDiffs)
            continue;
        const touchedNetIds = new Set();
        Object.entries(event.pinDiffs).forEach(([key, value]) => {
            pinStates[key] = value;
            const netId = netlist.pinToNetId[key];
            if (netId)
                touchedNetIds.add(netId);
        });
        touchedNetIds.forEach((netId) => {
            const nextValue = sampleNetValue(netId, netlist, pinStates);
            const prevValue = netValues.get(netId) ?? 0;
            if (nextValue !== prevValue) {
                netValues.set(netId, nextValue);
                const list = history[netId];
                list.push({ tick: event.tick, value: nextValue });
                if (list.length > MAX_NET_HISTORY) {
                    list.splice(0, list.length - MAX_NET_HISTORY);
                }
            }
        });
    }
    return history;
};
