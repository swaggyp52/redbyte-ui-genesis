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
    whatToDo: 'Build ALU operations and validate output against opcode table.',
    starterId: 'alu-opcode',
    starterExampleId: '18_4bit-alu-basys3',
    basys3Required: true,
    buildSteps: [
      'Implement ALU operation paths for required opcodes.',
      'Route opcode select into operation mux/selection logic.',
    ],
    simulateChecks: [
      'Test each opcode with at least one representative input vector.',
      'Validate output and status bits where specified.',
    ],
    hardwareSteps: [
      'Map operand inputs and opcode controls to Basys3 switches/buttons.',
      'Verify at least two opcode outputs on hardware LEDs or display.',
    ],
    submitEvidence: [
      'Bundle must include opcode verification vectors.',
    ],
    commonMistakes: [
      'Opcode decode selects wrong datapath branch.',
      'Tri-state assumptions used where combinational mux is required.',
    ],
    rubric: [
      'All required opcodes behave per table.',
      'Simulation evidence includes opcode transitions.',
    ],
    requiredTop: 'top',
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
    starterExampleId: '18_4bit-alu-basys3',
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
      'Validate add and subtract modes using Basys3 input controls.',
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
    starterExampleId: '11_d-flipflop',
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
    starterExampleId: '16_8bit-counter-basys3',
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
      'Observe sequence behavior on Basys3 output path.',
      'Demonstrate at least one reset/load event on hardware.',
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
    starterExampleId: '17_traffic-light-fsm-basys3',
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
      'Exercise input sequence controls on Basys3 and observe lock output.',
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
