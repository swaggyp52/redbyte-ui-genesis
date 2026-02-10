import type { LabDocV2 } from '../plugins/LabDoc';
import type { KMapState, TruthTableRow as StrictRow } from '../types';
import { generateKMapGrid, minimizeBooleanExpr, evaluateBoolExpr } from '../kmap';

const SEGMENT_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;

/**
 * Recompute all derived data from a LabDocV2's truthTable.
 *
 * Pure function. Same input → same output. Called from updateDoc() only.
 * Returns a partial LabDocV2 patch: { kMaps, expressions, results }.
 */
export function recomputeDerived(doc: LabDocV2): Pick<LabDocV2, 'kMaps' | 'expressions' | 'results'> {
  const kMaps: KMapState = {};
  const expressions: Record<string, string> = {};
  const validationErrors: Record<string, string[]> = {};

  for (let i = 0; i < SEGMENT_NAMES.length; i++) {
    const segName = SEGMENT_NAMES[i];
    // Cast: LabDoc.TruthTableRow uses `number`, kmap.ts expects `0|1`. Values are always 0|1 at runtime.
    const grid = generateKMapGrid(doc.truthTable as unknown as StrictRow[], i as 0 | 1 | 2 | 3 | 4 | 5 | 6);
    const simplifiedExpr = minimizeBooleanExpr(grid);
    const minTerms = grid
      .map((val, idx) => (val === 1 ? idx : -1))
      .filter((idx) => idx >= 0);

    kMaps[segName] = { grid, groups: [], simplifiedExpr, minTerms };
    expressions[segName] = simplifiedExpr;
  }

  // Validate: do expressions agree with truth table for inputs 0-9?
  for (let segIdx = 0; segIdx < SEGMENT_NAMES.length; segIdx++) {
    const segName = SEGMENT_NAMES[segIdx];
    const expr = expressions[segName];
    const errors: string[] = [];

    for (let input = 0; input < 10; input++) {
      const row = doc.truthTable[input];
      if (!row || row.isDontCare) continue;
      const tableValue = row.seg[segIdx];
      const exprValue = evaluateBoolExpr(expr, input) ? 1 : 0;
      if (tableValue !== exprValue) {
        errors.push(`Input ${input}: table=${tableValue}, expr=${exprValue}`);
      }
    }
    if (errors.length > 0) validationErrors[segName] = errors;
  }

  return {
    kMaps,
    expressions,
    results: { validationErrors },
  };
}
