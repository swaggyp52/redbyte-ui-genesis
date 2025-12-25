// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect, beforeEach } from 'vitest';
import { useChipStore } from '../stores/chipStore';
import { suggestChipPorts, validateChipPorts, generateUniqueChipName } from '../utils/chipUtils';
import type { Circuit } from '@redbyte/rb-logic-core';
import type { RecognizedPattern } from '../patterns/patternMatcher';

describe('Chip System', () => {
  beforeEach(() => {
    // Reset chip store before each test
    useChipStore.getState().resetAll();
  });

  describe('Chip Store', () => {
    it('should save a chip from pattern', () => {
      const { saveChipFromPattern, getAllChips } = useChipStore.getState();

      const pattern: RecognizedPattern = {
        name: 'XOR Gate',
        description: 'Exclusive OR gate',
        layer: 1,
        confidence: 0.95,
      };

      const circuit: Circuit = {
        nodes: [
          { id: 'input-a', type: 'INPUT', position: { x: 0, y: 0 }, rotation: 0, config: {} },
          { id: 'input-b', type: 'INPUT', position: { x: 0, y: 50 }, rotation: 0, config: {} },
          { id: 'nand1', type: 'NAND', position: { x: 100, y: 25 }, rotation: 0, config: {} },
          { id: 'output', type: 'OUTPUT', position: { x: 200, y: 25 }, rotation: 0, config: {} },
        ],
        connections: [
          { from: { nodeId: 'input-a', portName: 'out' }, to: { nodeId: 'nand1', portName: 'in1' } },
          { from: { nodeId: 'input-b', portName: 'out' }, to: { nodeId: 'nand1', portName: 'in2' } },
          { from: { nodeId: 'nand1', portName: 'out' }, to: { nodeId: 'output', portName: 'in' } },
        ],
      };

      const inputs = [
        { id: 'input-0', name: 'A', type: 'input' as const, nodeRef: 'input-a.out' },
        { id: 'input-1', name: 'B', type: 'input' as const, nodeRef: 'input-b.out' },
      ];

      const outputs = [
        { id: 'output-0', name: 'OUT', type: 'output' as const, nodeRef: 'output.in' },
      ];

      const chip = saveChipFromPattern(pattern, circuit, inputs, outputs);

      expect(chip).toBeDefined();
      expect(chip.name).toBe('XOR Gate');
      expect(chip.layer).toBe(1);
      expect(chip.inputs).toHaveLength(2);
      expect(chip.outputs).toHaveLength(1);

      const allChips = getAllChips();
      expect(allChips).toHaveLength(1);
      expect(allChips[0].id).toBe(chip.id);
    });

    it('should get chips by layer', () => {
      const { saveChipFromPattern, getChipsByLayer } = useChipStore.getState();

      const pattern1: RecognizedPattern = {
        name: 'Half Adder',
        description: 'Adds two bits',
        layer: 1,
        confidence: 0.9,
      };

      const pattern2: RecognizedPattern = {
        name: 'Full Adder',
        description: 'Adds three bits',
        layer: 2,
        confidence: 0.9,
      };

      const dummyCircuit: Circuit = {
        nodes: [],
        connections: [],
      };

      saveChipFromPattern(pattern1, dummyCircuit, [], []);
      saveChipFromPattern(pattern2, dummyCircuit, [], []);

      const layer1Chips = getChipsByLayer(1);
      const layer2Chips = getChipsByLayer(2);

      expect(layer1Chips).toHaveLength(1);
      expect(layer2Chips).toHaveLength(1);
      expect(layer1Chips[0].name).toBe('Half Adder');
      expect(layer2Chips[0].name).toBe('Full Adder');
    });

    it('should delete a chip', () => {
      const { saveChipFromPattern, deleteChip, getAllChips } = useChipStore.getState();

      const pattern: RecognizedPattern = {
        name: 'Test Chip',
        description: 'Test',
        layer: 1,
        confidence: 0.9,
      };

      const dummyCircuit: Circuit = {
        nodes: [],
        connections: [],
      };

      const chip = saveChipFromPattern(pattern, dummyCircuit, [], []);
      expect(getAllChips()).toHaveLength(1);

      deleteChip(chip.id);
      expect(getAllChips()).toHaveLength(0);
    });
  });

  describe('Chip Port Utilities', () => {
    it('should suggest ports from INPUT and OUTPUT nodes', () => {
      const circuit: Circuit = {
        nodes: [
          { id: 'input-a', type: 'INPUT', position: { x: 0, y: 0 }, rotation: 0, config: {} },
          { id: 'input-b', type: 'INPUT', position: { x: 0, y: 50 }, rotation: 0, config: {} },
          { id: 'output-sum', type: 'OUTPUT', position: { x: 200, y: 0 }, rotation: 0, config: {} },
          { id: 'output-carry', type: 'OUTPUT', position: { x: 200, y: 50 }, rotation: 0, config: {} },
        ],
        connections: [],
      };

      const { inputs, outputs } = suggestChipPorts(circuit);

      expect(inputs).toHaveLength(2);
      expect(outputs).toHaveLength(2);
      expect(inputs[0].name).toBe('A');
      expect(inputs[1].name).toBe('B');
      expect(outputs[0].name).toBe('SUM');
      expect(outputs[1].name).toBe('CARRY');
    });

    it('should validate chip ports reference valid nodes', () => {
      const circuit: Circuit = {
        nodes: [
          { id: 'input-a', type: 'INPUT', position: { x: 0, y: 0 }, rotation: 0, config: {} },
          { id: 'output', type: 'OUTPUT', position: { x: 200, y: 0 }, rotation: 0, config: {} },
        ],
        connections: [],
      };

      const validInputs = [
        { id: 'input-0', name: 'A', type: 'input' as const, nodeRef: 'input-a.out' },
      ];

      const validOutputs = [
        { id: 'output-0', name: 'OUT', type: 'output' as const, nodeRef: 'output.in' },
      ];

      const invalidInputs = [
        { id: 'input-0', name: 'A', type: 'input' as const, nodeRef: 'nonexistent.out' },
      ];

      const validResult = validateChipPorts(circuit, validInputs, validOutputs);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      const invalidResult = validateChipPorts(circuit, invalidInputs, validOutputs);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    it('should detect duplicate port names', () => {
      const circuit: Circuit = {
        nodes: [
          { id: 'input-a', type: 'INPUT', position: { x: 0, y: 0 }, rotation: 0, config: {} },
          { id: 'output', type: 'OUTPUT', position: { x: 200, y: 0 }, rotation: 0, config: {} },
        ],
        connections: [],
      };

      const duplicateInputs = [
        { id: 'input-0', name: 'A', type: 'input' as const, nodeRef: 'input-a.out' },
        { id: 'input-1', name: 'A', type: 'input' as const, nodeRef: 'input-a.out' },
      ];

      const validOutputs = [
        { id: 'output-0', name: 'OUT', type: 'output' as const, nodeRef: 'output.in' },
      ];

      const result = validateChipPorts(circuit, duplicateInputs, validOutputs);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate'))).toBe(true);
    });

    it('should generate unique chip names', () => {
      const existingNames = ['XOR Gate', 'XOR Gate 2'];

      const name1 = generateUniqueChipName('XOR Gate', existingNames);
      expect(name1).toBe('XOR Gate 3');

      const name2 = generateUniqueChipName('Half Adder', existingNames);
      expect(name2).toBe('Half Adder');

      const name3 = generateUniqueChipName('XOR Gate', [...existingNames, 'XOR Gate 3']);
      expect(name3).toBe('XOR Gate 4');
    });
  });

  describe('Chip Persistence', () => {
    it('should export and import chips', () => {
      const { saveChipFromPattern, exportJson, importJson, getAllChips, resetAll } = useChipStore.getState();

      const pattern: RecognizedPattern = {
        name: 'Test Chip',
        description: 'Test',
        layer: 1,
        confidence: 0.9,
      };

      const dummyCircuit: Circuit = {
        nodes: [],
        connections: [],
      };

      saveChipFromPattern(pattern, dummyCircuit, [], []);

      const exported = exportJson();
      expect(exported).toBeTruthy();

      // Reset and import
      resetAll();
      expect(getAllChips()).toHaveLength(0);

      importJson(exported);
      expect(getAllChips()).toHaveLength(1);
      expect(getAllChips()[0].name).toBe('Test Chip');
    });
  });
});
