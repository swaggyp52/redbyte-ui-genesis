// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
// ---------------------------------------------------------------------------
// Knowledge graph: ~30 nodes covering gates, circuits, labs, and errors
// ---------------------------------------------------------------------------
export const KNOWLEDGE_NODES = [
    // ── Gate-level nodes ──────────────────────────────────────────────────
    {
        id: 'kn-not-gate',
        title: 'NOT Gate (Inverter)',
        summary: 'Outputs the opposite of its input. If input is 1, output is 0.',
        tags: ['gate', 'combinational', 'boolean', 'inverter', 'unary'],
        prereqs: [],
        maps_to: {
            gateTypes: ['NOT', 'Inverter'],
            exampleIds: ['15_not-gate'],
            lessonIds: ['A3'],
        },
        why_it_matters: 'NOT is the simplest gate and the basis of all digital logic. Combined with AND or OR, it can build any other gate.',
        common_mistakes: ['Forgetting that NOT has only one input, not two.'],
    },
    {
        id: 'kn-and-gate',
        title: 'AND Gate',
        summary: 'Outputs 1 only when all inputs are 1.',
        tags: ['gate', 'combinational', 'boolean', 'conjunction'],
        prereqs: ['kn-not-gate'],
        maps_to: {
            gateTypes: ['AND'],
            exampleIds: ['02_and-gate'],
            lessonIds: ['A4'],
        },
        why_it_matters: 'AND gates implement logical conjunction — "both conditions must be true." They are essential in address decoding, enable logic, and arithmetic carries.',
        common_mistakes: [
            'Expecting output to be high when only one input is high.',
            'Confusing AND with OR when building truth tables.',
        ],
    },
    {
        id: 'kn-or-gate',
        title: 'OR Gate',
        summary: 'Outputs 1 when at least one input is 1.',
        tags: ['gate', 'combinational', 'boolean', 'disjunction'],
        prereqs: ['kn-not-gate'],
        maps_to: {
            gateTypes: ['OR'],
            lessonIds: ['A5'],
        },
        why_it_matters: 'OR gates implement logical disjunction — "at least one condition is true." They combine signals in interrupt systems, bus arbitration, and error detection.',
        common_mistakes: ['Confusing OR with XOR — OR outputs 1 when both inputs are 1, XOR does not.'],
    },
    {
        id: 'kn-nand-gate',
        title: 'NAND Gate',
        summary: 'Outputs 0 only when all inputs are 1. The universal gate.',
        tags: ['gate', 'combinational', 'boolean', 'universal'],
        prereqs: ['kn-and-gate', 'kn-not-gate'],
        maps_to: {
            gateTypes: ['NAND'],
            lessonIds: ['A7'],
        },
        why_it_matters: 'NAND is a universal gate — any other gate can be built from NANDs alone. Real-world CMOS chips are built primarily from NAND gates because they are the most efficient to manufacture.',
        common_mistakes: ['Forgetting that NAND is the inverse of AND, not the inverse of OR.'],
    },
    {
        id: 'kn-nor-gate',
        title: 'NOR Gate',
        summary: 'Outputs 1 only when all inputs are 0. Another universal gate.',
        tags: ['gate', 'combinational', 'boolean', 'universal'],
        prereqs: ['kn-or-gate', 'kn-not-gate'],
        maps_to: {
            gateTypes: ['NOR'],
            lessonIds: ['A7'],
        },
        why_it_matters: 'NOR is also universal. The Apollo Guidance Computer was built entirely from NOR gates.',
    },
    {
        id: 'kn-xor-gate',
        title: 'XOR Gate',
        summary: 'Outputs 1 when inputs differ. The "exclusive or" — one or the other, but not both.',
        tags: ['gate', 'combinational', 'boolean', 'parity', 'arithmetic'],
        prereqs: ['kn-and-gate', 'kn-or-gate'],
        maps_to: {
            gateTypes: ['XOR'],
            exampleIds: ['06_xor-gate'],
            lessonIds: ['B1'],
        },
        why_it_matters: 'XOR is the heart of addition (the sum bit in a half adder) and parity checking. It detects "difference" between two signals.',
        common_mistakes: [
            'Confusing XOR with OR — XOR outputs 0 when both inputs are 1.',
            'Forgetting that XOR can be built from NAND gates (as shown in example 06).',
        ],
    },
    {
        id: 'kn-xnor-gate',
        title: 'XNOR Gate',
        summary: 'Outputs 1 when inputs are the same. The "equivalence" gate.',
        tags: ['gate', 'combinational', 'boolean', 'equivalence'],
        prereqs: ['kn-xor-gate'],
        maps_to: {
            gateTypes: ['XNOR'],
        },
        why_it_matters: 'XNOR detects equality between two signals. It is used in comparators and error-checking circuits.',
    },
    // ── I/O and timing nodes ──────────────────────────────────────────────
    {
        id: 'kn-switch',
        title: 'Switch (Input)',
        summary: 'A manual input that you toggle between 0 and 1. The simplest way to feed data into a circuit.',
        tags: ['io', 'input', 'control'],
        prereqs: [],
        maps_to: {
            gateTypes: ['Switch', 'SWITCH', 'INPUT'],
            exampleIds: ['01_wire-lamp'],
            lessonIds: ['A2'],
            labIds: ['lab-1'],
        },
        why_it_matters: 'Switches map to physical toggle switches on FPGA boards. Understanding inputs is the first step in hardware design.',
    },
    {
        id: 'kn-lamp',
        title: 'Lamp (Output)',
        summary: 'An output indicator that lights up when its input is 1.',
        tags: ['io', 'output', 'indicator'],
        prereqs: [],
        maps_to: {
            gateTypes: ['Lamp', 'LAMP', 'OUTPUT'],
            exampleIds: ['01_wire-lamp'],
            lessonIds: ['A1'],
            labIds: ['lab-1'],
        },
        why_it_matters: 'Lamps map to LEDs on FPGA boards. They make invisible signals visible — the fundamental act of debugging hardware.',
    },
    {
        id: 'kn-clock',
        title: 'Clock Signal',
        summary: 'A periodic signal that alternates between 0 and 1. The heartbeat of sequential circuits.',
        tags: ['timing', 'sequential', 'oscillator'],
        prereqs: [],
        maps_to: {
            gateTypes: ['Clock'],
            lessonIds: ['C1'],
        },
        why_it_matters: 'Every computer has a clock. It synchronizes all operations, ensuring flip-flops and registers update at the right moment.',
        common_mistakes: ['Forgetting that clock-driven circuits only change state on clock edges, not continuously.'],
    },
    {
        id: 'kn-power-source',
        title: 'Power Source',
        summary: 'Outputs a constant 1. Used to tie inputs high when a permanent logic-1 is needed.',
        tags: ['io', 'constant', 'power'],
        prereqs: [],
        maps_to: {
            gateTypes: ['PowerSource', 'POWER'],
        },
    },
    // ── Combinational circuit concepts ────────────────────────────────────
    {
        id: 'kn-half-adder',
        title: 'Half Adder',
        summary: 'Adds two 1-bit numbers producing a sum and a carry. Built from XOR + AND.',
        tags: ['arithmetic', 'combinational', 'adder'],
        prereqs: ['kn-xor-gate', 'kn-and-gate'],
        maps_to: {
            exampleIds: ['03_half-adder'],
            lessonIds: ['B2'],
        },
        why_it_matters: 'The half adder is the foundation of all computer arithmetic. Two of them (plus an OR gate) make a full adder.',
        common_mistakes: ['Confusing sum (XOR) and carry (AND) outputs.'],
    },
    {
        id: 'kn-full-adder',
        title: 'Full Adder',
        summary: 'Adds two 1-bit numbers plus a carry-in, producing sum and carry-out. The building block of multi-bit addition.',
        tags: ['arithmetic', 'combinational', 'adder', 'ripple-carry'],
        prereqs: ['kn-half-adder'],
        maps_to: {
            gateTypes: ['FullAdder'],
            exampleIds: ['08_full-adder', '09_4bit-adder'],
            lessonIds: ['B3'],
            labIds: ['lab-2', 'lab2_adder'],
        },
        why_it_matters: 'Chain four full adders and you get a 4-bit adder. Chain 64 and you get the adder inside your CPU. This is how computers do math.',
        common_mistakes: [
            'Forgetting the carry-in input (the difference between half and full adder).',
            'Not connecting carry-out of one stage to carry-in of the next in a ripple-carry chain.',
        ],
    },
    {
        id: 'kn-multiplexer',
        title: 'Multiplexer (Mux)',
        summary: 'Selects one of several inputs and forwards it to the output. A data selector controlled by select lines.',
        tags: ['combinational', 'routing', 'selector', 'mux'],
        prereqs: ['kn-and-gate', 'kn-or-gate', 'kn-not-gate'],
        maps_to: {
            exampleIds: ['07_2to1-mux', '13_4to1-mux'],
            lessonIds: ['B4'],
        },
        why_it_matters: 'Muxes route data inside CPUs. A 2-to-1 mux chooses between two data paths — like a railroad switch for bits.',
    },
    {
        id: 'kn-demultiplexer',
        title: 'Demultiplexer (Demux)',
        summary: 'Routes one input to one of several outputs based on select lines. The reverse of a mux.',
        tags: ['combinational', 'routing', 'demux'],
        prereqs: ['kn-multiplexer'],
        maps_to: {
            lessonIds: ['B5'],
        },
    },
    {
        id: 'kn-decoder',
        title: 'Decoder',
        summary: 'Converts an n-bit binary input into one of 2^n output lines. Only one output is active at a time.',
        tags: ['combinational', 'addressing', 'decoder'],
        prereqs: ['kn-and-gate', 'kn-not-gate'],
        maps_to: {
            exampleIds: ['12_2to4-decoder'],
        },
        why_it_matters: 'Decoders are used in memory address selection, instruction decoding, and display drivers.',
    },
    {
        id: 'kn-truth-table',
        title: 'Truth Tables',
        summary: 'A table listing every possible input combination and its corresponding output. The specification of any combinational circuit.',
        tags: ['concept', 'verification', 'specification'],
        prereqs: ['kn-and-gate', 'kn-or-gate', 'kn-not-gate'],
        maps_to: {
            lessonIds: ['A6'],
        },
        why_it_matters: 'Truth tables are the contract between design and implementation. If the circuit matches the truth table, it is correct.',
    },
    // ── Sequential logic concepts ─────────────────────────────────────────
    {
        id: 'kn-sr-latch',
        title: 'SR Latch',
        summary: 'The simplest memory element. Set (S) stores a 1, Reset (R) stores a 0. Built from cross-coupled NOR or NAND gates.',
        tags: ['sequential', 'memory', 'latch'],
        prereqs: ['kn-nor-gate'],
        maps_to: {
            gateTypes: ['RSLatch'],
            exampleIds: ['10_sr-latch'],
            lessonIds: ['C2'],
        },
        why_it_matters: 'The SR latch is where computation becomes memory. Before this, circuits only react. After this, circuits remember.',
        common_mistakes: ['Setting both S and R to 1 simultaneously — this is the "forbidden state" that makes the output undefined.'],
    },
    {
        id: 'kn-d-latch',
        title: 'D Latch',
        summary: 'Captures the data input (D) when the enable signal is high. Transparent when enabled, holds when disabled.',
        tags: ['sequential', 'memory', 'latch', 'transparent'],
        prereqs: ['kn-sr-latch'],
        maps_to: {
            lessonIds: ['C3'],
        },
        why_it_matters: 'D latches eliminate the "forbidden state" of SR latches. They are the building block of D flip-flops.',
    },
    {
        id: 'kn-d-flipflop',
        title: 'D Flip-Flop',
        summary: 'Captures the data input on the rising edge of the clock. The standard building block of registers and memory.',
        tags: ['sequential', 'memory', 'flip-flop', 'edge-triggered'],
        prereqs: ['kn-d-latch', 'kn-clock'],
        maps_to: {
            gateTypes: ['D_FLIP_FLOP', 'DFlipFlop'],
            exampleIds: ['11_d-flipflop'],
            lessonIds: ['C4'],
        },
        why_it_matters: 'D flip-flops are the atoms of computer memory. Registers, counters, and state machines are all built from D flip-flops.',
        common_mistakes: ['Confusing level-triggered (latch) with edge-triggered (flip-flop) behavior.'],
    },
    {
        id: 'kn-register',
        title: 'Register',
        summary: 'A group of flip-flops that store a multi-bit value. An n-bit register stores n bits simultaneously.',
        tags: ['sequential', 'memory', 'storage', 'register'],
        prereqs: ['kn-d-flipflop'],
        maps_to: {
            exampleIds: ['14_4bit-register'],
            lessonIds: ['C5'],
        },
        why_it_matters: 'CPU registers hold the data being actively processed. The "register file" is the fastest memory in any processor.',
    },
    {
        id: 'kn-counter',
        title: 'Counter',
        summary: 'A sequential circuit that counts clock pulses. Can count up, down, or in custom sequences.',
        tags: ['sequential', 'counting', 'state-machine'],
        prereqs: ['kn-d-flipflop', 'kn-clock'],
        maps_to: {
            gateTypes: ['Counter4Bit'],
            exampleIds: ['04_4bit-counter', '16_8bit-counter-basys3'],
            lessonIds: ['C5'],
        },
        why_it_matters: 'Counters generate addresses, divide clocks, and sequence operations. A program counter is literally a counter.',
    },
    {
        id: 'kn-fsm',
        title: 'Finite State Machine (FSM)',
        summary: 'A circuit that transitions between a finite number of states based on inputs and the current state.',
        tags: ['sequential', 'state-machine', 'control'],
        prereqs: ['kn-d-flipflop', 'kn-decoder'],
        maps_to: {
            exampleIds: ['17_traffic-light-fsm-basys3'],
            lessonIds: ['C6'],
        },
        why_it_matters: 'FSMs control everything from traffic lights to CPU instruction execution. They are the bridge between logic and behavior.',
    },
    {
        id: 'kn-alu',
        title: 'Arithmetic Logic Unit (ALU)',
        summary: 'Performs arithmetic (add, subtract) and logic (AND, OR, XOR) operations on multi-bit inputs. The computational core of a CPU.',
        tags: ['arithmetic', 'combinational', 'cpu', 'alu'],
        prereqs: ['kn-full-adder', 'kn-multiplexer'],
        maps_to: {
            exampleIds: ['18_4bit-alu-basys3'],
        },
        why_it_matters: 'The ALU is the part of the CPU that does the actual computation. Everything else — memory, control, I/O — exists to feed data to and from the ALU.',
    },
    {
        id: 'kn-cpu',
        title: 'Simple CPU',
        summary: 'A complete processor combining ALU, registers, control FSM, and memory interface. Executes instructions from a program.',
        tags: ['architecture', 'cpu', 'processor'],
        prereqs: ['kn-alu', 'kn-register', 'kn-fsm'],
        maps_to: {
            exampleIds: ['05_simple-cpu'],
            lessonIds: ['C7'],
        },
        why_it_matters: 'Building a CPU from gates is the ultimate proof that logic gates can compute anything. This is where the entire journey comes together.',
    },
    // ── Lab and workflow concepts ─────────────────────────────────────────
    {
        id: 'kn-hardware-io',
        title: 'Hardware I/O Verification',
        summary: 'Connecting to an FPGA board and verifying that switches and LEDs respond correctly.',
        tags: ['lab', 'hardware', 'fpga', 'verification'],
        prereqs: ['kn-switch', 'kn-lamp'],
        maps_to: {
            labIds: ['lab-1'],
            errorCodes: ['HW_NOT_CONNECTED', 'HW_DEVICE_NOT_FOUND', 'HW_TIMEOUT'],
            helpTopicIds: ['bridge-offline', 'hardware-timeout'],
        },
        why_it_matters: 'Before building complex circuits on hardware, you must confirm the board communicates correctly. This is the hardware equivalent of "Hello, World."',
        common_mistakes: [
            'Forgetting to connect the USB cable before clicking Connect.',
            'Not checking that the correct board driver is installed.',
        ],
    },
    {
        id: 'kn-simulation',
        title: 'Circuit Simulation',
        summary: 'Running your circuit in software to verify correctness before deploying to hardware.',
        tags: ['workflow', 'simulation', 'verification', 'testing'],
        prereqs: [],
        maps_to: {
            helpTopicIds: ['performance-mode'],
        },
        why_it_matters: 'Simulation lets you test every input combination in seconds. On hardware, you would need to flip switches thousands of times.',
    },
    {
        id: 'kn-evidence-export',
        title: 'Evidence Export & Submission',
        summary: 'Packaging your circuit, simulation results, and hardware traces into a verifiable submission bundle.',
        tags: ['workflow', 'submission', 'export', 'evidence'],
        prereqs: ['kn-simulation'],
        maps_to: {
            errorCodes: ['EVIDENCE_INVALID'],
            helpTopicIds: ['export-submission'],
        },
        why_it_matters: 'The evidence capsule proves you did the work. It includes cryptographic hashes so submissions cannot be faked.',
        common_mistakes: [
            'Exporting before running all test vectors.',
            'Forgetting to include hardware traces when required.',
        ],
    },
    {
        id: 'kn-firmware-upload',
        title: 'Firmware Upload',
        summary: 'Programming your circuit design onto the FPGA board so it runs in real hardware.',
        tags: ['hardware', 'fpga', 'deployment', 'firmware'],
        prereqs: ['kn-hardware-io'],
        maps_to: {
            errorCodes: ['FIRMWARE_UPLOAD_FAILED', 'DEVICE_VERIFICATION_FAILED'],
            helpTopicIds: ['firmware-upload'],
        },
        why_it_matters: 'This is the moment your design leaves simulation and becomes real. The FPGA physically reconfigures its internal wiring to match your circuit.',
        common_mistakes: [
            'Uploading while the board is in use by another application.',
            'Using the wrong bitstream file for your board model.',
        ],
    },
];
// ---------------------------------------------------------------------------
// Lookup functions (pure, no state)
// ---------------------------------------------------------------------------
const _byId = new Map();
const _byGateType = new Map();
const _byExampleId = new Map();
const _byLabId = new Map();
const _byErrorCode = new Map();
const _byTag = new Map();
const _byHelpTopicId = new Map();
function _pushToMap(map, key, node) {
    const arr = map.get(key);
    if (arr)
        arr.push(node);
    else
        map.set(key, [node]);
}
// Build indices once at module load
for (const node of KNOWLEDGE_NODES) {
    _byId.set(node.id, node);
    for (const tag of node.tags)
        _pushToMap(_byTag, tag, node);
    for (const gt of node.maps_to.gateTypes ?? [])
        _pushToMap(_byGateType, gt, node);
    for (const eid of node.maps_to.exampleIds ?? [])
        _pushToMap(_byExampleId, eid, node);
    for (const lid of node.maps_to.labIds ?? [])
        _pushToMap(_byLabId, lid, node);
    for (const ec of node.maps_to.errorCodes ?? [])
        _pushToMap(_byErrorCode, ec, node);
    for (const ht of node.maps_to.helpTopicIds ?? [])
        _pushToMap(_byHelpTopicId, ht, node);
}
export function getNodeById(id) {
    return _byId.get(id);
}
export function getNodesByGateType(gateType) {
    return _byGateType.get(gateType) ?? [];
}
export function getNodesByExampleId(exampleId) {
    return _byExampleId.get(exampleId) ?? [];
}
export function getNodesByLabId(labId) {
    return _byLabId.get(labId) ?? [];
}
export function getNodesByErrorCode(errorCode) {
    return _byErrorCode.get(errorCode) ?? [];
}
export function getNodesByTag(tag) {
    return _byTag.get(tag) ?? [];
}
export function getNodesByHelpTopicId(topicId) {
    return _byHelpTopicId.get(topicId) ?? [];
}
export function searchKnowledge(query) {
    const lower = query.toLowerCase().trim();
    if (!lower)
        return [];
    const scored = [];
    for (const node of KNOWLEDGE_NODES) {
        let score = 0;
        // Title match (highest weight)
        const titleLower = node.title.toLowerCase();
        if (titleLower === lower)
            score += 10;
        else if (titleLower.startsWith(lower))
            score += 6;
        else if (titleLower.includes(lower))
            score += 3;
        // Summary match
        if (node.summary.toLowerCase().includes(lower))
            score += 2;
        // Tag exact match
        for (const tag of node.tags) {
            if (tag === lower) {
                score += 4;
                break;
            }
            if (tag.includes(lower)) {
                score += 1;
                break;
            }
        }
        // Gate type match
        for (const gt of node.maps_to.gateTypes ?? []) {
            if (gt.toLowerCase() === lower) {
                score += 5;
                break;
            }
        }
        if (score > 0)
            scored.push({ node, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.node);
}
