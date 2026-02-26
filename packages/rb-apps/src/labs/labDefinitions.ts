import type { ExampleId } from '../examples';

export type LabStage = 'build' | 'simulate' | 'hardware' | 'submit';

export interface LabSubmitGate {
  id: string;
  severity: 'warn' | 'block';
  message: string;
  stage: LabStage;
}

export interface LabDefinition {
  id: string;
  title: string;
  timeEstimate: string;
  learningGoal: string;
  whatToDo: string;
  starterId: string;
  starterExampleId?: ExampleId;
  basys3Required: boolean;
  buildSteps: string[];
  simulateChecks: string[];
  hardwareSteps: string[];
  submitEvidence: string[];
  commonMistakes: string[];
  rubric: string[];
  submitGates: LabSubmitGate[];
  requiredTop?: string;
  requiredBoardPreset?: string;
  requireSimEvidence?: boolean;
  requireWaveform?: boolean;
  requireHardwareEvidence?: boolean;
  requiredPorts?: string[];
}

export interface LabStageTeaching {
  concept: string;
  commonMistake: string;
  goodLooksLike: string;
}

export type LabStageTeachingMap = Record<LabStage, LabStageTeaching>;

export interface LabExpectedBehaviorVisual {
  kind: 'truth-table' | 'waveform' | 'opcode';
  title: string;
  columns: string[];
  rows: string[][];
  note?: string;
}

export const LAB_DEFINITIONS: LabDefinition[] = [
  {
    id: 'lab-1',
    title: 'Lab 1 - Basic Gate Operation',
    timeEstimate: '30-45 min',
    learningGoal: 'Model simple combinational logic and verify output behavior.',
    whatToDo: 'Build simple gate paths and confirm outputs for each input state.',
    starterId: 'wire-lamp',
    starterExampleId: '01_wire-lamp',
    basys3Required: false,
    buildSteps: [
      'Create gate-level wiring for one input and one output path.',
      'Add AND/OR/NOT behavior where required by the lab handout.',
    ],
    simulateChecks: [
      'Toggle each input state and confirm expected output states.',
      'Capture probe evidence for at least one full input sweep.',
    ],
    hardwareSteps: [
      'Optional: map one input switch and one LED output to Basys3 pins.',
    ],
    submitEvidence: [
      'Submission bundle includes circuit snapshot + probe evidence.',
    ],
    commonMistakes: [
      'Gate output connected to wrong destination node.',
      'Simulation paused while expecting live output changes.',
    ],
    rubric: [
      'Correct truth behavior for tested input states.',
      'Probe trace matches expected output transitions.',
    ],
    requiredTop: 'top',
    requireSimEvidence: true,
    submitGates: [
      { id: 'sim-ran', severity: 'block', message: 'Run simulation at least once before submitting.', stage: 'simulate' },
    ],
  },
  {
    id: 'lab-2',
    title: 'Lab 2 - Hierarchical 4-bit Adder',
    timeEstimate: '45-65 min',
    learningGoal: 'Build reusable arithmetic blocks and compose a 4-bit adder hierarchy.',
    whatToDo: 'Assemble full adders into a 4-bit chain and validate sum/carry behavior.',
    starterId: 'adder-4bit',
    starterExampleId: '09_4bit-adder',
    basys3Required: false,
    buildSteps: [
      'Construct or verify full-adder sub-block structure.',
      'Chain sub-blocks to form a 4-bit ripple carry adder.',
    ],
    simulateChecks: [
      'Verify carry propagation on at least two vectors with carry transitions.',
      'Record probe traces for Cin, Sum[3:0], and Cout.',
    ],
    hardwareSteps: [
      'Optional: map A/B/Cin to SW and Sum/Cout to LED outputs.',
    ],
    submitEvidence: [
      'Bundle includes vectors showing carry propagation.',
    ],
    commonMistakes: [
      'Carry chain disconnected between bit slices.',
      'Bit ordering reversed in output wiring.',
    ],
    rubric: [
      'Adder hierarchy is complete and connected.',
      'Simulation demonstrates correct ripple-carry behavior.',
    ],
    requiredTop: 'top',
    requireSimEvidence: true,
    submitGates: [
      { id: 'probe-carry', severity: 'block', message: 'Capture at least one carry transition probe before submitting.', stage: 'simulate' },
    ],
  },
  {
    id: 'lab-3',
    title: 'Lab 3 - Seven-Segment Display Driver',
    timeEstimate: '55-75 min',
    learningGoal: 'Design combinational decode logic for seven-segment output patterns.',
    whatToDo: 'Implement segment decode behavior and verify common-anode output expectations.',
    starterId: 'seven-segment-driver',
    starterExampleId: '12_2to4-decoder',
    basys3Required: true,
    buildSteps: [
      'Build decode logic from binary input to segment outputs.',
      'Verify inversion behavior for common-anode wiring.',
    ],
    simulateChecks: [
      'Run vectors covering expected display patterns.',
      'Confirm segment outputs match required encoding states.',
    ],
    hardwareSteps: [
      'Use Basys3 seven-segment mapping preset before programming.',
      'Observe display output for at least three input patterns.',
    ],
    submitEvidence: [
      'Include simulation vectors and Basys3 readiness status in bundle.',
    ],
    commonMistakes: [
      'Active-low segment behavior not inverted for common-anode display.',
      'Incorrect pin mapping for segment outputs.',
    ],
    rubric: [
      'Segment encode logic is functionally correct.',
      'Basys3 mapping preset is applied for hardware path.',
    ],
    requiredTop: 'top',
    requiredBoardPreset: 'basys3-seven-segment',
    requireSimEvidence: true,
    requiredPorts: ['seg', 'an', 'dp'],
    submitGates: [
      { id: 'basys3-profile', severity: 'block', message: 'Select Basys3 profile before submission for this lab.', stage: 'hardware' },
    ],
  },
  {
    id: 'lab-4',
    title: 'Lab 4 - ALU with Opcode Control',
    timeEstimate: '60-80 min',
    learningGoal: 'Implement opcode-driven combinational datapath behavior.',
    whatToDo: `You are given a partially built ALU. The AND, OR, XOR gate columns, FullAdder (FA) blocks, and four MUX4 (4:1 mux) output-select blocks are already placed on the canvas. Your job: wire the datapath and opcode control to make a working 4-function ALU.

Inputs:  SW[3:0] = A operand,  SW[7:4] = B operand,  SW[10:8] = opcode (S2/S1/S0)
Outputs: LED[3:0] = result,  LED[4] = carry flag (Cout of FA[3])

Opcode table:
  000 = AND   (A AND B, bit-slice through AND[3:0])
  001 = OR    (A OR B, bit-slice through OR[3:0])
  010 = XOR   (A XOR B, bit-slice through XOR[3:0])
  011 = ADD   (A + B, ripple through FA[3:0], carry on LED[4])`,
    starterId: 'alu-opcode',
    starterExampleId: '19_lab4-alu-starter-basys3',
    basys3Required: true,
    buildSteps: [
      'Connect SW[3:0] to the A inputs of AND[3:0], OR[3:0], XOR[3:0], and FA[3:0] blocks.',
      'Connect SW[7:4] to the B inputs of AND[3:0], OR[3:0], XOR[3:0], and FA[3:0] blocks.',
      'Chain FA[0] to FA[1] to FA[2] to FA[3]: tie Cin of FA[0] to ground, connect each Cout to the next Cin.',
      'Connect the AND[3:0], OR[3:0], XOR[3:0], and FA[3:0] Sum outputs to the four pre-placed MUX4 input pins (a, b, c, d).',
      'Connect SW[10:8] (opcode S2/S1/S0) to the select lines of each mux.',
      'Connect the mux outputs to LED[3:0].',
      'Connect FA[3] Cout to LED[4].',
    ],
    simulateChecks: [
      'Test all 4 opcode selections with at least two A/B vectors each.',
      'Verify LED[4] lights for an ADD that produces a carry (e.g. A=1111, B=0001).',
    ],
    hardwareSteps: [
      'Use required mapping: SW[3:0]->A, SW[7:4]->B, SW[10:8]->opcode (S2/S1/S0), LED[3:0]->result, LED[4]->Cout.',
      'Verify each opcode (000=AND, 001=OR, 010=XOR, 011=ADD) using Basys3 switch toggles and LED output.',
    ],
    submitEvidence: [
      'Bundle must include opcode verification vectors for all four operations and the Basys3 mapping used during validation.',
    ],
    commonMistakes: [
      'Opcode select lines routed to wrong mux inputs — check S2/S1/S0 order matches the truth table.',
      'FA carry chain broken — each FA Cout must connect to the next FA Cin.',
      'LED[4] left unwired — the carry flag only appears if FA[3] Cout reaches LED[4].',
    ],
    rubric: [
      'All four opcodes (AND, OR, XOR, ADD) produce correct 4-bit results.',
      'Carry flag (LED[4]) is correct for add operations that overflow.',
      'Simulation evidence includes opcode transitions and a carry-producing add case.',
    ],
    requiredTop: 'top',
    requiredBoardPreset: 'basys3',
    requireSimEvidence: true,
    submitGates: [
      { id: 'opcode-coverage', severity: 'block', message: 'Run vectors that cover required opcodes before submitting.', stage: 'simulate' },
    ],
  },
  {
    id: 'lab-5',
    title: "Lab 5 - 2's Complement Add/Sub",
    timeEstimate: '55-75 min',
    learningGoal: 'Apply two\'s complement arithmetic in a reusable arithmetic block.',
    whatToDo: 'Implement add/sub mode control and validate signed arithmetic behavior.',
    starterId: 'twos-complement-addsub',
    starterExampleId: '20_lab5-addsub-starter-basys3',
    basys3Required: true,
    buildSteps: [
      'Implement mode-controlled inversion + carry-in path for subtraction.',
      'Reuse SSD/output formatting path where required by lab flow.',
    ],
    simulateChecks: [
      'Verify positive and negative result cases using vectors.',
      'Capture carry/overflow behavior where applicable.',
    ],
    hardwareSteps: [
      'Use Basys3 mapping: M<-SW8, A<-SW7, B<-SW6, F->LED1.',
      'Validate add and subtract modes using switch toggles and LED1 output.',
    ],
    submitEvidence: [
      'Bundle includes both add and subtract evidence vectors.',
    ],
    commonMistakes: [
      'Missing +1 carry-in on subtraction path.',
      'Sign interpretation mismatch in expected outputs.',
    ],
    rubric: [
      'Add/sub mode switching is correct.',
      'Two\'s complement behavior is demonstrated with vectors.',
    ],
    requiredTop: 'top',
    requireSimEvidence: true,
    submitGates: [
      { id: 'addsub-coverage', severity: 'block', message: 'Demonstrate both add and subtract paths before submitting.', stage: 'simulate' },
    ],
  },
  {
    id: 'lab-6',
    title: 'Lab 6 - Latches and Flip-Flops',
    timeEstimate: '50-70 min',
    learningGoal: 'Understand state retention and clocked storage behavior.',
    whatToDo: 'Implement storage elements and verify edge/level behavior.',
    starterId: 'flipflop-seq',
    starterExampleId: '21_lab6-flipflop-starter',
    basys3Required: false,
    buildSteps: [
      'Construct D latch / DFF path with correct control behavior.',
      'Add T or JK behavior where required by the assignment.',
    ],
    simulateChecks: [
      'Capture transitions around control/clock changes.',
      'Show stable state retention between clock events.',
    ],
    hardwareSteps: [
      'Optional: map clock control to Basys3 button for demonstration.',
    ],
    submitEvidence: [
      'Bundle includes waveform or probe traces around clock edges.',
    ],
    commonMistakes: [
      'Combinational loop mistaken for intended latch behavior.',
      'Clock edge expectations mismatched with implementation.',
    ],
    rubric: [
      'Storage behavior follows expected latch/FF operation.',
      'Clock/event evidence is captured and readable.',
    ],
    requiredTop: 'top',
    requireSimEvidence: true,
    requireWaveform: true,
    submitGates: [
      { id: 'clock-evidence', severity: 'block', message: 'Capture clock-related probes before submitting.', stage: 'simulate' },
    ],
  },
  {
    id: 'lab-7',
    title: 'Lab 7 - Synchronous Counter',
    timeEstimate: '60-85 min',
    learningGoal: 'Design synchronous state progression with control inputs.',
    whatToDo: 'Implement synchronous counter with control paths and verify sequence.',
    starterId: 'sync-counter-basys3',
    starterExampleId: '22_lab7-sync-counter-starter-basys3',
    basys3Required: true,
    buildSteps: [
      'Implement synchronous count path and control signals (enable/load/reset as required).',
      'Connect state output to visible display path.',
    ],
    simulateChecks: [
      'Validate expected count sequence across multiple ticks.',
      'Verify control behavior (enable/load/reset) with vectors.',
    ],
    hardwareSteps: [
      'Use Basys3 mapping: EN<-SW8, CLK<-SW7, RST<-SW6, Q3/Q2/Q1/Q0->LED3/LED2/LED1/LED0.',
      'Observe sequence behavior and demonstrate at least one reset/load event on hardware.',
    ],
    submitEvidence: [
      'Bundle includes sequence proof and control-event traces.',
    ],
    commonMistakes: [
      'Asynchronous reset assumptions in synchronous design.',
      'Enable/load precedence implemented incorrectly.',
    ],
    rubric: [
      'Counter sequence is correct and deterministic.',
      'Control signal behavior is validated.',
    ],
    requiredTop: 'top',
    requireSimEvidence: true,
    submitGates: [
      { id: 'sequence-proof', severity: 'block', message: 'Capture at least one full sequence window before submitting.', stage: 'simulate' },
    ],
  },
  {
    id: 'lab-8',
    title: 'Lab 8 - Security Lock FSM',
    timeEstimate: '75-100 min',
    learningGoal: 'Apply FSM design to a multi-step sequential interaction problem.',
    whatToDo: 'Implement the lock FSM sequence and validate lock/unlock behavior.',
    starterId: 'security-lock-fsm-basys3',
    starterExampleId: '23_lab8-fsm-lock-starter-basys3',
    basys3Required: true,
    buildSteps: [
      'Define FSM states and transitions for lock sequence behavior.',
      'Implement state outputs for lock status / display path.',
    ],
    simulateChecks: [
      'Run valid and invalid input sequences.',
      'Capture state transitions and final lock state behavior.',
    ],
    hardwareSteps: [
      'Use Basys3 mapping: IN2/IN1/IN0<-SW8/SW7/SW6, ENTER<-SW5, RESET<-SW4, LOCK->LED1.',
      'Exercise valid and invalid input sequences and observe lock output on LED1.',
    ],
    submitEvidence: [
      'Bundle includes valid/invalid sequence evidence and final state traces.',
    ],
    commonMistakes: [
      'Missing recovery transition after invalid sequence.',
      'State encoding/output mapping mismatch.',
    ],
    rubric: [
      'FSM transitions align with lock specification.',
      'Valid/invalid path behavior is clearly demonstrated.',
    ],
    requiredTop: 'top',
    requireSimEvidence: true,
    submitGates: [
      { id: 'fsm-paths', severity: 'block', message: 'Demonstrate both valid and invalid FSM paths before submitting.', stage: 'simulate' },
    ],
  },
  {
    id: 'freeplay',
    title: 'Freeplay - Build Anything',
    timeEstimate: 'Flexible',
    learningGoal: 'Practice design and debugging in an open sandbox.',
    whatToDo: 'Start from a simple template and experiment freely.',
    starterId: 'freeplay',
    starterExampleId: '01_wire-lamp',
    basys3Required: false,
    buildSteps: ['Build any circuit and iterate quickly.'],
    simulateChecks: ['Run simulation and validate your own expected behavior.'],
    hardwareSteps: ['Optional: map signals to Basys3 for hardware exploration.'],
    submitEvidence: ['Optional: export a submission bundle snapshot.'],
    commonMistakes: ['Forgetting to capture probes before exporting evidence.'],
    rubric: ['No required rubric; instructor-defined or practice-only mode.'],
    requireSimEvidence: false,
    submitGates: [],
  },
];

export function getLabDefinitionById(labId: string): LabDefinition | null {
  return LAB_DEFINITIONS.find((lab) => lab.id === labId) ?? null;
}

const DEFAULT_STAGE_TEACHING: LabStageTeachingMap = {
  build: {
    concept: 'Translate requirements into clean HDL structure before running tools.',
    commonMistake: 'Jumping to simulation before top module, ports, and constraints are aligned.',
    goodLooksLike: 'Top module and ports are explicit, with constraints selected up front.',
  },
  simulate: {
    concept: 'Use signal transitions to prove behavior, not just final values.',
    commonMistake: 'Checking one happy-path vector and assuming full correctness.',
    goodLooksLike: 'Multiple vectors are tested and expected/actual traces agree.',
  },
  hardware: {
    concept: 'Confirm simulated intent survives real timing, pins, and board I/O.',
    commonMistake: 'Treating board detection/program success as proof of functional correctness.',
    goodLooksLike: 'Live inputs produce expected outputs and edge cases are rechecked on board.',
  },
  submit: {
    concept: 'A strong submission is reproducible evidence, not just a passing run.',
    commonMistake: 'Submitting before capturing required traces and context artifacts.',
    goodLooksLike: 'Bundle includes required evidence and clearly explains expected behavior.',
  },
};

const LAB_STAGE_TEACHING_BY_ID: Record<string, Partial<LabStageTeachingMap>> = {
  'lab-1': {
    build: {
      concept: 'Combinational gates map input levels directly to output levels.',
      commonMistake: 'Output net is attached to the wrong gate or wire branch.',
      goodLooksLike: 'Each gate output path is explicit and easy to trace from input to LED.',
    },
  },
  'lab-2': {
    simulate: {
      concept: 'Carry propagation determines whether multi-bit addition is truly correct.',
      commonMistake: 'Only checking sum bits while ignoring carry chain behavior.',
      goodLooksLike: 'Cin, intermediate carries, Sum[3:0], and Cout all transition as expected.',
    },
  },
  'lab-3': {
    hardware: {
      concept: 'Seven-seg decoding must match active-low common-anode electrical behavior.',
      commonMistake: 'Using active-high truth table values directly on active-low hardware outputs.',
      goodLooksLike: 'Displayed digits match truth table and inversion is handled correctly.',
    },
  },
  'lab-4': {
    build: {
      concept: 'Opcode decode is control logic that selects one of several datapaths.',
      commonMistake: 'Overlapping opcode conditions route to unexpected operations.',
      goodLooksLike: 'Opcode selection is deterministic and each operation path is isolated.',
    },
  },
  'lab-5': {
    simulate: {
      concept: 'Subtraction in two\'s complement is add with inversion plus carry-in.',
      commonMistake: 'Forgetting the +1 carry-in when mode is subtract.',
      goodLooksLike: 'Add and subtract modes both match signed arithmetic expectations.',
    },
  },
  'lab-6': {
    simulate: {
      concept: 'Sequential logic correctness is about behavior at edges and between edges.',
      commonMistake: 'Reading output changes between edges as failures instead of hold behavior.',
      goodLooksLike: 'State updates only at intended edges and holds stable otherwise.',
    },
  },
  'lab-7': {
    hardware: {
      concept: 'Synchronous counters must honor enable/reset precedence under real clocks.',
      commonMistake: 'Testing only free-run count and not validating control priority.',
      goodLooksLike: 'Count sequence and control overrides are both demonstrated on board.',
    },
  },
  'lab-8': {
    submit: {
      concept: 'FSM confidence comes from proving both valid and invalid transition paths.',
      commonMistake: 'Showing only unlock path and omitting invalid sequence recovery.',
      goodLooksLike: 'Evidence includes valid path, invalid path, and recovery behavior.',
    },
  },
};

const LAB_EXPECTED_BEHAVIOR_BY_ID: Record<string, LabExpectedBehaviorVisual> = {
  'lab-1': {
    kind: 'truth-table',
    title: 'Gate preview',
    columns: ['A', 'B', 'Y'],
    rows: [['0', '0', '0'], ['0', '1', '0'], ['1', '0', '0'], ['1', '1', '1']],
    note: 'Adjust Y logic to match your assigned gate behavior.',
  },
  'lab-2': {
    kind: 'truth-table',
    title: 'Adder carry check',
    columns: ['A', 'B', 'Cin', 'Sum', 'Cout'],
    rows: [['0011', '0001', '0', '0100', '0'], ['1111', '0001', '0', '0000', '1']],
  },
  'lab-3': {
    kind: 'truth-table',
    title: '7-seg snippet',
    columns: ['Hex', 'seg[6:0]'],
    rows: [['0', '1000000'], ['1', '1111001'], ['2', '0100100']],
    note: 'Common-anode outputs are active-low.',
  },
  'lab-4': {
    kind: 'opcode',
    title: 'Opcode mini-table',
    columns: ['S2/S1/S0', 'Fn', 'Example (A=0011, B=0001)'],
    rows: [
      ['000', 'AND', '0011 & 0001 = 0001'],
      ['001', 'OR',  '0011 | 0001 = 0011'],
      ['010', 'XOR', '0011 ^ 0001 = 0010'],
      ['011', 'ADD', '0011 + 0001 = 0100 (Cout=0)'],
    ],
    note: 'Opcode = SW[10:8]. Result on LED[3:0]. Carry on LED[4].',
  },
  'lab-5': {
    kind: 'truth-table',
    title: 'Add/Sub mode preview',
    columns: ['M', 'A', 'B', 'Result'],
    rows: [['0', '0101', '0011', '1000'], ['1', '0101', '0011', '0010']],
  },
  'lab-6': {
    kind: 'waveform',
    title: 'Edge behavior',
    columns: ['clk', 'D', 'Q'],
    rows: [['↑', '1', '1'], ['-', '0', '1'], ['↑', '0', '0']],
    note: 'Q changes on active edge only.',
  },
  'lab-7': {
    kind: 'waveform',
    title: 'Counter sequence',
    columns: ['tick', 'en', 'Q[3:0]'],
    rows: [['0', '1', '0000'], ['1', '1', '0001'], ['2', '1', '0010']],
  },
  'lab-8': {
    kind: 'waveform',
    title: 'FSM lock path',
    columns: ['state', 'input', 'next'],
    rows: [['LOCKED', 'code[0]', 'S1'], ['S1', 'code[1]', 'S2'], ['S2', 'wrong', 'LOCKED']],
  },
  freeplay: {
    kind: 'truth-table',
    title: 'Expected behavior template',
    columns: ['Input', 'Expected', 'Observed'],
    rows: [['case-1', '...', '...'], ['case-2', '...', '...']],
    note: 'Define your own expected/actual checks before submission.',
  },
};

export function getLabStageTeaching(labId: string, stage: LabStage): LabStageTeaching {
  const overrides = LAB_STAGE_TEACHING_BY_ID[labId]?.[stage];
  return overrides ?? DEFAULT_STAGE_TEACHING[stage];
}

export function getLabExpectedBehaviorVisual(labId: string): LabExpectedBehaviorVisual {
  return LAB_EXPECTED_BEHAVIOR_BY_ID[labId] ?? LAB_EXPECTED_BEHAVIOR_BY_ID.freeplay;
}
