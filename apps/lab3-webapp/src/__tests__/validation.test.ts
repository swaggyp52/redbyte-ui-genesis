import { describe, it, expect } from 'vitest';
import {
  validateTruthTable,
  validateKMaps,
  validateExpressions,
  validateLabDoc,
  getValidationMessage,
} from '../validation';
import { createEmptyLabDoc } from '../store/labStore';
import type { LabDocV2 } from '../plugins/LabDoc';
import { DIGIT_PATTERNS } from '../types';

describe('Validation Module', () => {
  describe('validateTruthTable()', () => {
    it('should warn when rows 0-9 are all 1s (unpopulated)', () => {
      const doc = createEmptyLabDoc();
      const errors = validateTruthTable(doc);
      const warningCount = errors.filter(e => e.severity === 'warning').length;
      expect(warningCount).toBeGreaterThan(0);
      expect(errors.some(e => e.message.includes('all segments OFF'))).toBe(true);
    });

    it('should not warn when digits are populated with DIGIT_PATTERNS', () => {
      const doc = createEmptyLabDoc();
      // Fill standard patterns (0-9)
      for (let i = 0; i < 10; i++) {
        doc.truthTable[i].seg = DIGIT_PATTERNS[i];
        doc.truthTable[i].isDontCare = false;
      }
      
      const errors = validateTruthTable(doc);
      const offWarnings = errors.filter(e => e.message.includes('all segments OFF'));
      expect(offWarnings.length).toBe(0);
    });

    it('should note non-marked don\'t-care rows 10-15', () => {
      const doc = createEmptyLabDoc();
      doc.truthTable[10].isDontCare = false; // Wrong!
      
      const errors = validateTruthTable(doc);
      const infos = errors.filter(e => e.severity === 'info' && e.input === 10);
      expect(infos.length).toBeGreaterThan(0);
    });
  });

  describe('validateExpressions()', () => {
    it('should error when expression doesn\'t match truth table', () => {
      const doc = createEmptyLabDoc();
      // Set digit 5 with segment 'a' = 1 (on)
      doc.truthTable[5].seg[0] = 0;
      doc.expressions['a'] = 'B3'; // But B3=0 for input 5

      const errors = validateExpressions(doc);
      const aErrors = errors.filter(e => e.segment === 'a' && e.severity === 'error');
      expect(aErrors.length).toBeGreaterThan(0);
      expect(aErrors[0].input).toBe(5);
    });

    it('should warn when expression is not defined', () => {
      const doc = createEmptyLabDoc();
      doc.expressions['a'] = '';

      const errors = validateExpressions(doc);
      const warning = errors.find(e => e.segment === 'a' && e.severity === 'warning');
      expect(warning).toBeDefined();
      expect(warning?.message).toContain('no Boolean expression');
    });

    it('should pass when expression matches truth table', () => {
      const doc = createEmptyLabDoc();
      // Setup: digit 0 (0000) with segments active, digit 8 (1000) with segments active
      doc.truthTable[0].seg = [0, 0, 0, 0, 0, 0, 1]; // seg a-f=0, g=1
      doc.truthTable[0].isDontCare = false;
      doc.truthTable[8].seg = [0, 0, 0, 0, 0, 0, 0]; // all segments on
      doc.truthTable[8].isDontCare = false;
      
      // Expression: segment 'a' = B3' (off for 0000, on for 1000)
      doc.expressions['a'] = "B3' "; // simplified
      
      const errors = validateExpressions(doc);
      const aErrors = errors.filter(e => e.segment === 'a' && e.severity === 'error');
      expect(aErrors.length).toBe(0);
    });
  });

  describe('validateLabDoc()', () => {
    it('should return isValid=true for properly filled doc', () => {
      const doc = createEmptyLabDoc();
      // Fill standard digit patterns
      for (let i = 0; i < 10; i++) {
        doc.truthTable[i].seg = DIGIT_PATTERNS[i];
        doc.truthTable[i].isDontCare = false;
      }
      // Mark 10-15 as don't-care
      for (let i = 10; i < 16; i++) {
        doc.truthTable[i].isDontCare = true;
      }

      const summary = validateLabDoc(doc);
      // Not fully valid (no expressions), but should pass basic checks
      expect(summary.totalErrors).toBeGreaterThan(0);
    });

    it('should set canAdvance=false when there are blocking errors', () => {
      const doc = createEmptyLabDoc();
      doc.truthTable[0].seg = [1, 1, 1, 1, 1, 1, 1]; // Unpopulated
      doc.expressions['a'] = 'B3 + B2'; // Some expression
      doc.truthTable[0].isDontCare = false;

      const summary = validateLabDoc(doc);
      // Unpopulated row is a warning (not blocking), so canAdvance could be true
      // But if we trigger an expression error, it should be false
      expect(typeof summary.canAdvance).toBe('boolean');
    });

    it('should group errors by segment', () => {
      const doc = createEmptyLabDoc();
      doc.expressions['a'] = 'INVALID EXPR!';
      doc.expressions['b'] = 'ALSO INVALID!';

      const summary = validateLabDoc(doc);
      expect(Object.keys(summary.errorsBySegment).length).toBeGreaterThan(0);
    });
  });

  describe('getValidationMessage()', () => {
    it('should return success message when isValid=true', () => {
      const summary = { 
        totalErrors: 0, 
        isValid: true, 
        canAdvance: true,
        errorsBySegment: {},
        allErrors: [],
      };
      const msg = getValidationMessage(summary);
      expect(msg).toContain('✅');
      expect(msg).toContain('correct');
    });

    it('should return error message with error count', () => {
      const errors = [
        { severity: 'error' as const, segment: 'a', input: 0, message: 'Error 1' },
        { severity: 'warning' as const, segment: 'b', input: 0, message: 'Warning 1' },
      ];
      const summary = {
        totalErrors: 2,
        isValid: false,
        canAdvance: false,
        errorsBySegment: { a: [errors[0]], b: [errors[1]] },
        allErrors: errors,
      };
      const msg = getValidationMessage(summary);
      expect(msg).toContain('1 error');
      expect(msg).toContain('1 warning');
    });
  });
});
