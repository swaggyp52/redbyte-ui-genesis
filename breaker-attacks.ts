/**
 * BREAKER AGENT: Adversarial Test Harness
 * 
 * Executes 7 attack scenarios against the lab parser.
 * Captures detailed results for breach report.
 */

import { parseLabDefinition, validateLabDefinition, parseCheckpoints } from './packages/rb-logic-core/src/labs/labParser';
import { LabDefinition } from './packages/rb-logic-core/src/labs/labDefinition';

interface AttackResult {
  scenario: string;
  testCase: string;
  input: unknown;
  expected: string;
  actual: string;
  passed: boolean;
  error?: Error;
}

const results: AttackResult[] = [];

function recordAttack(
  scenario: string,
  testCase: string,
  input: unknown,
  expected: string,
  actual: string,
  passed: boolean,
  error?: Error
) {
  results.push({
    scenario,
    testCase,
    input,
    expected,
    actual,
    passed,
    error,
  });
  console.log(
    `[${passed ? '✓ PASS' : '✗ FAIL'}] ${scenario} > ${testCase}`
  );
  if (!passed) {
    console.log(`  Expected: ${expected}`);
    console.log(`  Actual: ${actual}`);
    if (error) console.log(`  Error: ${error.message}`);
  }
}

console.log('='.repeat(80));
console.log('BREAKER ATTACK SUITE: Lab Parser Adversarial Testing');
console.log('='.repeat(80));
console.log('');

// ============================================================================
// ATTACK 1: Invalid JSON Inputs
// ============================================================================
console.log('ATTACK 1: Invalid JSON Inputs');
console.log('-'.repeat(80));

const attack1Tests = [
  { label: 'null', input: null },
  { label: 'undefined', input: undefined },
  { label: 'number 123', input: 123 },
  { label: 'string "test"', input: 'test' },
  { label: 'boolean true', input: true },
  { label: 'array [1,2,3]', input: [1, 2, 3] },
];

for (const test of attack1Tests) {
  try {
    const result = parseLabDefinition(test.input);
    const passed = !result.success;
    const actual = result.success
      ? 'CRASH: Should have failed!'
      : result.error;
    recordAttack(
      'Invalid JSON Inputs',
      test.label,
      test.input,
      'success: false with error message',
      actual as string,
      passed
    );
  } catch (e) {
    recordAttack(
      'Invalid JSON Inputs',
      test.label,
      test.input,
      'success: false with error message',
      `UNHANDLED EXCEPTION: ${(e as Error).message}`,
      false,
      e as Error
    );
  }
}
console.log('');

// ============================================================================
// ATTACK 2: Missing Required Fields
// ============================================================================
console.log('ATTACK 2: Missing Required Fields');
console.log('-'.repeat(80));

const baseLabValid: Record<string, unknown> = {
  labId: 'test-lab',
  labVersion: '1.0.0',
  title: 'Test Lab',
  description: 'A test lab',
  labType: 'intro',
  instructions: 'Test instructions',
};

const requiredFields = [
  'labId',
  'labVersion',
  'title',
  'description',
  'labType',
  'instructions',
];

for (const field of requiredFields) {
  const input = { ...baseLabValid };
  delete input[field];

  try {
    const result = parseLabDefinition(input);
    const passed =
      !result.success && result.error.toLowerCase().includes(field.toLowerCase());
    const actual = result.success ? 'CRASH: Should have failed!' : result.error;
    recordAttack(
      'Missing Required Fields',
      `missing ${field}`,
      input,
      `error mentioning "${field}"`,
      actual as string,
      passed
    );
  } catch (e) {
    recordAttack(
      'Missing Required Fields',
      `missing ${field}`,
      input,
      `error mentioning "${field}"`,
      `UNHANDLED EXCEPTION: ${(e as Error).message}`,
      false,
      e as Error
    );
  }
}
console.log('');

// ============================================================================
// ATTACK 3: Invalid Field Types
// ============================================================================
console.log('ATTACK 3: Invalid Field Types');
console.log('-'.repeat(80));

const typeTests = [
  { field: 'labId', value: 123, label: 'labId as number' },
  { field: 'labId', value: true, label: 'labId as boolean' },
  { field: 'labId', value: { id: 'test' }, label: 'labId as object' },
  { field: 'labVersion', value: 123, label: 'labVersion as number' },
  { field: 'labVersion', value: null, label: 'labVersion as null' },
  { field: 'title', value: 123, label: 'title as number' },
  { field: 'description', value: [], label: 'description as array' },
  { field: 'instructions', value: 123, label: 'instructions as number' },
  { field: 'instructions', value: null, label: 'instructions as null' },
  { field: 'instructions', value: [], label: 'instructions as array' },
];

for (const test of typeTests) {
  const input = { ...baseLabValid };
  input[test.field] = test.value;

  try {
    const result = parseLabDefinition(input);
    const passed = !result.success;
    const actual = result.success
      ? 'CRASH: Should have failed!'
      : result.error;
    recordAttack(
      'Invalid Field Types',
      test.label,
      input,
      'error with type mismatch',
      actual as string,
      passed
    );
  } catch (e) {
    recordAttack(
      'Invalid Field Types',
      test.label,
      input,
      'error with type mismatch',
      `UNHANDLED EXCEPTION: ${(e as Error).message}`,
      false,
      e as Error
    );
  }
}
console.log('');

// ============================================================================
// ATTACK 4: Invalid labType
// ============================================================================
console.log('ATTACK 4: Invalid labType Values');
console.log('-'.repeat(80));

const invalidLabTypes = [
  'beginner',
  'intermediate',
  'expert',
  '',
  null,
  123,
  'INTRO',
  'Advanced',
  'Capstone',
];

for (const labType of invalidLabTypes) {
  const input = { ...baseLabValid };
  input.labType = labType;

  try {
    const result = parseLabDefinition(input);
    const passed =
      !result.success &&
      result.error.includes('intro') &&
      result.error.includes('advanced') &&
      result.error.includes('capstone');
    const actual = result.success
      ? 'CRASH: Should have failed!'
      : result.error;
    recordAttack(
      'Invalid labType',
      `labType: ${JSON.stringify(labType)}`,
      input,
      'error listing valid values (intro, advanced, capstone)',
      actual as string,
      passed
    );
  } catch (e) {
    recordAttack(
      'Invalid labType',
      `labType: ${JSON.stringify(labType)}`,
      input,
      'error listing valid values (intro, advanced, capstone)',
      `UNHANDLED EXCEPTION: ${(e as Error).message}`,
      false,
      e as Error
    );
  }
}
console.log('');

// ============================================================================
// ATTACK 5: Checkpoint Validation Edge Cases
// ============================================================================
console.log('ATTACK 5: Checkpoint Validation Edge Cases');
console.log('-'.repeat(80));

const checkpointTests = [
  {
    label: 'empty checkpoints array',
    input: { ...baseLabValid, checkpoints: [] },
    expectSuccess: true,
  },
  {
    label: 'checkpoints as string (not array)',
    input: { ...baseLabValid, checkpoints: 'not an array' },
    expectSuccess: false,
  },
  {
    label: 'checkpoints as object (not array)',
    input: { ...baseLabValid, checkpoints: { cp1: {} } },
    expectSuccess: false,
  },
  {
    label: 'checkpoint missing checkpointId',
    input: {
      ...baseLabValid,
      checkpoints: [
        {
          name: 'Test',
          description: 'Test',
          circuitGoal: { AND: 1 },
          acceptanceCriteria: {},
        },
      ],
    },
    expectSuccess: false,
  },
  {
    label: 'checkpoint missing name',
    input: {
      ...baseLabValid,
      checkpoints: [
        {
          checkpointId: 'cp-1',
          description: 'Test',
          circuitGoal: { AND: 1 },
          acceptanceCriteria: {},
        },
      ],
    },
    expectSuccess: false,
  },
  {
    label: 'checkpoint with invalid circuitGoal type',
    input: {
      ...baseLabValid,
      checkpoints: [
        {
          checkpointId: 'cp-1',
          name: 'Test',
          description: 'Test',
          circuitGoal: 'not an object',
          acceptanceCriteria: {},
        },
      ],
    },
    expectSuccess: false,
  },
  {
    label: 'checkpoint with null circuitGoal',
    input: {
      ...baseLabValid,
      checkpoints: [
        {
          checkpointId: 'cp-1',
          name: 'Test',
          description: 'Test',
          circuitGoal: null,
          acceptanceCriteria: {},
        },
      ],
    },
    expectSuccess: false,
  },
];

for (const test of checkpointTests) {
  try {
    const result = parseLabDefinition(test.input);
    const passed = result.success === test.expectSuccess;
    const actual = result.success
      ? 'success: true'
      : `success: false, error: ${result.error}`;
    recordAttack(
      'Checkpoint Validation Edge Cases',
      test.label,
      test.input,
      test.expectSuccess ? 'success: true' : 'success: false',
      actual,
      passed
    );
  } catch (e) {
    recordAttack(
      'Checkpoint Validation Edge Cases',
      test.label,
      test.input,
      test.expectSuccess ? 'success: true' : 'success: false',
      `UNHANDLED EXCEPTION: ${(e as Error).message}`,
      false,
      e as Error
    );
  }
}
console.log('');

// ============================================================================
// ATTACK 6: Extreme Inputs
// ============================================================================
console.log('ATTACK 6: Extreme Inputs');
console.log('-'.repeat(80));

// 6a: Very large instructions (1MB+)
const largeInstructions = 'A'.repeat(1024 * 1024); // 1MB string
try {
  const result = parseLabDefinition({
    ...baseLabValid,
    instructions: largeInstructions,
  });
  const passed = result.success; // Should parse without crashing
  recordAttack(
    'Extreme Inputs',
    '1MB instructions',
    { ...baseLabValid, instructions: '...(1MB)...' },
    'success: true',
    result.success ? 'success: true' : `success: false, error: ${result.error}`,
    passed
  );
} catch (e) {
  recordAttack(
    'Extreme Inputs',
    '1MB instructions',
    { ...baseLabValid, instructions: '...(1MB)...' },
    'success: true',
    `UNHANDLED EXCEPTION: ${(e as Error).message}`,
    false,
    e as Error
  );
}

// 6b: Deeply nested JSON (100 levels)
function createDeepNesting(depth: number): any {
  if (depth === 0) return baseLabValid;
  return { nested: createDeepNesting(depth - 1) };
}
const deepInput = createDeepNesting(50);
try {
  const result = parseLabDefinition(deepInput);
  const passed = !result.success; // Should fail, not crash
  recordAttack(
    'Extreme Inputs',
    '50-level deep nesting',
    { ...deepInput, level: 50 },
    'error (no stack overflow)',
    result.success ? 'CRASH: Should have failed!' : 'Failed gracefully',
    passed
  );
} catch (e) {
  recordAttack(
    'Extreme Inputs',
    '50-level deep nesting',
    { level: 50 },
    'error (no stack overflow)',
    `CAUGHT EXCEPTION: ${(e as Error).message}`,
    false,
    e as Error
  );
}

// 6c: Unicode and special characters
const unicodeInput = {
  ...baseLabValid,
  labId: '测试-лаб-🔧',
  title: 'مختبر اختبار',
  instructions: 'Instructions with émojis 🚀✨ and spëcial çharacters',
};
try {
  const result = parseLabDefinition(unicodeInput);
  const passed = result.success;
  recordAttack(
    'Extreme Inputs',
    'Unicode/emoji in fields',
    unicodeInput,
    'success: true',
    result.success ? 'success: true' : `error: ${result.error}`,
    passed
  );
} catch (e) {
  recordAttack(
    'Extreme Inputs',
    'Unicode/emoji in fields',
    unicodeInput,
    'success: true',
    `UNHANDLED EXCEPTION: ${(e as Error).message}`,
    false,
    e as Error
  );
}

// 6d: Special string values (newlines, tabs, null bytes)
const specialChars = {
  ...baseLabValid,
  title: 'Line1\nLine2\t\tTabbed\r\nCRLF',
  instructions: 'Instructions with\x00null\x00bytes\n\n\n',
};
try {
  const result = parseLabDefinition(specialChars);
  const passed = result.success;
  recordAttack(
    'Extreme Inputs',
    'Special characters (newlines, nulls, tabs)',
    specialChars,
    'success: true',
    result.success ? 'success: true' : `error: ${result.error}`,
    passed
  );
} catch (e) {
  recordAttack(
    'Extreme Inputs',
    'Special characters (newlines, nulls, tabs)',
    specialChars,
    'success: true',
    `UNHANDLED EXCEPTION: ${(e as Error).message}`,
    false,
    e as Error
  );
}
console.log('');

// ============================================================================
// ATTACK 7: Checkpoint Sorting/Indexing
// ============================================================================
console.log('ATTACK 7: Checkpoint Sorting/Indexing');
console.log('-'.repeat(80));

// 7a: Duplicate checkpoint IDs
const duplicateCheckpoints = {
  ...baseLabValid,
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
try {
  const parseResult = parseLabDefinition(duplicateCheckpoints);
  let passed = parseResult.success; // Parse allows it
  if (parseResult.success) {
    const validateResult = validateLabDefinition(parseResult.data);
    passed = !validateResult.valid && validateResult.errors.some((e) => e.includes('duplicated'));
  }
  recordAttack(
    'Checkpoint Sorting/Indexing',
    'duplicate checkpoint IDs',
    duplicateCheckpoints,
    'validation error mentioning duplicated',
    passed ? 'Caught by validator' : 'Not caught',
    passed
  );
} catch (e) {
  recordAttack(
    'Checkpoint Sorting/Indexing',
    'duplicate checkpoint IDs',
    duplicateCheckpoints,
    'validation error mentioning duplicated',
    `EXCEPTION: ${(e as Error).message}`,
    false,
    e as Error
  );
}

// 7b: Checkpoints out of order (should still pass)
const outOfOrder = {
  ...baseLabValid,
  checkpoints: [
    {
      checkpointId: 'cp-3',
      name: 'Third',
      description: 'Third checkpoint',
      circuitGoal: { AND: 1 },
      acceptanceCriteria: {},
    },
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
      circuitGoal: { AND: 1 },
      acceptanceCriteria: {},
    },
  ],
};
try {
  const result = parseLabDefinition(outOfOrder);
  const passed = result.success; // Out of order should be OK
  recordAttack(
    'Checkpoint Sorting/Indexing',
    'checkpoints out of order',
    outOfOrder,
    'success: true (no ordering requirement)',
    result.success ? 'success: true' : `error: ${result.error}`,
    passed
  );
} catch (e) {
  recordAttack(
    'Checkpoint Sorting/Indexing',
    'checkpoints out of order',
    outOfOrder,
    'success: true (no ordering requirement)',
    `EXCEPTION: ${(e as Error).message}`,
    false,
    e as Error
  );
}

// 7c: Many checkpoints (stress test)
const manyCheckpoints = {
  ...baseLabValid,
  checkpoints: Array.from({ length: 100 }, (_, i) => ({
    checkpointId: `cp-${i}`,
    name: `Checkpoint ${i}`,
    description: `Checkpoint ${i} description`,
    circuitGoal: { AND: 1 },
    acceptanceCriteria: {},
  })),
};
try {
  const result = parseLabDefinition(manyCheckpoints);
  const passed = result.success;
  recordAttack(
    'Checkpoint Sorting/Indexing',
    '100 checkpoints (stress test)',
    { ...manyCheckpoints, checkpoints: [] },
    'success: true',
    result.success ? 'success: true' : `error: ${result.error}`,
    passed
  );
} catch (e) {
  recordAttack(
    'Checkpoint Sorting/Indexing',
    '100 checkpoints (stress test)',
    { ...manyCheckpoints, checkpoints: [] },
    'success: true',
    `EXCEPTION: ${(e as Error).message}`,
    false,
    e as Error
  );
}

console.log('');
console.log('='.repeat(80));
console.log('ATTACK SUMMARY');
console.log('='.repeat(80));

const totalTests = results.length;
const passedTests = results.filter((r) => r.passed).length;
const failedTests = totalTests - passedTests;

console.log(`Total tests executed: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);
console.log('');

if (failedTests > 0) {
  console.log('FAILED TESTS:');
  results
    .filter((r) => !r.passed)
    .forEach((r) => {
      console.log(`  - [${r.scenario}] ${r.testCase}`);
      console.log(`    Input: ${JSON.stringify(r.input).substring(0, 100)}`);
      console.log(`    Expected: ${r.expected}`);
      console.log(`    Actual: ${r.actual}`);
    });
}

console.log('');
console.log('='.repeat(80));

// Export results for processing
export { results };
