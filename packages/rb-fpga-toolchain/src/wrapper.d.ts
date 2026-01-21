export const WRAPPER_VERSION: string;

export interface WrapperOptions {
  boardModelId: string;
  studentTop: string;
  pinmapHash: string;
  designHash: string;
  buildId: string;
  wrapperVersion?: string;
}

export interface SampleTemplate {
  template: string;
  swPositions: number[];
  btnPositions: number[];
  ledPositions: number[];
}

export function buildSampleTemplate(): SampleTemplate;
export function generateWrapperVerilog(options: WrapperOptions): string;
export function hashText(value: string): string;
