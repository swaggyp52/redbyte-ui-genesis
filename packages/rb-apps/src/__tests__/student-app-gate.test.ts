import { describe, it, expect } from 'vitest';
import { canOpenAppInStudentMode, STUDENT_VISIBLE_APP_ALLOWLIST } from '../studentAppGate';

describe('student app gate', () => {
  it('fails closed for inspector app open requests in student mode', () => {
    expect(canOpenAppInStudentMode('submission-inspector')).toBe(false);
    expect(canOpenAppInStudentMode('instructor')).toBe(false);
    expect(canOpenAppInStudentMode('terminal')).toBe(false);
  });

  it('allows golden-path student apps', () => {
    for (const appId of STUDENT_VISIBLE_APP_ALLOWLIST) {
      expect(canOpenAppInStudentMode(appId)).toBe(true);
    }
  });
});
