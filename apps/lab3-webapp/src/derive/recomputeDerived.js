import { generateKMapGrid, minimizeBooleanExpr, evaluateBoolExpr } from '../kmap';
import { validateLabDoc, getValidationMessage } from '../validation';
const SEGMENT_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
/**
 * Recompute all derived data from a LabDocV2's truthTable.
 *
 * Pure function. Same input → same output. Called from updateDoc() only.
 * Returns a partial LabDocV2 patch: { kMaps, expressions, results }.
 *
 * Also runs comprehensive validation and stores results.
 */
export function recomputeDerived(doc) {
    const kMaps = {};
    const expressions = {};
    const validationErrors = {};
    for (let i = 0; i < SEGMENT_NAMES.length; i++) {
        const segName = SEGMENT_NAMES[i];
        // Cast: LabDoc.TruthTableRow uses `number`, kmap.ts expects `0|1`. Values are always 0|1 at runtime.
        const grid = generateKMapGrid(doc.truthTable, i);
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
        const errors = [];
        for (let input = 0; input < 10; input++) {
            const row = doc.truthTable[input];
            if (!row || row.isDontCare)
                continue;
            const tableValue = row.seg[segIdx];
            const exprValue = evaluateBoolExpr(expr, input) ? 1 : 0;
            if (tableValue !== exprValue) {
                errors.push(`Input ${input}: table=${tableValue}, expr=${exprValue}`);
            }
        }
        if (errors.length > 0)
            validationErrors[segName] = errors;
    }
    // Run comprehensive validation
    const validation = validateLabDoc({
        ...doc,
        kMaps,
        expressions,
        results: { validationErrors },
    });
    const validationMessage = getValidationMessage(validation);
    return {
        kMaps,
        expressions,
        results: {
            validationErrors,
            validation: {
                allErrors: validation.allErrors,
                canAdvance: validation.canAdvance,
                message: validationMessage,
            },
        },
    };
}
