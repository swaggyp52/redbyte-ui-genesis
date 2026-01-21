export interface InterfacePort {
  name: string;
  direction: "input" | "output" | "inout";
  width: number;
}

export interface InterfaceCheckResult {
  ok: boolean;
  missing: string[];
  invalid: Array<{
    name: string;
    expected_direction: string;
    actual_direction: string;
    expected_width: number;
    actual_width: number;
  }>;
  foundModule: boolean;
}

export function checkTopInterface(options: {
  sources: string[];
  topName: string;
}): InterfaceCheckResult;

export function getRequiredInterface(): InterfacePort[];
