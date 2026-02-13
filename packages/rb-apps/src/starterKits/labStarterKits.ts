import type { ExampleId } from '../examples';
import { LAB_DEFINITIONS } from '../labs/labDefinitions';

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

function toStarterKit(definition: (typeof LAB_DEFINITIONS)[number]): LabStarterKit {
  return {
    id: definition.starterId,
    labId: definition.id,
    title: definition.title,
    timeEstimate: definition.timeEstimate,
    learningGoal: definition.learningGoal,
    whatToDo: definition.whatToDo,
    targetApp: 'logic-playground',
    exampleId: definition.starterExampleId,
    instructions: {
      labId: definition.id,
      title: definition.title,
      timeEstimate: definition.timeEstimate,
      learningGoal: definition.learningGoal,
      steps: definition.buildSteps,
      commonMistakes: definition.commonMistakes,
      submit: definition.submitEvidence,
      rubric: definition.rubric,
    },
  };
}

export const LAB_STARTER_KITS: LabStarterKit[] = LAB_DEFINITIONS.map(toStarterKit);

export function getLabStarterKitById(starterId: string): LabStarterKit | null {
  return LAB_STARTER_KITS.find((starter) => starter.id === starterId) ?? null;
}
