import type { ExampleId } from '../examples';

export interface LabStarterInstructions {
  labId: string;
  title: string;
  timeEstimate: string;
  learningGoal: string;
  steps: string[];
  commonMistakes: string[];
  submit: string[];
  rubric: string[];
}

export interface LabStarterKit {
  id: string;
  labId: string;
  title: string;
  timeEstimate: string;
  learningGoal: string;
  whatToDo: string;
  targetApp: 'logic-playground' | 'ece-lab';
  exampleId?: ExampleId;
  instructions: LabStarterInstructions;
}

function createStarter(
  starter: Omit<LabStarterKit, 'instructions'> & {
    instructions: Omit<LabStarterInstructions, 'labId' | 'title' | 'timeEstimate' | 'learningGoal'>;
  },
): LabStarterKit {
  return {
    ...starter,
    instructions: {
      labId: starter.labId,
      title: starter.title,
      timeEstimate: starter.timeEstimate,
      learningGoal: starter.learningGoal,
      ...starter.instructions,
    },
  };
}

export const LAB_STARTER_KITS: LabStarterKit[] = [
  createStarter({
    id: 'wire-lamp',
    labId: 'lab-1',
    title: 'Lab 1 - Wire + Lamp',
    timeEstimate: '30-40 min',
    learningGoal: 'Learn signal flow and basic input/output behavior.',
    whatToDo: 'Toggle the input and confirm output state changes.',
    targetApp: 'logic-playground',
    exampleId: '01_wire-lamp',
    instructions: {
      steps: [
        'Click `Run` in the top command bar to start simulation.',
        'Toggle the switch input and confirm the lamp output changes immediately.',
        'Open the right dock Probes tab and add a probe on input and output.',
        'Step one tick at a time and verify both probe values match.',
      ],
      commonMistakes: [
        'If the lamp never changes, confirm the wire is connected to the correct ports.',
        'If probes stay at 0, make sure simulation is running or use `Step`.',
        'If values look inverted, verify you did not place a NOT gate by mistake.',
      ],
      submit: [
        'Click `Generate Submission Bundle` in the command bar.',
        'Upload the generated `rb-submission-<id>.zip` file to your LMS.',
      ],
      rubric: [
        'Input toggle evidence is visible.',
        'Output follows input for both 0 and 1.',
        'Probe data is captured in the submission bundle.',
      ],
    },
  }),
  createStarter({
    id: 'half-adder',
    labId: 'lab-2',
    title: 'Lab 2 - Half Adder',
    timeEstimate: '35-50 min',
    learningGoal: 'Build intuition for SUM and CARRY outputs.',
    whatToDo: 'Verify all four input combinations.',
    targetApp: 'logic-playground',
    exampleId: '03_half-adder',
    instructions: {
      steps: [
        'Set A/B to `00`, `01`, `10`, and `11` in order.',
        'After each input change, verify `SUM` and `CARRY` outputs in the right dock.',
        'Open Probes and add `SUM` and `CARRY` probes before your final pass.',
        'Run one full truth-table sweep and confirm all four cases are correct.',
      ],
      commonMistakes: [
        'If SUM is wrong for `11`, check XOR wiring first.',
        'If CARRY is always 0, confirm the AND gate output is connected.',
        'If outputs lag, step one tick after changing inputs.',
      ],
      submit: [
        'Generate a submission bundle after all four cases pass.',
        'Upload only the `rb-submission-<id>.zip` bundle.',
      ],
      rubric: [
        'All four A/B combinations were tested.',
        'SUM output matches the half-adder truth table.',
        'CARRY output matches the half-adder truth table.',
      ],
    },
  }),
  createStarter({
    id: 'full-adder',
    labId: 'lab-3',
    title: 'Lab 3 - Full Adder',
    timeEstimate: '40-55 min',
    learningGoal: 'Understand carry-in and carry-out propagation.',
    whatToDo: 'Test carry-in and observe ripple behavior.',
    targetApp: 'logic-playground',
    exampleId: '08_full-adder',
    instructions: {
      steps: [
        'Run test vectors with `Cin=0` and `Cin=1` for the same A/B pair.',
        'Verify `Sum` and `Cout` after each vector.',
        'Probe `Cin`, `Sum`, and `Cout` to capture at least one carry transition.',
        'Use replay/verify tools before generating your final bundle.',
      ],
      commonMistakes: [
        'If `Cout` is wrong, inspect the second-stage carry logic path.',
        'If `Sum` is always high, confirm XOR stages are not shorted.',
        'If replay fails, rerun and export from a clean passing run.',
      ],
      submit: [
        'Generate Submission Bundle after carry behavior is verified.',
        'Submit `rb-submission-<id>.zip` with no extra file renaming.',
      ],
      rubric: [
        'Cin=0 and Cin=1 cases are both covered.',
        'Sum output is correct for tested vectors.',
        'Carry propagation is demonstrated with probe evidence.',
      ],
    },
  }),
  createStarter({
    id: 'd-flipflop',
    labId: 'lab-4',
    title: 'Lab 4 - D Flip-Flop',
    timeEstimate: '35-50 min',
    learningGoal: 'Observe edge-triggered state updates.',
    whatToDo: 'Step the clock and check stored value transitions.',
    targetApp: 'logic-playground',
    exampleId: '11_d-flipflop',
    instructions: {
      steps: [
        'Set D to a known value before advancing the clock.',
        'Use `Step` to advance one tick and watch Q update on the expected edge.',
        'Repeat with D=0 and D=1 to show both transitions.',
        'Capture probes/waveform that shows D and Q relationship across clock edges.',
      ],
      commonMistakes: [
        'If Q changes without a clock edge, check for unintended async paths.',
        'If Q never changes, verify the clock source is connected.',
        'If transitions look random, slow the tick rate and step manually.',
      ],
      submit: [
        'Generate Submission Bundle after confirming edge-trigger behavior.',
        'Upload the zip bundle as your lab artifact.',
      ],
      rubric: [
        'Edge-triggered behavior is demonstrated.',
        'Q changes only on valid clock events.',
        'Probe evidence includes D, clock, and Q signals.',
      ],
    },
  }),
  createStarter({
    id: 'counter-basys3',
    labId: 'lab-5',
    title: 'Lab 5 - 8-bit Counter (Basys3)',
    timeEstimate: '45-60 min',
    learningGoal: 'Connect simulation behavior to Basys3-oriented designs.',
    whatToDo: 'Run simulation and inspect increment behavior over ticks.',
    targetApp: 'logic-playground',
    exampleId: '16_8bit-counter-basys3',
    instructions: {
      steps: [
        'Run the counter for several ticks and confirm increment-by-1 behavior.',
        'If reset exists, assert reset and verify the counter returns to 0.',
        'Observe bus values through wrap-around (e.g., 255 to 0).',
        'Keep Basys3 preset/constraints unchanged for this starter.',
      ],
      commonMistakes: [
        'If values skip, confirm only one clock source is active.',
        'If reset does nothing, verify reset polarity in the design.',
        'If output looks stuck, check whether simulation is paused.',
      ],
      submit: [
        'Generate Submission Bundle after verifying increment and wrap behavior.',
        'Submit the bundle zip to your lab dropbox.',
      ],
      rubric: [
        'Increment sequence is correct.',
        'Wrap-around behavior is demonstrated.',
        'Reset behavior is validated when present.',
      ],
    },
  }),
  createStarter({
    id: 'traffic-fsm-basys3',
    labId: 'lab-6',
    title: 'Lab 6 - Traffic Light FSM (Basys3)',
    timeEstimate: '45-65 min',
    learningGoal: 'Practice finite-state machine sequencing and timing.',
    whatToDo: 'Trace state transitions and timing expectations.',
    targetApp: 'logic-playground',
    exampleId: '17_traffic-light-fsm-basys3',
    instructions: {
      steps: [
        'Run long enough to capture a complete FSM cycle.',
        'Verify state order matches your lab handout sequence.',
        'Check each state dwell time with probes/ticks.',
        'Capture one clean full-cycle run before submission.',
      ],
      commonMistakes: [
        'If state order is wrong, inspect next-state logic conditions.',
        'If timing is too fast, reduce tick rate before capturing evidence.',
        'If reproducibility fails, rerun from reset and export a fresh bundle.',
      ],
      submit: [
        'Generate Submission Bundle after one complete verified cycle.',
        'Upload the resulting `rb-submission-<id>.zip` file.',
      ],
      rubric: [
        'State order matches the required FSM sequence.',
        'Timing windows are respected for each state.',
        'A full cycle is captured in the submission evidence.',
      ],
    },
  }),
];

export function getLabStarterKitById(starterId: string): LabStarterKit | null {
  return LAB_STARTER_KITS.find((starter) => starter.id === starterId) ?? null;
}
