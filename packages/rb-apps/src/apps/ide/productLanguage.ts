export const SIGNAL_LANGUAGE = {
  inputSignal: 'A value your circuit reads.',
  outputSignal: 'A value your circuit drives.',
  label: 'The name shown in RedByte.',
  boardResource: 'The physical switch, button, LED, or clock used on Basys3.',
  packagePin: 'The FPGA pin written into the exported constraints.',
  designLogicalIo:
    'Add logical inputs and outputs. You can map them to Basys3 switches and LEDs later.',
  mappingBoundary:
    'Map a logical signal to a Basys3 control. This writes constraints into the export package; it does not prove board behavior.',
  exportPinSummary: 'Signal -> Board resource -> Package pin',
} as const;

export const TESTBENCH_LANGUAGE = {
  case: 'One input combination to try.',
  expectedOutput: 'What your circuit should produce.',
  observedOutput: 'What RedByte simulated.',
  observe: 'See what the circuit currently does and record observed outputs without comparison.',
  compare: 'Compare the run by checking expected outputs against observed outputs.',
  staleResult: 'Checks changed. Rerun Compare before trusting the result.',
  createSteps: [
    'Add or select input cases.',
    'Fill expected outputs.',
    'Run Compare.',
    'Fix expected values or inspect design.',
  ],
} as const;

export const PROOF_LANGUAGE = {
  browserE0: 'Browser E0',
  browserE0Detail: 'Current RedByte/browser/package evidence.',
  vivado: 'External toolchain step.',
  board: 'Physical hardware observation.',
  exportBoundary:
    'RedByte can create a browser-E0 handoff package. Vivado build, bitstream, and board observation stay external until you run them.',
} as const;

export const WORKFLOW_LANGUAGE = {
  stages: ['Project', 'Design', 'Verify', 'Map Pins', 'Export'],
  importUtility: 'Import / Recovery',
  importBoundary: 'Import is a review-gated utility, not a required workflow stage.',
} as const;
