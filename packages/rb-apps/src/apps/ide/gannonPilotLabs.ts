export type GannonPilotLabProofScope =
  | 'browser-e0'
  | 'vivado-optional'
  | 'board-observation-optional';

export interface GannonPilotLab {
  id: string;
  labNumber: number;
  title: string;
  exampleId: string;
  build: string;
  difficulty: 'intro' | 'intermediate' | 'sequential';
  submit: string;
  proofScope: GannonPilotLabProofScope;
  startLabel: string;
}

export const GANNON_PILOT_LABS: GannonPilotLab[] = [
  {
    id: 'logic-gates',
    labNumber: 1,
    title: 'Logic Gates',
    exampleId: 'logic-gates',
    build: 'AND, OR, and XOR outputs from two Basys3 switch inputs.',
    difficulty: 'intro',
    submit: 'Submit the exported RedByte/Vivado ZIP after Verify and pin mapping.',
    proofScope: 'browser-e0',
    startLabel: 'Start Logic Gates',
  },
  {
    id: 'half-adder',
    labNumber: 2,
    title: 'Half Adder',
    exampleId: 'half-adder',
    build: 'A 1-bit adder with SUM from XOR and CARRY from AND.',
    difficulty: 'intro',
    submit: 'Submit the ZIP plus any instructor-requested truth-table notes.',
    proofScope: 'browser-e0',
    startLabel: 'Start Half Adder',
  },
  {
    id: 'full-adder',
    labNumber: 3,
    title: 'Full Adder',
    exampleId: 'full-adder',
    build: 'A full adder with carry-in, sum, and carry-out logic.',
    difficulty: 'intermediate',
    submit: 'Submit the browser-E0 ZIP; Vivado proof is separate if assigned.',
    proofScope: 'vivado-optional',
    startLabel: 'Start Full Adder',
  },
  {
    id: 'four-bit-adder',
    labNumber: 4,
    title: '4-Bit Adder',
    exampleId: 'four-bit-adder',
    build: 'A ripple-carry 4-bit adder using four chained full-adder stages.',
    difficulty: 'intermediate',
    submit: 'Submit the generated ZIP and preserve warnings if Vivado is requested.',
    proofScope: 'vivado-optional',
    startLabel: 'Start 4-Bit Adder',
  },
  {
    id: 'counter-sequential',
    labNumber: 5,
    title: '2-Bit Counter / Sequential Logic',
    exampleId: 'two-bit-counter',
    build: 'A clocked 2-bit counter using CLK100MHZ / W5, SW0 enable, and BTNC reset.',
    difficulty: 'sequential',
    submit: 'Submit the ZIP; board behavior remains instructor-verified outside RedByte.',
    proofScope: 'board-observation-optional',
    startLabel: 'Start Counter',
  },
];

export function formatGannonPilotProofScope(scope: GannonPilotLabProofScope): string {
  if (scope === 'browser-e0') {
    return 'Browser E0 package proof';
  }
  if (scope === 'vivado-optional') {
    return 'Browser E0; Vivado E1 if assigned';
  }
  return 'Browser E0; board E3 if assigned';
}
