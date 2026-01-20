import basys3MvpLab from '../../../../labs/basys3_mvp_lab/lab.json';

export interface LabTemplate {
  lab_id: string;
  lab_version: string;
  board: string;
  bin_size_ms: number;
  required_artifacts: {
    trace: boolean;
    bitstream: boolean;
  };
  signal_names: {
    digital: Record<string, string>;
    analog: Record<string, string>;
  };
  checks?: Array<
    | {
        id: string;
        type: 'min_events';
        min: number;
      }
    | {
        id: string;
        type: 'min_hw_ticks';
        min: number;
      }
    | {
        id: string;
        type: 'digital_toggled';
        bit: number;
      }
  >;
}

const LAB_TEMPLATES: Record<string, LabTemplate> = {
  [basys3MvpLab.lab_id]: basys3MvpLab as LabTemplate,
};

export function getLabTemplate(labId: string): LabTemplate | null {
  return LAB_TEMPLATES[labId] ?? null;
}
