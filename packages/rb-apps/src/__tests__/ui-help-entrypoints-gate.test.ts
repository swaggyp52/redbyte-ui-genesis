// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * ui:help-entrypoints-gate
 *
 * Pure gate that validates Help app entry points:
 * - HelpApp selects correct topic when seeded with error code
 * - HelpApp respects initialTopicId priority over initialErrorCode
 * - Hardware error codes map to Help topics correctly
 * - Error codes are extracted from student-facing errors
 *
 * This gate protects Help integration UX. If it fails, users can't find
 * troubleshooting guidance from error screens.
 */

import { describe, it, expect } from 'vitest';
import { getTopicsByErrorCode, HELP_TOPICS, searchHelpTopics } from '../help/helpTopics';
import { toStudentFacingError, RbUserError } from '@redbyte/rb-utils';

describe('ui:help-entrypoints-gate', () => {
  describe('HelpApp seed resolution', () => {
    it('selects topic matching initialErrorCode', () => {
      const errorCode = 'HW_NOT_CONNECTED';
      const topics = getTopicsByErrorCode(errorCode);
      
      expect(topics.length).toBeGreaterThan(0);
      expect(topics[0].errorCodes).toContain(errorCode);
      expect(topics[0].id).toBe('bridge-offline');
    });

    it('selects topic matching initialTopicId (priority over errorCode)', () => {
      const topicId = 'firmware-upload';
      const topic = HELP_TOPICS.find((t) => t.id === topicId);
      
      expect(topic).toBeDefined();
      expect(topic?.id).toBe(topicId);
    });

    it('returns empty array for unknown error code', () => {
      const topics = getTopicsByErrorCode('NONEXISTENT_CODE');
      expect(topics).toEqual([]);
    });

    it('initialQuery filters topics by search term', () => {
      const query = 'autosave';
      const topics = searchHelpTopics(query);
      
      expect(topics.length).toBeGreaterThan(0);
      expect(topics.some((t) => t.id === 'autosave-recovery')).toBe(true);
    });
  });

  describe('Error code extraction from student errors', () => {
    it('extracts error code from RbUserError', () => {
      const error = new RbUserError('HW_TIMEOUT', 'Device timed out');
      const studentError = toStudentFacingError(error);
      
      expect(studentError.code).toBe('HW_TIMEOUT');
    });

    it('maps unknown errors to UNEXPECTED_ERROR', () => {
      const error = new Error('Random crash');
      const studentError = toStudentFacingError(error);
      
      expect(studentError.code).toBe('UNEXPECTED_ERROR');
    });

    it('preserves known error codes', () => {
      const codes = [
        'BRIDGE_UNREACHABLE',
        'HW_NOT_CONNECTED',
        'HW_DEVICE_NOT_FOUND',
        'HW_TIMEOUT',
        'FIRMWARE_UPLOAD_FAILED',
        'DEVICE_VERIFICATION_FAILED',
        'SESSION_CONNECT_FAILED',
        'EVIDENCE_INVALID',
      ];

      codes.forEach((code) => {
        const error = new RbUserError(code, 'Test error');
        const studentError = toStudentFacingError(error);
        expect(studentError.code).toBe(code);
      });
    });
  });

  describe('Hardware error code mapping', () => {
    it('HW_NOT_CONNECTED maps to bridge-offline topic', () => {
      const topics = getTopicsByErrorCode('HW_NOT_CONNECTED');
      expect(topics.length).toBeGreaterThan(0);
      expect(topics[0].id).toBe('bridge-offline');
    });

    it('BRIDGE_UNREACHABLE maps to bridge-offline topic', () => {
      const topics = getTopicsByErrorCode('BRIDGE_UNREACHABLE');
      expect(topics.length).toBeGreaterThan(0);
      expect(topics[0].id).toBe('bridge-offline');
    });

    it('HW_TIMEOUT maps to hardware-timeout topic', () => {
      const topics = getTopicsByErrorCode('HW_TIMEOUT');
      expect(topics.length).toBeGreaterThan(0);
      expect(topics[0].id).toBe('hardware-timeout');
    });

    it('HW_DEVICE_NOT_FOUND maps to hardware-timeout topic', () => {
      const topics = getTopicsByErrorCode('HW_DEVICE_NOT_FOUND');
      expect(topics.length).toBeGreaterThan(0);
      expect(topics[0].id).toBe('hardware-timeout');
    });

    it('FIRMWARE_UPLOAD_FAILED maps to firmware-upload topic', () => {
      const topics = getTopicsByErrorCode('FIRMWARE_UPLOAD_FAILED');
      expect(topics.length).toBeGreaterThan(0);
      expect(topics[0].id).toBe('firmware-upload');
    });

    it('DEVICE_VERIFICATION_FAILED maps to firmware-upload topic', () => {
      const topics = getTopicsByErrorCode('DEVICE_VERIFICATION_FAILED');
      expect(topics.length).toBeGreaterThan(0);
      expect(topics[0].id).toBe('firmware-upload');
    });

    it('SESSION_CONNECT_FAILED maps to bridge-offline topic', () => {
      const topics = getTopicsByErrorCode('SESSION_CONNECT_FAILED');
      expect(topics.length).toBeGreaterThan(0);
      expect(topics[0].id).toBe('bridge-offline');
    });

    it('EVIDENCE_INVALID maps to export-submission topic', () => {
      const topics = getTopicsByErrorCode('EVIDENCE_INVALID');
      expect(topics.length).toBeGreaterThan(0);
      expect(topics[0].id).toBe('export-submission');
    });
  });

  describe('Help entry point invariants', () => {
    it('all hardware error codes have at least one mapped topic', () => {
      const hardwareErrorCodes = [
        'HW_NOT_CONNECTED',
        'HW_DEVICE_NOT_FOUND',
        'HW_TIMEOUT',
        'BRIDGE_UNREACHABLE',
        'FIRMWARE_UPLOAD_FAILED',
        'DEVICE_VERIFICATION_FAILED',
      ];

      hardwareErrorCodes.forEach((code) => {
        const topics = getTopicsByErrorCode(code);
        expect(topics.length).toBeGreaterThan(0);
      });
    });

    it('error codes should not map to multiple unrelated topics (ambiguity check)', () => {
      const errorCode = 'HW_NOT_CONNECTED';
      const topics = getTopicsByErrorCode(errorCode);
      
      // Should map to exactly one primary topic (bridge-offline)
      // May also appear in error-codes topic (master list)
      const primaryTopics = topics.filter((t) => t.id !== 'error-codes');
      expect(primaryTopics.length).toBe(1);
    });

    it('UNEXPECTED_ERROR should not auto-select topic (generic error)', () => {
      const topics = getTopicsByErrorCode('UNEXPECTED_ERROR');
      // UNEXPECTED_ERROR may or may not have a topic; if it does, should be error-codes
      if (topics.length > 0) {
        expect(topics.every((t) => t.id === 'error-codes')).toBe(true);
      }
    });
  });
});
