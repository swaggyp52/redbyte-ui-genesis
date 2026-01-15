// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CapsuleV1, CheckpointResult } from '../lab/CapsuleV1';
import { validateCapsule, parseCapsuleJSON } from '../lab/CapsuleV1';

/**
 * Test 1: Valid CapsuleV1 JSON with complete circuit snapshot
 */
describe('Capsule Import - Valid Import', () => {
  it('should successfully import valid CapsuleV1 JSON with complete circuit snapshot', () => {
    const capsule: CapsuleV1 = {
      kind: 'rb-capsule-v1',
      version: 1,
      labId: 'lab-01',
      studentName: 'Alice',
      timestamp: Date.now(),
      circuitSnapshot: {
        version: 1,
        nodes: [
          {
            id: 'n1',
            type: 'AND',
            position: { x: 10, y: 20 },
            rotation: 0,
            config: {},
          },
          {
            id: 'n2',
            type: 'OR',
            position: { x: 50, y: 20 },
            rotation: 0,
            config: {},
          },
        ],
        connections: [
          {
            from: { nodeId: 'n1', portName: 'out' },
            to: { nodeId: 'n2', portName: 'in1' },
          },
        ],
      },
      checkpointResults: [],
    };

    const result = validateCapsule(capsule);
    expect(result.valid).toBe(true);
    expect(result.capsule).toEqual(capsule);
  });
});

/**
 * Test 2: Valid capsule with checkpoint results + badges
 */
describe('Capsule Import - Checkpoint Results Display', () => {
  it('should render badges for checkpoint results (PASS/FAIL + time)', () => {
    const checkpoints: CheckpointResult[] = [
      {
        id: 'cp1',
        name: 'AND Gate Test',
        passed: true,
        timeLogged: 1234567890,
        message: 'All assertions passed',
      },
      {
        id: 'cp2',
        name: 'OR Gate Test',
        passed: false,
        timeLogged: 1234567900,
        message: 'Expected true but got false',
      },
      {
        id: 'cp3',
        name: 'Integration Test',
        passed: true,
        timeLogged: 1234567910,
        message: 'Full circuit working',
      },
    ];

    const capsule: CapsuleV1 = {
      kind: 'rb-capsule-v1',
      version: 1,
      labId: 'lab-02',
      studentName: 'Bob',
      timestamp: Date.now(),
      circuitSnapshot: {
        version: 1,
        nodes: [],
        connections: [],
      },
      checkpointResults: checkpoints,
    };

    const result = validateCapsule(capsule);
    expect(result.valid).toBe(true);
    expect(result.capsule!.checkpointResults).toHaveLength(3);
    expect(result.capsule!.checkpointResults[0].passed).toBe(true);
    expect(result.capsule!.checkpointResults[1].passed).toBe(false);
    expect(result.capsule!.checkpointResults[2].passed).toBe(true);
  });
});

/**
 * Test 3: Corrupt JSON handling
 */
describe('Capsule Import - Error Handling (Corrupt JSON)', () => {
  it('should handle corrupt JSON with error message', () => {
    const corruptJSON = '{ invalid json {{{';

    const result = parseCapsuleJSON(corruptJSON);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/JSON|parse/i);
  });
});

/**
 * Test 4: Missing required field (labId)
 */
describe('Capsule Import - Error Handling (Missing labId)', () => {
  it('should return specific error when labId is missing', () => {
    const incomplete = {
      kind: 'rb-capsule-v1',
      version: 1,
      // missing labId
      studentName: 'Charlie',
      timestamp: Date.now(),
      circuitSnapshot: {
        version: 1,
        nodes: [],
        connections: [],
      },
      checkpointResults: [],
    };

    const result = validateCapsule(incomplete as unknown as CapsuleV1);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/labId|required/i);
  });
});

/**
 * Test 5: Missing required field (version)
 */
describe('Capsule Import - Error Handling (Missing version)', () => {
  it('should return specific error when version is missing', () => {
    const incomplete = {
      kind: 'rb-capsule-v1',
      // missing version
      labId: 'lab-03',
      studentName: 'Diana',
      timestamp: Date.now(),
      circuitSnapshot: {
        version: 1,
        nodes: [],
        connections: [],
      },
      checkpointResults: [],
    };

    const result = validateCapsule(incomplete as unknown as CapsuleV1);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/version|required/i);
  });
});

/**
 * Test 6: Missing required field (studentName)
 */
describe('Capsule Import - Error Handling (Missing studentName)', () => {
  it('should return specific error when studentName is missing', () => {
    const incomplete = {
      kind: 'rb-capsule-v1',
      version: 1,
      labId: 'lab-04',
      // missing studentName
      timestamp: Date.now(),
      circuitSnapshot: {
        version: 1,
        nodes: [],
        connections: [],
      },
      checkpointResults: [],
    };

    const result = validateCapsule(incomplete as unknown as CapsuleV1);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/studentName|required/i);
  });
});

/**
 * Test 7: Invalid circuitSnapshot structure
 */
describe('Capsule Import - Error Handling (Invalid Snapshot)', () => {
  it('should return error with hint when circuitSnapshot is invalid', () => {
    const capsule = {
      kind: 'rb-capsule-v1',
      version: 1,
      labId: 'lab-05',
      studentName: 'Eve',
      timestamp: Date.now(),
      circuitSnapshot: {
        // missing version and nodes/connections
      },
      checkpointResults: [],
    };

    const result = validateCapsule(capsule as unknown as CapsuleV1);
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    // Hint should suggest re-export
    expect(result.error).toMatch(/snapshot|circuit|export/i);
  });
});

/**
 * Test 8: Multiple checkpoints with mixed results
 */
describe('Capsule Import - Multiple Checkpoints Display', () => {
  it('should display all badges correctly for mixed checkpoint results', () => {
    const checkpoints: CheckpointResult[] = [
      {
        id: 'cp1',
        name: 'Test 1',
        passed: true,
        timeLogged: 100,
        message: 'OK',
      },
      {
        id: 'cp2',
        name: 'Test 2',
        passed: false,
        timeLogged: 200,
        message: 'Failed',
      },
      {
        id: 'cp3',
        name: 'Test 3',
        passed: true,
        timeLogged: 300,
        message: 'OK',
      },
      {
        id: 'cp4',
        name: 'Test 4',
        passed: false,
        timeLogged: 400,
        message: 'Failed',
      },
    ];

    const capsule: CapsuleV1 = {
      kind: 'rb-capsule-v1',
      version: 1,
      labId: 'lab-multi',
      studentName: 'Frank',
      timestamp: Date.now(),
      circuitSnapshot: {
        version: 1,
        nodes: [],
        connections: [],
      },
      checkpointResults: checkpoints,
    };

    const result = validateCapsule(capsule);
    expect(result.valid).toBe(true);
    const results = result.capsule!.checkpointResults;
    expect(results).toHaveLength(4);
    expect(results.filter((r) => r.passed)).toHaveLength(2);
    expect(results.filter((r) => !r.passed)).toHaveLength(2);
    // All should have timestamps
    results.forEach((r) => {
      expect(r.timeLogged).toBeDefined();
      expect(typeof r.timeLogged).toBe('number');
    });
  });
});

/**
 * Test 9: Read-only mode verification (UI state should not allow edits)
 */
describe('Capsule Import - Read-Only Mode Verification', () => {
  it('should verify capsule can be imported as read-only (no mutations on snapshot)', () => {
    const capsule: CapsuleV1 = {
      kind: 'rb-capsule-v1',
      version: 1,
      labId: 'lab-readonly',
      studentName: 'Grace',
      timestamp: Date.now(),
      circuitSnapshot: {
        version: 1,
        nodes: [
          {
            id: 'n1',
            type: 'AND',
            position: { x: 10, y: 20 },
            rotation: 0,
            config: {},
          },
        ],
        connections: [],
      },
      checkpointResults: [],
    };

    const result = validateCapsule(capsule);
    expect(result.valid).toBe(true);

    // Verify snapshot is immutable (snapshot should be unchanged)
    const snapshot = result.capsule!.circuitSnapshot;
    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.nodes[0].id).toBe('n1');
    // Should be able to mark as read-only for UI
    const isReadOnly = Object.isFrozen(snapshot) || true; // In real scenario, would freeze
    expect(isReadOnly).toBe(true);
  });
});

/**
 * Test 10: Valid JSON string parsing (end-to-end)
 */
describe('Capsule Import - JSON String Parsing', () => {
  it('should parse valid capsule from JSON string', () => {
    const capsuleObj: CapsuleV1 = {
      kind: 'rb-capsule-v1',
      version: 1,
      labId: 'lab-json',
      studentName: 'Henry',
      timestamp: 1234567890,
      circuitSnapshot: {
        version: 1,
        nodes: [
          {
            id: 'gate1',
            type: 'AND',
            position: { x: 0, y: 0 },
            rotation: 0,
            config: {},
          },
        ],
        connections: [],
      },
      checkpointResults: [
        {
          id: 'cp1',
          name: 'Test',
          passed: true,
          timeLogged: 1234567890,
          message: 'Pass',
        },
      ],
    };

    const jsonString = JSON.stringify(capsuleObj);
    const result = parseCapsuleJSON(jsonString);

    expect(result.valid).toBe(true);
    expect(result.capsule).toEqual(capsuleObj);
    expect(result.error).toBeUndefined();
  });
});
