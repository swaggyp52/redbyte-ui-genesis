// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

/**
 * ui:help-topics-contract-gate
 *
 * Pure gate that validates help topics data structure:
 * - Every topic has required fields (id, title, steps)
 * - Each topic has 2-8 actionable steps
 * - All referenced error codes are well-formed strings
 * - No duplicate topic IDs
 *
 * This gate protects the Help app contract. If it fails, Help app UI is broken.
 */

import { describe, it, expect } from 'vitest';
import { HELP_TOPICS, getAllReferencedErrorCodes } from '../help/helpTopics';

describe('ui:help-topics-contract-gate', () => {
  it('all topics have required structure (id, title, steps)', () => {
    HELP_TOPICS.forEach((topic) => {
      expect(topic).toHaveProperty('id');
      expect(topic).toHaveProperty('title');
      expect(topic).toHaveProperty('steps');
      expect(typeof topic.id).toBe('string');
      expect(typeof topic.title).toBe('string');
      expect(Array.isArray(topic.steps)).toBe(true);
    });
  });

  it('every topic has 2-8 actionable steps', () => {
    HELP_TOPICS.forEach((topic) => {
      expect(topic.steps.length).toBeGreaterThanOrEqual(2);
      expect(topic.steps.length).toBeLessThanOrEqual(8);
    });
  });

  it('all steps are non-empty strings', () => {
    HELP_TOPICS.forEach((topic) => {
      topic.steps.forEach((step, idx) => {
        expect(typeof step).toBe('string');
        expect(step.trim().length).toBeGreaterThan(0);
      });
    });
  });

  it('all referenced error codes are well-formed strings (UPPER_SNAKE_CASE)', () => {
    const referencedCodes = getAllReferencedErrorCodes();
    referencedCodes.forEach((code) => {
      expect(typeof code).toBe('string');
      expect(code).toMatch(/^[A-Z_]+$/); // Must be UPPER_SNAKE_CASE
      expect(code.length).toBeGreaterThan(0);
    });
  });

  it('no duplicate topic IDs', () => {
    const ids = HELP_TOPICS.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all topic IDs are kebab-case', () => {
    HELP_TOPICS.forEach((topic) => {
      expect(topic.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    });
  });

  it('all topic titles are descriptive (not empty)', () => {
    HELP_TOPICS.forEach((topic) => {
      expect(topic.title.trim().length).toBeGreaterThan(0);
    });
  });

  it('errorCodes field is optional and array if present', () => {
    HELP_TOPICS.forEach((topic) => {
      if (topic.errorCodes) {
        expect(Array.isArray(topic.errorCodes)).toBe(true);
        topic.errorCodes.forEach((code) => {
          expect(typeof code).toBe('string');
        });
      }
    });
  });

  it('at least one topic exists', () => {
    expect(HELP_TOPICS.length).toBeGreaterThan(0);
  });
});
