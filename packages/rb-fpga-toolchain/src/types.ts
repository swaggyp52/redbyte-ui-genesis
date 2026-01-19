// Copyright 2025 Connor Angiel
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * Detected toolchain capabilities
 */
export interface ToolchainCapabilities {
  vivado?: {
    version: string;
    path: string;
    canSynthesize: boolean;
    canProgram: boolean;
  };
  yosys?: {
    version: string;
    path: string;
  };
  nextpnr?: {
    version: string;
    path: string;
  };
  openFPGALoader?: {
    version: string;
    path: string;
    supportedBoards: string[];
  };
}

/**
 * Synthesis job request
 */
export interface SynthesisRequest {
  source: 'circuit' | 'verilog';
  verilog?: string;
  circuitJson?: string;
  board: 'basys3';
  constraints?: ConstraintOverrides;
  options?: SynthesisOptions;
}

export interface SynthesisOptions {
  optimize?: 'speed' | 'area';
  verbose?: boolean;
}

export interface ConstraintOverrides {
  clockPin?: string;
  inputPins?: Record<string, string>;
  outputPins?: Record<string, string>;
}

/**
 * Synthesis job status
 */
export type SynthesisStatus =
  | 'queued'
  | 'synthesizing'
  | 'routing'
  | 'generating'
  | 'complete'
  | 'failed';

export interface SynthesisJob {
  jobId: string;
  status: SynthesisStatus;
  progress: number; // 0-100
  logs: string[];
  artifacts?: SynthesisArtifacts;
  error?: string;
  startedAt: number;
  completedAt?: number;
}

export interface SynthesisArtifacts {
  bitstream?: string; // Base64-encoded .bit file
  timing?: TimingReport;
  utilization?: UtilizationReport;
}

export interface TimingReport {
  wns: number; // Worst Negative Slack
  tns: number; // Total Negative Slack
  met: boolean;
}

export interface UtilizationReport {
  luts: { used: number; available: number; percent: number };
  ffs: { used: number; available: number; percent: number };
  brams: { used: number; available: number; percent: number };
  dsps: { used: number; available: number; percent: number };
}

/**
 * Programming job request
 */
export interface ProgramRequest {
  bitstream: string; // Base64-encoded .bit
  board: 'basys3';
  method: 'vivado' | 'openFPGALoader';
  verify?: boolean;
}

export type ProgramStatus =
  | 'queued'
  | 'connecting'
  | 'uploading'
  | 'verifying'
  | 'complete'
  | 'failed';

export interface ProgramJob {
  jobId: string;
  status: ProgramStatus;
  progress: number;
  error?: string;
  startedAt: number;
  completedAt?: number;
}

/**
 * Supported board definitions
 */
export interface BoardDefinition {
  id: string;
  name: string;
  fpgaPart: string;
  clockFrequency: number;
  defaultClockPin: string;
  ioMapping: {
    switches: string[];
    leds: string[];
    buttons: string[];
    sevenSeg?: {
      cathodes: string[];
      anodes: string[];
    };
    pmod?: Record<string, string[]>;
  };
}

/**
 * Verilog primitive definition
 */
export interface VerilogPrimitive {
  nodeType: string;
  moduleName: string;
  verilog: string;
  ports: {
    inputs: string[];
    outputs: string[];
  };
}
