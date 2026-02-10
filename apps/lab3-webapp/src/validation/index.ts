/**
 * Enhanced Validation Module
 * Comprehensive validation for truth table → K-map → expressions consistency
 * Provides detailed, actionable error messages for students
 */

import { evaluateBoolExpr } from '../kmap';
import type { LabDocV2, TruthTableRow } from '../plugins/LabDoc';

export interface ValidationError {
  severity: 'error' | 'warning' | 'info';
  segment: string;
  input: number;
  message: string;
  guidance?: string; // Helpful hint
}

export interface ValidationSummary {
  totalErrors: number;
  isValid: boolean;
  canAdvance: boolean; // True if no blockers
  errorsBySegment: Record<string, ValidationError[]>;
  allErrors: ValidationError[];
}

const SEGMENT_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;
const DIGIT_NAMES: Record<number, string> = {
  0: 'Zero', 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four',
  5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine',
  10: 'Don\'t-Care', 11: 'Don\'t-Care', 12: 'Don\'t-Care',
  13: 'Don\'t-Care', 14: 'Don\'t-Care', 15: 'Don\'t-Care',
};

/**
 * Validate that Boolean expressions match the truth table
 * Returns detailed errors for any mismatches
 */
export function validateExpressions(doc: LabDocV2): ValidationError[] {
  const errors: ValidationError[] = [];

  for (let segIdx = 0; segIdx < SEGMENT_NAMES.length; segIdx++) {
    const segName = SEGMENT_NAMES[segIdx];
    const expr = doc.expressions[segName];

    // If no expression defined, that's a warning (not critical)
    if (!expr || expr.trim() === '') {
      errors.push({
        severity: 'warning',
        segment: segName,
        input: -1,
        message: `Segment '${segName}' has no Boolean expression defined`,
        guidance: 'Create a K-map grouping for this segment and generate an expression',
      });
      continue;
    }

    // Check expression against truth table (rows 0-9 only, ignore don't-care)
    for (let input = 0; input < 10; input++) {
      const row = doc.truthTable[input];
      if (!row || row.isDontCare) continue;

      const tableValue = row.seg[segIdx];
      let exprValue: boolean;
      try {
        exprValue = evaluateBoolExpr(expr, input);
      } catch (e) {
        errors.push({
          severity: 'error',
          segment: segName,
          input,
          message: `Expression '${expr}' invalid: ${(e as any).message}`,
          guidance: 'Check for typos, missing operators (+, ·, \'), or unmatched parentheses',
        });
        break;
      }

      const exprBit = exprValue ? 1 : 0;
      if (tableValue !== exprBit) {
        const digitName = DIGIT_NAMES[input];
        errors.push({
          severity: 'error',
          segment: segName,
          input,
          message: `Segment '${segName}' mismatch at input ${input} (${digitName}): table=${tableValue}, expr=${exprBit}`,
          guidance: `For digit ${digitName}, the truth table shows segment '${segName}' = ${tableValue}, but your expression evaluates to ${exprBit}. Review your K-map grouping.`,
        });
      }
    }
  }

  return errors;
}

/**
 * Validate truth table completeness
 * Ensures digits 0-9 are fully defined
 */
export function validateTruthTable(doc: LabDocV2): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check that 0-9 are not all 1s (default value)
  for (let input = 0; input < 10; input++) {
    const row = doc.truthTable[input];
    if (!row) {
      errors.push({
        severity: 'error',
        segment: '',
        input,
        message: `Truth table row ${input} missing`,
        guidance: 'Click "Auto-Fill" to populate standard digit patterns, or manually set segment values',
      });
      continue;
    }

    const allOnes = row.seg.every(s => s === 1);
    if (allOnes) {
      errors.push({
        severity: 'warning',
        segment: '',
        input,
        message: `Row ${input} (${DIGIT_NAMES[input]}) has all segments OFF (value 1). Is this intentional?`,
        guidance: 'If you meant to fill in digit patterns, click "Auto-Fill" to get started',
      });
    }
  }

  // Check don't-care rows (10-15) are explicitly marked
  for (let input = 10; input < 16; input++) {
    const row = doc.truthTable[input];
    if (!row?.isDontCare) {
      errors.push({
        severity: 'info',
        segment: '',
        input,
        message: `Row ${input} is not marked as "Don't-Care"`,
        guidance: 'Toggle "Don\'t-Care" for rows 10-15 if not used',
      });
    }
  }

  return errors;
}

/**
 * Validate K-maps have meaningful groupings
 */
export function validateKMaps(doc: LabDocV2): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const segName of SEGMENT_NAMES) {
    const kmap = doc.kMaps[segName] as any;
    if (!kmap) {
      errors.push({
        severity: 'warning',
        segment: segName,
        input: -1,
        message: `K-map for segment '${segName}' not initialized`,
      });
      continue;
    }

    // Warning if minTerms exist but no groups are defined
    if (kmap.minTerms && Array.isArray(kmap.minTerms) && kmap.minTerms.length > 0 && 
        kmap.groups && Array.isArray(kmap.groups) && kmap.groups.length === 0) {
      errors.push({
        severity: 'info',
        segment: segName,
        input: -1,
        message: `Segment '${segName}' has minterms but no groupings yet`,
        guidance: 'Click on K-map cells to form rectangular groups for simplification',
      });
    }
  }

  return errors;
}

/**
 * Run full validation suite
 */
export function validateLabDoc(doc: LabDocV2): ValidationSummary {
  const errorArrays = [
    validateTruthTable(doc),
    validateKMaps(doc),
    validateExpressions(doc),
  ];

  const allErrors = errorArrays.flat();
  const errorsBySegment: Record<string, ValidationError[]> = {};

  for (const err of allErrors) {
    if (!errorsBySegment[err.segment]) {
      errorsBySegment[err.segment] = [];
    }
    errorsBySegment[err.segment].push(err);
  }

  const hasBlockingErrors = allErrors.some(e => e.severity === 'error');
  const canAdvance = !hasBlockingErrors; // Can only advance if no errors (warnings/info okay)

  return {
    totalErrors: allErrors.length,
    isValid: allErrors.length === 0,
    canAdvance,
    errorsBySegment,
    allErrors,
  };
}

/**
 * Get user-friendly summary of validation status
 */
export function getValidationMessage(summary: ValidationSummary): string {
  if (summary.isValid) {
    return '✅ All validations passed! Your lab is correct.';
  }

  const errorCount = summary.allErrors.filter(e => e.severity === 'error').length;
  const warningCount = summary.allErrors.filter(e => e.severity === 'warning').length;

  if (errorCount > 0 && warningCount > 0) {
    return `⚠️ ${errorCount} error(s), ${warningCount} warning(s) — fix errors before advancing`;
  } else if (errorCount > 0) {
    return `❌ ${errorCount} error(s) found — review and fix before advancing`;
  } else {
    return `⚠️ ${warningCount} warning(s) — lab will work, but review suggestions`;
  }
}
