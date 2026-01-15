/**
 * Lab Schema Tests
 *
 * Comprehensive test suite for lab definition schema and parser.
 * Tests cover: valid structures, optional fields, error handling, example labs.
 */

import { describe, it, expect } from 'vitest';
import {
  LabDefinition,
  LabCheckpoint,
  isLabDefinition,
  isLabCheckpoint,
} from '../labs/labDefinition';
import {
  parseLabDefinition,
  validateLabDefinition,
  parseCheckpoints,
} from '../labs/labParser';

describe('Lab Schema - Type Guards', () => {
  it('should identify valid LabCheckpoint', () => {
    const checkpoint: LabCheckpoint = {
      checkpointId: 'cp-1',
      name: 'Sum Output',
      description: 'Build the sum output of a half adder',
      circuitGoal: { XOR: 1 },
      acceptanceCriteria: { expectedOutputs: 1 },
    };

    expect(isLabCheckpoint(checkpoint)).toBe(true);
  });

  it('should reject checkpoint with missing required field', () => {
    const invalid = {
      checkpointId: 'cp-1',
      name: 'Sum Output',
      description: 'Build the sum output',
      // Missing circuitGoal
      acceptanceCriteria: { expectedOutputs: 1 },
    };

    expect(isLabCheckpoint(invalid)).toBe(false);
  });

  it('should identify valid LabDefinition with all fields', () => {
    const lab: LabDefinition = {
      labId: 'intro-half-adder',
      labVersion: '1.0.0',
      title: 'Half Adder',
      description: 'Build a half adder circuit',
      labType: 'intro',
      instructions: '# Half Adder\n\nBuild XOR for sum, AND for carry.',
      checkpoints: [
        {
          checkpointId: 'cp-1',
          name: 'Sum Output',
          description: 'Implement sum with XOR',
          circuitGoal: { XOR: 1 },
          acceptanceCriteria: { expectedOutputs: 1 },
        },
      ],
    };

    expect(isLabDefinition(lab)).toBe(true);
  });

  it('should identify valid LabDefinition without checkpoints', () => {
    const lab: LabDefinition = {
      labId: 'intro-half-adder',
      labVersion: '1.0.0',
      title: 'Half Adder',
      description: 'Build a half adder circuit',
      labType: 'intro',
      instructions: '# Half Adder\n\nBuild XOR for sum, AND for carry.',
    };

    expect(isLabDefinition(lab)).toBe(true);
  });

  it('should reject LabDefinition with invalid labType', () => {
    const invalid = {
      labId: 'test',
      labVersion: '1.0.0',
      title: 'Test',
      description: 'Test lab',
      labType: 'invalid-type', // Invalid!
      instructions: 'Test instructions',
    };

    expect(isLabDefinition(invalid)).toBe(false);
  });

  it('should reject LabDefinition with non-string labId', () => {
    const invalid = {
      labId: 123, // Invalid!
      labVersion: '1.0.0',
      title: 'Test',
      description: 'Test lab',
      labType: 'intro',
      instructions: 'Test instructions',
    };

    expect(isLabDefinition(invalid)).toBe(false);
  });
});

describe('Lab Parser - parseLabDefinition', () => {
  it('should parse valid lab JSON successfully', () => {
    const input = {
      labId: 'intro-half-adder',
      labVersion: '1.0.0',
      title: 'Half Adder',
      description: 'Build a simple half adder',
      labType: 'intro',
      instructions: '# Instructions\n\nBuild a half adder.',
    };

    const result = parseLabDefinition(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.labId).toBe('intro-half-adder');
      expect(result.data.labVersion).toBe('1.0.0');
    }
  });

  it('should parse lab with optional checkpoints', () => {
    const input = {
      labId: 'intro-half-adder',
      labVersion: '1.0.0',
      title: 'Half Adder',
      description: 'Build a simple half adder',
      labType: 'intro',
      instructions: '# Instructions',
      checkpoints: [
        {
          checkpointId: 'cp-1',
          name: 'Sum Output',
          description: 'Build sum output',
          circuitGoal: { XOR: 1 },
          acceptanceCriteria: { expectedOutputs: 1 },
        },
        {
          checkpointId: 'cp-2',
          name: 'Carry Output',
          description: 'Build carry output',
          circuitGoal: { AND: 1 },
          acceptanceCriteria: { expectedOutputs: 1 },
        },
      ],
    };

    const result = parseLabDefinition(input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.checkpoints).toHaveLength(2);
      expect(result.data.checkpoints?.[0].checkpointId).toBe('cp-1');
    }
  });

  it('should reject missing labId', () => {
    const input = {
      // Missing labId!
      labVersion: '1.0.0',
      title: 'Test',
      description: 'Test lab',
      labType: 'intro',
      instructions: 'Test',
    };

    const result = parseLabDefinition(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('labId');
    }
  });

  it('should reject invalid labType with helpful message', () => {
    const input = {
      labId: 'test',
      labVersion: '1.0.0',
      title: 'Test',
      description: 'Test lab',
      labType: 'beginner', // Typo: should be 'intro'
      instructions: 'Test',
    };

    const result = parseLabDefinition(input);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('intro');
      expect(result.error).toContain('advanced');
      expect(result.error).toContain('capstone');
    }
  });

  it('should reject non-object input', () => {
    const result = parseLabDefinition('not an object');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Expected lab definition object');
    }
  });

  it('should reject null input', () => {
    const result = parseLabDefinition(null);

    expect(result.success).toBe(false);
  });

  it('should reject invalid checkpoint structure', () => {
    const input = {
      labId: 'test',
      labVersion: '1.0.0',
      title: 'Test',
      description: 'Test lab',
      labType: 'intro',
      instructions: 'Test',
      checkpoints: [
        {
          checkpointId: 'cp-1',
          name: 'Checkpoint',
          description: 'Test checkpoint',
          // Missing circuitGoal and acceptanceCriteria!
        },
      ],
    };

    const result = parseLabDefinition(input);

    expect(result.success).toBe(false);
  });
});

describe('Lab Parser - validateLabDefinition', () => {
  it('should validate correct lab definition', () => {
    const lab: LabDefinition = {
      labId: 'intro-half-adder',
      labVersion: '1.0.0',
      title: 'Half Adder',
      description: 'Build a simple half adder',
      labType: 'intro',
      instructions: '# Instructions\n\nBuild a half adder.',
    };

    const result = validateLabDefinition(lab);

    expect(result.valid).toBe(true);
  });

  it('should detect empty labId', () => {
    const lab: LabDefinition = {
      labId: '', // Empty!
      labVersion: '1.0.0',
      title: 'Test',
      description: 'Test lab',
      labType: 'intro',
      instructions: 'Test',
    };

    const result = validateLabDefinition(lab);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('labId'))).toBe(true);
    }
  });

  it('should detect invalid labVersion format', () => {
    const lab: LabDefinition = {
      labId: 'test',
      labVersion: 'not-semver', // Invalid!
      title: 'Test',
      description: 'Test lab',
      labType: 'intro',
      instructions: 'Test',
    };

    const result = validateLabDefinition(lab);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('labVersion'))).toBe(true);
    }
  });

  it('should detect duplicate checkpoint IDs', () => {
    const lab: LabDefinition = {
      labId: 'test',
      labVersion: '1.0.0',
      title: 'Test',
      description: 'Test lab',
      labType: 'intro',
      instructions: 'Test',
      checkpoints: [
        {
          checkpointId: 'cp-1',
          name: 'First',
          description: 'First checkpoint',
          circuitGoal: { AND: 1 },
          acceptanceCriteria: {},
        },
        {
          checkpointId: 'cp-1', // Duplicate!
          name: 'Second',
          description: 'Second checkpoint',
          circuitGoal: { OR: 1 },
          acceptanceCriteria: {},
        },
      ],
    };

    const result = validateLabDefinition(lab);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('duplicated'))).toBe(true);
    }
  });

  it('should detect empty checkpoint circuitGoal', () => {
    const lab: LabDefinition = {
      labId: 'test',
      labVersion: '1.0.0',
      title: 'Test',
      description: 'Test lab',
      labType: 'intro',
      instructions: 'Test',
      checkpoints: [
        {
          checkpointId: 'cp-1',
          name: 'Checkpoint',
          description: 'Test checkpoint',
          circuitGoal: {}, // Empty!
          acceptanceCriteria: {},
        },
      ],
    };

    const result = validateLabDefinition(lab);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.errors.some((e) => e.includes('circuitGoal'))
      ).toBe(true);
    }
  });
});

describe('Lab Parser - parseCheckpoints', () => {
  it('should parse array of valid checkpoints', () => {
    const input = [
      {
        checkpointId: 'cp-1',
        name: 'First',
        description: 'First checkpoint',
        circuitGoal: { AND: 1 },
        acceptanceCriteria: {},
      },
      {
        checkpointId: 'cp-2',
        name: 'Second',
        description: 'Second checkpoint',
        circuitGoal: { OR: 1 },
        acceptanceCriteria: { expectedOutputs: 1 },
      },
    ];

    const result = parseCheckpoints(input);

    expect(result).toHaveLength(2);
    expect(result[0].checkpointId).toBe('cp-1');
    expect(result[1].checkpointId).toBe('cp-2');
  });

  it('should return empty array for non-array input', () => {
    const result = parseCheckpoints('not an array' as unknown as unknown[]);

    expect(result).toEqual([]);
  });

  it('should skip invalid checkpoints', () => {
    const input = [
      {
        checkpointId: 'cp-1',
        name: 'Valid',
        description: 'Valid checkpoint',
        circuitGoal: { AND: 1 },
        acceptanceCriteria: {},
      },
      {
        checkpointId: 'cp-2',
        // Missing required fields!
        name: 'Invalid',
      },
    ];

    const result = parseCheckpoints(input);

    expect(result).toHaveLength(1);
    expect(result[0].checkpointId).toBe('cp-1');
  });
});

describe('Example Labs', () => {
  it('should parse Intro Half Adder lab', () => {
    const halfAdder: LabDefinition = {
      labId: 'intro-half-adder',
      labVersion: '1.0.0',
      title: 'Half Adder',
      description: 'Build a half adder circuit that adds two single-bit inputs',
      labType: 'intro',
      instructions: `
# Half Adder Lab

## Objective
Build a simple half adder that adds two bits.

## Requirements
1. Sum output: A XOR B
2. Carry output: A AND B

## Tips
- XOR gate has inverted A on one input
- AND gate is used for carry
      `,
      checkpoints: [
        {
          checkpointId: 'cp-sum',
          name: 'Sum Output',
          description: 'Implement the sum output using XOR',
          circuitGoal: { XOR: 1 },
          acceptanceCriteria: { expectedOutputs: 1 },
        },
        {
          checkpointId: 'cp-carry',
          name: 'Carry Output',
          description: 'Implement the carry output using AND',
          circuitGoal: { AND: 1 },
          acceptanceCriteria: { expectedOutputs: 1 },
        },
      ],
    };

    const parseResult = parseLabDefinition(halfAdder);
    expect(parseResult.success).toBe(true);

    if (parseResult.success) {
      const validateResult = validateLabDefinition(parseResult.data);
      expect(validateResult.valid).toBe(true);
    }
  });

  it('should parse Advanced 4-Bit Adder lab', () => {
    const fourBitAdder: LabDefinition = {
      labId: 'advanced-4bit-adder',
      labVersion: '1.0.0',
      title: '4-Bit Adder',
      description: 'Build a 4-bit ripple-carry adder using full adders',
      labType: 'advanced',
      instructions: `
# 4-Bit Ripple-Carry Adder

## Objective
Chain four full adders to create a 4-bit adder.

## Specifications
- 2x 4-bit inputs (A[3:0], B[3:0])
- Carry-in signal
- 4-bit sum output
- Carry-out signal

## Hints
- Reuse your full adder design
- Cascade carry signals
      `,
      checkpoints: [
        {
          checkpointId: 'cp-fa-design',
          name: 'Full Adder Design',
          description: 'Design a full adder with Cin, A, B inputs',
          circuitGoal: { XOR: 2, AND: 2, OR: 1 },
          acceptanceCriteria: {
            expectedOutputs: 2, // Sum and Cout
          },
        },
        {
          checkpointId: 'cp-cascade',
          name: 'Cascade Four Full Adders',
          description: 'Connect four full adders in series',
          circuitGoal: { XOR: 8, AND: 8, OR: 4 },
          acceptanceCriteria: {
            expectedOutputs: 5, // 4-bit sum + Cout
          },
        },
      ],
    };

    const parseResult = parseLabDefinition(fourBitAdder);
    expect(parseResult.success).toBe(true);

    if (parseResult.success) {
      const validateResult = validateLabDefinition(parseResult.data);
      expect(validateResult.valid).toBe(true);
    }
  });

  it('should parse Capstone Multiplier lab', () => {
    const multiplier: LabDefinition = {
      labId: 'capstone-multiplier',
      labVersion: '1.0.0',
      title: '2-Bit Multiplier',
      description: 'Design a 2-bit multiplier circuit using AND and adders',
      labType: 'capstone',
      instructions: `
# 2-Bit Multiplier

## Objective
Build a 2-bit × 2-bit multiplier.

## Specifications
- 2-bit multiplicand (X)
- 2-bit multiplier (Y)
- 4-bit product output

## Design Steps
1. AND each bit of X with each bit of Y (4 partial products)
2. Sum partial products using adders
3. Output 4-bit result

## Complexity
This is the capstone lab. Plan carefully!
      `,
      checkpoints: [
        {
          checkpointId: 'cp-partial-products',
          name: 'Partial Products',
          description: 'Generate all four partial products using AND gates',
          circuitGoal: { AND: 4 },
          acceptanceCriteria: { expectedOutputs: 4 },
        },
        {
          checkpointId: 'cp-sum-layer-1',
          name: 'First Sum Layer',
          description: 'Add first layer of partial products',
          circuitGoal: { AND: 4, XOR: 2, OR: 1 },
          acceptanceCriteria: { expectedOutputs: 3 },
        },
        {
          checkpointId: 'cp-final-sum',
          name: 'Final Product',
          description: 'Complete the full 4-bit result',
          circuitGoal: { AND: 4, XOR: 4, OR: 2 },
          acceptanceCriteria: { expectedOutputs: 4 },
        },
      ],
    };

    const parseResult = parseLabDefinition(multiplier);
    expect(parseResult.success).toBe(true);

    if (parseResult.success) {
      const validateResult = validateLabDefinition(parseResult.data);
      expect(validateResult.valid).toBe(true);
    }
  });
});

describe('Edge Cases', () => {
  it('should handle large instructions (10KB markdown)', () => {
    let largeInstructions = '# Large Lab\n\n';
    for (let i = 0; i < 1000; i++) {
      largeInstructions +=
        `## Section ${i}\nSome instruction text about section ${i}.\n`;
    }

    const lab: LabDefinition = {
      labId: 'large-instructions-lab',
      labVersion: '1.0.0',
      title: 'Large Lab',
      description: 'Lab with large instructions',
      labType: 'intro',
      instructions: largeInstructions,
    };

    const parseResult = parseLabDefinition(lab);
    expect(parseResult.success).toBe(true);

    if (parseResult.success) {
      const validateResult = validateLabDefinition(parseResult.data);
      expect(validateResult.valid).toBe(true);
    }
  });

  it('should handle empty checkpoints array', () => {
    const lab: LabDefinition = {
      labId: 'test',
      labVersion: '1.0.0',
      title: 'Test Lab',
      description: 'Test lab with empty checkpoints',
      labType: 'intro',
      instructions: 'Test instructions',
      checkpoints: [], // Empty!
    };

    const parseResult = parseLabDefinition(lab);
    expect(parseResult.success).toBe(true);

    if (parseResult.success) {
      const validateResult = validateLabDefinition(parseResult.data);
      expect(validateResult.valid).toBe(true);
    }
  });

  it('should reject invalid JSON (circular reference)', () => {
    const obj: any = { labId: 'test' };
    obj.self = obj; // Circular reference

    // parseLabDefinition will fail because type guard can't traverse it
    const result = parseLabDefinition(obj);
    expect(result.success).toBe(false);
  });
});
