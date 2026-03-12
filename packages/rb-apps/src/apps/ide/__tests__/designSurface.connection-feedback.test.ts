/**
 * Unit tests for connection rejection feedback in DesignSurface.
 *
 * These tests verify that raw wire validation reasons are translated
 * into student-readable messages and that every known rejection case
 * has an explicit, non-generic message.
 */

import { describe, expect, it } from 'vitest';
import { connectionRejectedMessage } from '../surfaces/DesignSurface';

describe('connectionRejectedMessage', () => {
  it('translates self-loop to student-readable message', () => {
    const msg = connectionRejectedMessage('Cannot connect node to itself');
    expect(msg).toBe('A gate cannot connect to itself.');
  });

  it('translates duplicate wire to student-readable message', () => {
    const msg = connectionRejectedMessage('Connection already exists');
    expect(msg).toBe('That wire already exists.');
  });

  it('translates input-to-input rejection to student-readable message', () => {
    const msg = connectionRejectedMessage('Cannot connect input to input');
    expect(msg).toBe('Inputs cannot be wired directly to each other.');
  });

  it('translates output-to-output rejection to student-readable message', () => {
    const msg = connectionRejectedMessage('Cannot connect output to output');
    expect(msg).toBe('Outputs cannot be wired directly to each other.');
  });

  it('returns generic message for unknown rejection reason', () => {
    const msg = connectionRejectedMessage('some-unknown-reason');
    expect(msg).toBe('That connection is not allowed here.');
  });

  it('messages do not contain raw machine reason strings', () => {
    const reasons = [
      'Cannot connect node to itself',
      'Connection already exists',
      'Cannot connect input to input',
      'Cannot connect output to output',
    ];
    for (const reason of reasons) {
      const msg = connectionRejectedMessage(reason);
      // Should not expose the raw technical reason verbatim
      expect(msg).not.toBe(reason);
      // Should end with a period (complete sentence)
      expect(msg.endsWith('.')).toBe(true);
    }
  });
});
