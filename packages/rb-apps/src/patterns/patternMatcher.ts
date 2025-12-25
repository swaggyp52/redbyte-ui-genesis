// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import type { Circuit } from '@redbyte/rb-logic-core';

export interface RecognizedPattern {
  name: string;
  description: string;
  layer: number;
  confidence: number; // 0-1, how confident we are in the match
}

interface PatternSignature {
  name: string;
  description: string;
  layer: number;
  // Structural pattern matching
  gateTypes: Record<string, number>; // e.g., { "XOR": 1, "AND": 1 } for half adder
  minConnections: number;
  maxConnections: number;
  // Optional: specific topology checks
  hasInputs?: boolean;
  hasOutputs?: boolean;
}

const KNOWN_PATTERNS: PatternSignature[] = [
  // Layer 1: Combinational Logic
  {
    name: 'XOR Gate',
    description: 'One input OR the other, but not both - the foundation of addition!',
    layer: 1,
    gateTypes: { 'NAND': 3 },
    minConnections: 5,
    maxConnections: 7,
    hasInputs: true,
    hasOutputs: true,
  },
  {
    name: 'Half Adder',
    description: 'Adds two 1-bit numbers! Sum and carry outputs.',
    layer: 1,
    gateTypes: { 'XOR': 1, 'AND': 1 },
    minConnections: 4,
    maxConnections: 6,
    hasInputs: true,
    hasOutputs: true,
  },
  {
    name: '2-to-1 Multiplexer',
    description: 'Chooses between two inputs using a select signal!',
    layer: 1,
    gateTypes: { 'NOT': 1, 'AND': 2, 'OR': 1 },
    minConnections: 6,
    maxConnections: 9,
    hasInputs: true,
    hasOutputs: true,
  },

  // Layer 2: Arithmetic
  {
    name: 'Full Adder',
    description: 'Adds two bits plus a carry-in - the building block of calculators!',
    layer: 2,
    gateTypes: { 'XOR': 2, 'AND': 2, 'OR': 1 },
    minConnections: 10,
    maxConnections: 13,
    hasInputs: true,
    hasOutputs: true,
  },

  // Layer 3: Memory
  {
    name: 'SR Latch',
    description: 'Your first memory circuit! It remembers a bit using feedback.',
    layer: 3,
    gateTypes: { 'NOR': 2 },
    minConnections: 4,
    maxConnections: 6,
    hasInputs: true,
    hasOutputs: true,
  },
  {
    name: 'D Latch',
    description: 'Data latch with enable - stores a bit when enabled!',
    layer: 3,
    gateTypes: { 'NAND': 4 },
    minConnections: 6,
    maxConnections: 10,
    hasInputs: true,
    hasOutputs: true,
  },

  // Layer 4: Control & Coordination
  {
    name: '2-to-4 Decoder',
    description: 'Decodes 2-bit input into 4 output lines - memory addressing magic!',
    layer: 4,
    gateTypes: { 'NOT': 2, 'AND': 4 },
    minConnections: 12,
    maxConnections: 16,
    hasInputs: true,
    hasOutputs: true,
  },
  {
    name: '4-to-1 Multiplexer',
    description: 'Selects one of four inputs - data routing at its finest!',
    layer: 4,
    gateTypes: { 'NOT': 2, 'AND': 8, 'OR': 3 },
    minConnections: 25,
    maxConnections: 32,
    hasInputs: true,
    hasOutputs: true,
  },
];

/**
 * Analyzes a circuit and attempts to recognize known patterns.
 * Returns the best match if confidence is high enough.
 */
export function recognizePattern(circuit: Circuit): RecognizedPattern | null {
  if (!circuit || circuit.nodes.length === 0) {
    return null;
  }

  // Count gate types in the circuit
  const gateTypeCounts: Record<string, number> = {};
  let inputCount = 0;
  let outputCount = 0;

  circuit.nodes.forEach((node) => {
    if (node.type === 'INPUT') {
      inputCount++;
    } else if (node.type === 'OUTPUT') {
      outputCount++;
    } else {
      gateTypeCounts[node.type] = (gateTypeCounts[node.type] || 0) + 1;
    }
  });

  const connectionCount = circuit.connections.length;

  // Try to match against known patterns
  let bestMatch: { pattern: PatternSignature; confidence: number } | null = null;

  for (const pattern of KNOWN_PATTERNS) {
    let confidence = 0;
    let maxPossibleScore = 0;

    // Check gate type matching (most important)
    const gateTypeScore = calculateGateTypeScore(gateTypeCounts, pattern.gateTypes);
    confidence += gateTypeScore.score;
    maxPossibleScore += gateTypeScore.maxScore;

    // Check connection count
    if (connectionCount >= pattern.minConnections && connectionCount <= pattern.maxConnections) {
      confidence += 0.3;
    }
    maxPossibleScore += 0.3;

    // Check input/output presence
    if (pattern.hasInputs && inputCount > 0) {
      confidence += 0.1;
    }
    if (pattern.hasOutputs && outputCount > 0) {
      confidence += 0.1;
    }
    if (pattern.hasInputs) maxPossibleScore += 0.1;
    if (pattern.hasOutputs) maxPossibleScore += 0.1;

    // Normalize confidence to 0-1
    const normalizedConfidence = maxPossibleScore > 0 ? confidence / maxPossibleScore : 0;

    // Update best match if this is better
    if (!bestMatch || normalizedConfidence > bestMatch.confidence) {
      bestMatch = { pattern, confidence: normalizedConfidence };
    }
  }

  // Only return if confidence is high enough (>= 80%)
  if (bestMatch && bestMatch.confidence >= 0.8) {
    return {
      name: bestMatch.pattern.name,
      description: bestMatch.pattern.description,
      layer: bestMatch.pattern.layer,
      confidence: bestMatch.confidence,
    };
  }

  return null;
}

/**
 * Calculates how well the circuit's gate types match the pattern's expected types.
 */
function calculateGateTypeScore(
  circuitGates: Record<string, number>,
  patternGates: Record<string, number>
): { score: number; maxScore: number } {
  let score = 0;
  const maxScore = Object.keys(patternGates).length * 0.5; // 0.5 points per gate type

  for (const [gateType, expectedCount] of Object.entries(patternGates)) {
    const actualCount = circuitGates[gateType] || 0;

    // Exact match gets full points
    if (actualCount === expectedCount) {
      score += 0.5;
    }
    // Close match gets partial points
    else if (Math.abs(actualCount - expectedCount) <= 1) {
      score += 0.25;
    }
  }

  // Penalize extra gate types not in pattern
  const extraGateTypes = Object.keys(circuitGates).filter(
    (type) => !patternGates[type]
  );
  if (extraGateTypes.length > 2) {
    score -= 0.2; // Penalty for too many extra gates
  }

  return { score: Math.max(0, score), maxScore };
}
