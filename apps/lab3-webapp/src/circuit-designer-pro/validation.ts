import { CircuitDesignerDoc, LabDocV2 } from '../plugins/LabDoc';
import { evaluateCircuit, setNodeValue } from './engine';

/**
 * Result of circuit validation against truth table
 */
export interface ValidationResult {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  failures?: Array<{
    inputRow: number;
    inputs: { b3: number; b2: number; b1: number; b0: number };
    expectedOutputs: number[];
    actualOutputs: number[];
  }>;
}

/**
 * Validate circuit against truth table
 * For each truth table row, sets INPUT node values and evaluates OUTPUT nodes
 * Compares actual outputs (seg[a..g]) with expected values
 */
export function validateCircuitAgainstTruthTable(
  circuit: CircuitDesignerDoc,
  doc: LabDocV2
): ValidationResult {
  const result: ValidationResult = {
    passed: true,
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    failures: [],
  };

  if (!doc.truthTable || doc.truthTable.length === 0) {
    return {
      ...result,
      totalTests: 0,
      passedTests: 0,
    };
  }

  // Find all INPUT and OUTPUT nodes
  const inputNodes = circuit.nodes.filter(n => n.type === 'INPUT');
  const outputNodes = circuit.nodes.filter(n => n.type === 'OUTPUT');

  if (inputNodes.length === 0 || outputNodes.length === 0) {
    return {
      ...result,
      passed: false,
      failedTests: doc.truthTable.length,
      failures: doc.truthTable.map((row, idx) => ({
        inputRow: idx,
        inputs: { b3: row.b3, b2: row.b2, b1: row.b1, b0: row.b0 },
        expectedOutputs: row.seg,
        actualOutputs: [],
      })),
    };
  }

  // For each truth table row
  doc.truthTable.forEach((row, rowIdx) => {
    result.totalTests++;

    // Set INPUT node values from truth table row
    let circuitWithInputs = circuit;
    const inputValues = [row.b3, row.b2, row.b1, row.b0];
    
    inputNodes.forEach((inputNode, inputIdx) => {
      if (inputIdx < inputValues.length) {
        const value = inputValues[inputIdx] === 1;
        circuitWithInputs = setNodeValue(circuitWithInputs, inputNode.id, value);
      }
    });

    // Evaluate circuit
    const evaluation = evaluateCircuit(circuitWithInputs);

    // Get OUTPUT node values (should be 7 outputs for 7-segment: a..g)
    const actualOutputs = outputNodes.map(outNode => {
      const value = evaluation.get(outNode.id) ?? false;
      return value ? 1 : 0;
    });

    // Compare with truth table segment values
    const expectedOutputs = row.seg.slice(0, actualOutputs.length);

    const match = JSON.stringify(actualOutputs) === JSON.stringify(expectedOutputs);

    if (match) {
      result.passedTests++;
    } else {
      result.passed = false;
      result.failedTests++;
      result.failures?.push({
        inputRow: rowIdx,
        inputs: { b3: row.b3, b2: row.b2, b1: row.b1, b0: row.b0 },
        expectedOutputs,
        actualOutputs,
      });
    }
  });

  return result;
}
