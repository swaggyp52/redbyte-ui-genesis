// LabSpecV1 schema definition for RedByte UI
// Only labId is required; all other fields are optional

export interface LabSpecV1 {
  labId: string; // required
  title?: string;
  requiredExampleId?: string;
  requirements?: {
    probes?: string[];
    minTicks?: number;
  };
  notes?: string;
}

// Example JSON for documentation:
// {
//   "labId": "lab1-dff",
//   "title": "D Flip-Flop Timing",
//   "requiredExampleId": "11_d-flipflop",
//   "requirements": {
//     "probes": ["clk", "Q"],
//     "minTicks": 20
//   },
//   "notes": "Students should demonstrate clocked storage behavior."
// }
