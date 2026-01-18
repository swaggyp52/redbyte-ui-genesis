// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Self-check utility: runs student test vectors using proof-core grading
// Option B: Controlled presets with real proof-core vector format

import { summarizeCapsule, computeVectorVerdicts } from '@redbyte/rb-fpga-proof-core';
import type { Capsule, VectorResult, SummaryCardModel } from '@redbyte/rb-fpga-proof-core';

// ============================================================================
// Types
// ============================================================================

export interface PresetVector {
  id: string;
  name: string;
  pass: boolean;
  error?: string;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  vectors: PresetVector[];
}

export interface PresetsFile {
  lab_id: string;
  presets: Preset[];
}

export interface SelfCheckResult {
  vectorId: string;
  vectorName: string;
  status: 'PASS' | 'FAIL';
  firstMismatch?: {
    tick: number;
    signal: string;
  };
}

export interface SelfCheckOutput {
  results: SelfCheckResult[];
  summary: SummaryCardModel;
  presetId: string;
  presetName: string;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Load presets for a lab from the public folder
 */
export async function loadPresets(labId: string): Promise<PresetsFile | null> {
  try {
    const res = await fetch(`/labs/${labId}.presets.json`);
    if (!res.ok) {
      console.warn(`No presets found for lab ${labId}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`Failed to load presets for ${labId}:`, e);
    return null;
  }
}

/**
 * Run self-check using a preset's vector outcomes.
 * This uses real proof-core functions to compute results.
 *
 * IMPORTANT: This shows PASS/FAIL + first mismatch metadata ONLY.
 * Never exposes expected output values or instructor vectors.
 *
 * @param preset - The selected preset with pre-computed vector outcomes
 * @param labId - The lab ID for the capsule
 * @returns Self-check output with results and summary
 */
export function runSelfCheckWithPreset(
  preset: Preset,
  labId: string
): SelfCheckOutput {
  // Build a capsule from the preset's vectors (proof-core format)
  const capsuleVectors: VectorResult[] = preset.vectors.map((v) => ({
    id: v.id,
    name: v.name,
    pass: v.pass,
    error: v.error,
  }));

  const capsule: Capsule = {
    session_id: `self-check-${Date.now()}`,
    lab_id: labId,
    vectors: capsuleVectors,
  };

  // Use proof-core to compute summary
  const summary = summarizeCapsule(capsule);

  // Convert to UI format using proof-core
  const vectorRows = computeVectorVerdicts(capsule);

  // Transform to SelfCheckResult format (with mismatch parsing)
  const results: SelfCheckResult[] = vectorRows.map((row) => {
    const result: SelfCheckResult = {
      vectorId: row.id,
      vectorName: row.name,
      status: row.status,
    };

    // Parse firstMismatch from error string if present
    if (row.error && row.status === 'FAIL') {
      const match = row.error.match(/tick (\d+), signal (\w+)/);
      if (match) {
        result.firstMismatch = {
          tick: parseInt(match[1], 10),
          signal: match[2],
        };
      }
    }

    return result;
  });

  return {
    results,
    summary,
    presetId: preset.id,
    presetName: preset.name,
  };
}

/**
 * Legacy mock self-check (for backwards compatibility during transition)
 * @deprecated Use runSelfCheckWithPreset instead
 */
export function runSelfCheck(
  studentVectors: Array<{ id: string; name: string; inputs: Record<string, number> }>,
  _circuit: object
): SelfCheckResult[] {
  // Mock: alternate PASS/FAIL for demonstration
  return studentVectors.map((vector, idx) => {
    const status = idx % 2 === 0 ? 'PASS' : 'FAIL';

    return {
      vectorId: vector.id,
      vectorName: vector.name,
      status,
      firstMismatch: status === 'FAIL' ? {
        tick: 42,
        signal: 'CLK',
      } : undefined,
    };
  });
}
