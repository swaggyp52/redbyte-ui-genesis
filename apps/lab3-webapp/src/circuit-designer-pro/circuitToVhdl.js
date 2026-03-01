/**
 * circuitToVhdl.ts
 * Circuit-to-HDL generator for the Lab 3 Circuit Designer.
 * Self-contained: copies topo-sort DFS from engine.ts rather than importing it
 * to keep the two modules independently evolvable.
 */
import { generateXdcString } from '../xdcPins';
import { validateCircuitAgainstTruthTable } from './validation';
// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Detect combinational cycles (same DFS as engine.ts — copy, not import) */
function hasCycle(circuit) {
    const adjacency = new Map();
    circuit.nodes.forEach(n => adjacency.set(n.id, []));
    circuit.wires.forEach(w => {
        const targets = adjacency.get(w.from.nodeId) || [];
        targets.push(w.to.nodeId);
        adjacency.set(w.from.nodeId, targets);
    });
    const visited = new Set();
    const recStack = new Set();
    let foundCycle = false;
    const dfs = (id) => {
        if (foundCycle)
            return;
        visited.add(id);
        recStack.add(id);
        for (const t of (adjacency.get(id) || [])) {
            if (!visited.has(t))
                dfs(t);
            else if (recStack.has(t)) {
                foundCycle = true;
                return;
            }
        }
        recStack.delete(id);
    };
    circuit.nodes.forEach(n => { if (!visited.has(n.id))
        dfs(n.id); });
    return foundCycle;
}
/** Topological sort (post-order DFS) — returns node IDs in evaluation order */
function topoSort(circuit) {
    const adjacency = new Map();
    circuit.nodes.forEach(n => adjacency.set(n.id, []));
    circuit.wires.forEach(w => {
        const targets = adjacency.get(w.from.nodeId) || [];
        targets.push(w.to.nodeId);
        adjacency.set(w.from.nodeId, targets);
    });
    const visited = new Set();
    const order = [];
    const dfs = (id) => {
        visited.add(id);
        for (const t of (adjacency.get(id) || [])) {
            if (!visited.has(t))
                dfs(t);
        }
        order.unshift(id);
    };
    circuit.nodes.forEach(n => { if (!visited.has(n.id))
        dfs(n.id); });
    return order;
}
/** Map a node's output to its VHDL signal name (stable: based on topo index) */
function buildSignalMap(circuit, topoOrder, inputNodes, outputNodes) {
    const sigMap = new Map();
    // INPUT nodes → B(i) or single 'a'
    const sortedInputs = [...inputNodes].sort((a, b) => a.id.localeCompare(b.id));
    if (sortedInputs.length === 1) {
        sigMap.set(sortedInputs[0].id, 'a');
    }
    else {
        sortedInputs.forEach((n, i) => sigMap.set(n.id, `B(${i})`));
    }
    // CONST nodes → inline literals
    circuit.nodes
        .filter(n => n.type === 'CONST_0' || n.type === 'CONST_1')
        .forEach(n => sigMap.set(n.id, n.type === 'CONST_0' ? "'0'" : "'1'"));
    // Intermediate gate nodes → sig_0, sig_1, ... in topo order
    let sigIdx = 0;
    for (const nodeId of topoOrder) {
        const node = circuit.nodes.find(n => n.id === nodeId);
        if (!node)
            continue;
        if (node.type === 'INPUT' ||
            node.type === 'OUTPUT' ||
            node.type === 'CONST_0' ||
            node.type === 'CONST_1')
            continue;
        sigMap.set(node.id, `sig_${sigIdx++}`);
    }
    // OUTPUT nodes → seg(i) or single 'y'
    const sortedOutputs = [...outputNodes].sort((a, b) => a.id.localeCompare(b.id));
    if (sortedOutputs.length === 1) {
        sigMap.set(sortedOutputs[0].id, 'y');
    }
    else {
        sortedOutputs.forEach((n, i) => sigMap.set(n.id, `seg(${i})`));
    }
    return sigMap;
}
/** Get the VHDL signal name that drives a given input port of a target node */
function getDriverSignal(circuit, targetNodeId, port, sigMap) {
    const wire = circuit.wires.find(w => w.to.nodeId === targetNodeId && w.to.port === port);
    if (!wire)
        return null;
    return sigMap.get(wire.from.nodeId) ?? null;
}
/** Emit concurrent VHDL assignment for a single gate */
function gateToVhdl(node, sigMap, circuit) {
    const out = sigMap.get(node.id);
    if (!out)
        return null;
    // Find input wires sorted by port number
    const inputWires = circuit.wires
        .filter(w => w.to.nodeId === node.id)
        .sort((a, b) => a.to.port - b.to.port);
    const inputs = inputWires.map(w => sigMap.get(w.from.nodeId) ?? "'X'");
    switch (node.type) {
        case 'AND': return inputs.length >= 2 ? `${out} <= ${inputs[0]} AND ${inputs[1]};` : null;
        case 'OR': return inputs.length >= 2 ? `${out} <= ${inputs[0]} OR ${inputs[1]};` : null;
        case 'NOT': return inputs.length >= 1 ? `${out} <= NOT ${inputs[0]};` : null;
        case 'XOR': return inputs.length >= 2 ? `${out} <= ${inputs[0]} XOR ${inputs[1]};` : null;
        case 'NAND': return inputs.length >= 2 ? `${out} <= NOT (${inputs[0]} AND ${inputs[1]});` : null;
        case 'NOR': return inputs.length >= 2 ? `${out} <= NOT (${inputs[0]} OR ${inputs[1]});` : null;
        case 'XNOR': return inputs.length >= 2 ? `${out} <= ${inputs[0]} XNOR ${inputs[1]};` : null;
        case 'BUF': return inputs.length >= 1 ? `${out} <= ${inputs[0]};` : null;
        case 'CONST_0': return null; // Handled as literals
        case 'CONST_1': return null;
        default: return null;
    }
}
/** Emit Verilog assign statement for a single gate */
function gateToVerilog(node, sigMap, circuit) {
    const out = sigMap.get(node.id);
    if (!out)
        return null;
    const inputWires = circuit.wires
        .filter(w => w.to.nodeId === node.id)
        .sort((a, b) => a.to.port - b.to.port);
    const inputs = inputWires.map(w => sigMap.get(w.from.nodeId) ?? "1'bx");
    // Adapt signal names for Verilog (B(2) → B[2], seg(3) → seg[3])
    const v = (s) => s.replace(/\((\d+)\)/g, '[$1]').replace(/^'([01])'$/, "1'b$1");
    const vOut = v(out);
    const vIn = inputs.map(v);
    switch (node.type) {
        case 'AND': return vIn.length >= 2 ? `assign ${vOut} = ${vIn[0]} & ${vIn[1]};` : null;
        case 'OR': return vIn.length >= 2 ? `assign ${vOut} = ${vIn[0]} | ${vIn[1]};` : null;
        case 'NOT': return vIn.length >= 1 ? `assign ${vOut} = ~${vIn[0]};` : null;
        case 'XOR': return vIn.length >= 2 ? `assign ${vOut} = ${vIn[0]} ^ ${vIn[1]};` : null;
        case 'NAND': return vIn.length >= 2 ? `assign ${vOut} = ~(${vIn[0]} & ${vIn[1]});` : null;
        case 'NOR': return vIn.length >= 2 ? `assign ${vOut} = ~(${vIn[0]} | ${vIn[1]});` : null;
        case 'XNOR': return vIn.length >= 2 ? `assign ${vOut} = ~(${vIn[0]} ^ ${vIn[1]});` : null;
        case 'BUF': return vIn.length >= 1 ? `assign ${vOut} = ${vIn[0]};` : null;
        default: return null;
    }
}
export function parseVhdlEntity(code) {
    const entityMatch = /entity\s+(\w+)\s+is/i.exec(code);
    if (!entityMatch)
        return null;
    const portBlock = /port\s*\(([^)]+)\)/is.exec(code);
    if (!portBlock)
        return { entityName: entityMatch[1], inputs: [], outputs: [] };
    const lines = portBlock[1].split(';');
    const inputs = [];
    const outputs = [];
    for (const line of lines) {
        // Match: portname : in/out type
        const m = /(\w+)\s*:\s*(in|out)\s+/i.exec(line);
        if (!m)
            continue;
        (m[2].toLowerCase() === 'in' ? inputs : outputs).push(m[1]);
    }
    return { entityName: entityMatch[1], inputs, outputs };
}
/**
 * Generate VHDL, Verilog, and XDC from the circuit designer state.
 */
export function generateHdlFromCircuit(circuit) {
    const warnings = [];
    const xdc = generateXdcString();
    const inputNodes = circuit.nodes.filter(n => n.type === 'INPUT');
    const outputNodes = circuit.nodes.filter(n => n.type === 'OUTPUT');
    // ── Empty check ──
    if (inputNodes.length === 0 && outputNodes.length === 0) {
        warnings.push({ kind: 'empty', description: 'Add INPUT and OUTPUT nodes to generate HDL' });
        return {
            vhdl: '',
            verilog: '',
            xdc,
            warnings,
        };
    }
    // ── Cycle detection ──
    if (hasCycle(circuit)) {
        warnings.push({ kind: 'cycle', description: 'Combinational loop detected — HDL generation disabled' });
        const entity = buildVhdlEntityBlock(inputNodes, outputNodes);
        const stub = buildVhdlStub(outputNodes);
        return {
            vhdl: entity + '\n' + stub,
            verilog: buildVerilogStub(inputNodes, outputNodes),
            xdc,
            warnings,
        };
    }
    // ── Multi-driver detection ──
    const toPortKeys = circuit.wires.map(w => `${w.to.nodeId}:${w.to.port}`);
    const seen = new Set();
    for (const key of toPortKeys) {
        if (seen.has(key)) {
            const [nodeId] = key.split(':');
            const node = circuit.nodes.find(n => n.id === nodeId);
            if (node) {
                const label = `node ${node.type} (${node.id.slice(-4)})`;
                warnings.push({ kind: 'multi-driver', signal: label });
            }
        }
        seen.add(key);
    }
    // ── Topological sort + signal map ──
    const topoOrder = topoSort(circuit);
    const sigMap = buildSignalMap(circuit, topoOrder, inputNodes, outputNodes);
    // ── Generate intermediate signal declarations and assignments ──
    const intermediateNodes = topoOrder
        .map(id => circuit.nodes.find(n => n.id === id))
        .filter((n) => !!n &&
        n.type !== 'INPUT' &&
        n.type !== 'OUTPUT' &&
        n.type !== 'CONST_0' &&
        n.type !== 'CONST_1');
    const vhdlSignalDecls = intermediateNodes.map(n => {
        const sig = sigMap.get(n.id);
        return sig ? `  signal ${sig} : STD_LOGIC;` : null;
    }).filter(Boolean);
    const vhdlAssignments = intermediateNodes.map(n => {
        const line = gateToVhdl(n, sigMap, circuit);
        return line ? `  ${line}` : null;
    }).filter(Boolean);
    const verilogWireDecls = intermediateNodes.map(n => {
        const sig = sigMap.get(n.id)?.replace(/\((\d+)\)/g, '[$1]');
        return sig ? `wire ${sig};` : null;
    }).filter(Boolean);
    const verilogAssignments = intermediateNodes.map(n => {
        const line = gateToVerilog(n, sigMap, circuit);
        return line ? line : null;
    }).filter(Boolean);
    // ── Output assignments with undriven detection ──
    const sortedOutputs = [...outputNodes].sort((a, b) => a.id.localeCompare(b.id));
    const vhdlOutputLines = [];
    const verilogOutputLines = [];
    sortedOutputs.forEach((outNode, i) => {
        const outSig = sortedOutputs.length === 1 ? 'y' : `seg(${i})`;
        const vOutSig = sortedOutputs.length === 1 ? 'y' : `seg[${i}]`;
        // Find what drives this output node (a wire going TO this output)
        const driverWire = circuit.wires.find(w => w.to.nodeId === outNode.id);
        if (!driverWire) {
            warnings.push({ kind: 'undriven', signal: outSig });
            vhdlOutputLines.push(`  ${outSig} <= '1'; -- undriven`);
            verilogOutputLines.push(`assign ${vOutSig} = 1'b1; // undriven`);
        }
        else {
            const driverSig = sigMap.get(driverWire.from.nodeId);
            if (driverSig) {
                vhdlOutputLines.push(`  ${outSig} <= ${driverSig};`);
                const vDriverSig = driverSig.replace(/\((\d+)\)/g, '[$1]').replace(/^'([01])'$/, "1'b$1");
                verilogOutputLines.push(`assign ${vOutSig} = ${vDriverSig};`);
            }
            else {
                warnings.push({ kind: 'undriven', signal: outSig });
                vhdlOutputLines.push(`  ${outSig} <= '1'; -- undriven`);
                verilogOutputLines.push(`assign ${vOutSig} = 1'b1; // undriven`);
            }
        }
    });
    // ── Assemble VHDL ──
    const portDecl = buildVhdlEntityBlock(inputNodes, outputNodes);
    const vhdl = portDecl + `
architecture Behavioral of ssd_driver is
${vhdlSignalDecls.join('\n')}
begin
${vhdlAssignments.join('\n')}
${vhdlOutputLines.join('\n')}
end Behavioral;
`;
    // ── Assemble Verilog ──
    const verilog = buildVerilogModule(inputNodes, outputNodes, verilogWireDecls, verilogAssignments, verilogOutputLines);
    return { vhdl, verilog, xdc, warnings };
}
// ─── Private builders ─────────────────────────────────────────────────────────
function buildVhdlEntityBlock(inputNodes, outputNodes) {
    const inCount = inputNodes.length;
    const outCount = outputNodes.length;
    const inPort = inCount === 0 ? '' :
        inCount === 1 ? '    a : in  STD_LOGIC' :
            `    B : in  STD_LOGIC_VECTOR(${inCount - 1} downto 0)`;
    const outPort = outCount === 0 ? '' :
        outCount === 1 ? '    y : out STD_LOGIC' :
            `    seg : out STD_LOGIC_VECTOR(${outCount - 1} downto 0)`;
    const ports = [inPort, outPort].filter(Boolean).join(';\n');
    return `library IEEE;
use IEEE.STD_LOGIC_1164.ALL;

entity ssd_driver is
  Port (
${ports}
  );
end ssd_driver;
`;
}
function buildVhdlStub(outputNodes) {
    const outCount = outputNodes.length;
    const stub = outCount === 0 ? '  null;' :
        outCount === 1 ? "  y <= '1'; -- stub (cycle detected)" :
            `  seg <= (others => '1'); -- stub (cycle detected)`;
    return `architecture Behavioral of ssd_driver is
begin
${stub}
end Behavioral;
`;
}
function buildVerilogStub(inputNodes, outputNodes) {
    const inCount = inputNodes.length;
    const outCount = outputNodes.length;
    const inputDecl = inCount === 0 ? '' : inCount === 1 ? 'input a,' : `input [${inCount - 1}:0] B,`;
    const outputDecl = outCount === 0 ? '' : outCount === 1 ? 'output y' : `output [${outCount - 1}:0] seg`;
    const stub = outCount === 0 ? '// no outputs' :
        outCount === 1 ? "assign y = 1'b1; // stub (cycle detected)" :
            `assign seg = {${outCount}{1'b1}}; // stub (cycle detected)`;
    return `module ssd_driver(
  ${[inputDecl, outputDecl].filter(Boolean).join('\n  ')}
);
${stub}
endmodule
`;
}
function buildVerilogModule(inputNodes, outputNodes, wireDecls, assignments, outputLines) {
    const inCount = inputNodes.length;
    const outCount = outputNodes.length;
    const inputDecl = inCount === 0 ? '' : inCount === 1 ? 'input a,' : `input [${inCount - 1}:0] B,`;
    const outputDecl = outCount === 0 ? '' : outCount === 1 ? 'output y' : `output [${outCount - 1}:0] seg`;
    const body = [
        ...wireDecls.map(d => `  ${d}`),
        '',
        ...assignments.map(a => `  ${a}`),
        ...outputLines.map(l => `  ${l}`),
    ].join('\n');
    return `module ssd_driver(
  ${[inputDecl, outputDecl].filter(Boolean).join('\n  ')}
);
${body}
endmodule
`;
}
/**
 * Three-step proof that circuit ↔ HDL ↔ truth table are all consistent:
 *   1. Generate HDL from circuit (no cycle / empty errors)
 *   2. Parse the generated VHDL back (entity + ports round-trip correctly)
 *   3. Circuit evaluates to match the current truth table
 */
export function roundTripCheck(circuit, doc) {
    // Step 1: Generate HDL
    const hdl = generateHdlFromCircuit(circuit);
    const fatalWarning = hdl.warnings.find(w => w.kind === 'cycle' || w.kind === 'empty');
    if (fatalWarning) {
        return {
            pass: false,
            steps: [{ label: 'Generate HDL', pass: false, detail: fatalWarning.description }],
        };
    }
    // Step 2: Parse generated VHDL back
    const parsed = parseVhdlEntity(hdl.vhdl);
    const step2Pass = !!parsed &&
        parsed.entityName.length > 0 &&
        parsed.inputs.length > 0 &&
        parsed.outputs.length > 0;
    if (!step2Pass) {
        return {
            pass: false,
            steps: [
                { label: 'Generate HDL', pass: true },
                {
                    label: 'Parse VHDL (entity + ports)',
                    pass: false,
                    detail: parsed ? 'Empty port list in generated VHDL' : 'Failed to parse generated VHDL entity',
                },
            ],
        };
    }
    // Step 3: Circuit matches truth table
    const validation = validateCircuitAgainstTruthTable(circuit, doc);
    const step3Label = `Truth table (${validation.passedTests}/${validation.totalTests} rows)`;
    let firstMismatch;
    if (!validation.passed && validation.failures && validation.failures.length > 0) {
        const f = validation.failures[0];
        firstMismatch = `Row ${f.inputRow}: expected [${f.expectedOutputs.join('')}] got [${f.actualOutputs.join('')}]`;
    }
    return {
        pass: validation.passed,
        steps: [
            { label: 'Generate HDL', pass: true },
            { label: 'Parse VHDL (entity + ports)', pass: true, detail: `${parsed.entityName} — ${parsed.inputs.join(', ')} → ${parsed.outputs.join(', ')}` },
            { label: step3Label, pass: validation.passed },
        ],
        firstMismatch,
    };
}
