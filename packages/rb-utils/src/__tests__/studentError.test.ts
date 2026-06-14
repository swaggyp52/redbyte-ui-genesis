import { describe, expect, it } from 'vitest';
import { RbUserError, toStudentFacingError } from '../studentError';

describe('student error classification', () => {
  it('does not classify generic fetch failures as bridge failures', () => {
    const studentError = toStudentFacingError(new TypeError('Failed to fetch dynamically imported module'));

    expect(studentError.code).toBe('UNEXPECTED_ERROR');
    expect(studentError.title).toBe('Unexpected Error');
    expect(studentError.message).not.toMatch(/bridge/i);
  });

  it('keeps explicit bridge errors mapped to bridge guidance', () => {
    const studentError = toStudentFacingError(new RbUserError('BRIDGE_UNREACHABLE'));

    expect(studentError.code).toBe('BRIDGE_UNREACHABLE');
    expect(studentError.title).toBe('Bridge Unreachable');
    expect(studentError.message).toMatch(/RedByte Bridge Unreachable/i);
  });
});
