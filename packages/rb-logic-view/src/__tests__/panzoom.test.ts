// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import { snapToGrid, calculateFitToView } from '../tools/panzoom';

describe('Pan/Zoom Tools', () => {
  describe('snapToGrid', () => {
    it('should snap positions to grid when enabled', () => {
      // Test snapping to 20px grid (using Math.round)
      expect(snapToGrid(0, 20)).toBe(0);
      expect(snapToGrid(10, 20)).toBe(20); // Rounds to nearest
      expect(snapToGrid(9, 20)).toBe(0);
      expect(snapToGrid(11, 20)).toBe(20);
      expect(snapToGrid(25, 20)).toBe(20);
      expect(snapToGrid(35, 20)).toBe(40);
      expect(snapToGrid(-10, 20)).toBe(-0); // Math.round(-0.5) = -0
      expect(snapToGrid(-11, 20)).toBe(-20);
    });

    it('should handle different grid sizes', () => {
      // Test 10px grid
      expect(snapToGrid(0, 10)).toBe(0);
      expect(snapToGrid(5, 10)).toBe(10);
      expect(snapToGrid(14, 10)).toBe(10);
      expect(snapToGrid(15, 10)).toBe(20);

      // Test 50px grid
      expect(snapToGrid(24, 50)).toBe(0);
      expect(snapToGrid(25, 50)).toBe(50);
      expect(snapToGrid(74, 50)).toBe(50);
      expect(snapToGrid(75, 50)).toBe(100);
    });

    it('should handle negative coordinates', () => {
      expect(snapToGrid(-15, 20)).toBe(-20);
      expect(snapToGrid(-25, 20)).toBe(-20);
      expect(snapToGrid(-35, 20)).toBe(-40);
    });
  });

  describe('calculateFitToView', () => {
    it('should return default camera for empty node list', () => {
      const camera = calculateFitToView([], 800, 600);
      expect(camera).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it('should calculate camera to fit all nodes within bounds', () => {
      const nodes = [
        { position: { x: 0, y: 0 } },
        { position: { x: 200, y: 200 } },
      ];

      const camera = calculateFitToView(nodes, 800, 600, 100, 2);

      // Verify zoom is within bounds
      expect(camera.zoom).toBeGreaterThan(0);
      expect(camera.zoom).toBeLessThanOrEqual(2);

      // Verify circuit is centered
      // Center of nodes is at (100, 100)
      // With padding=100, bounds are 400x400 (from -100 to 300 in both axes)
      // Zoom should be min(800/400, 600/400) = min(2, 1.5) = 1.5
      expect(camera.zoom).toBeCloseTo(1.5, 2);

      // Pan should center the circuit in viewport
      // Center should be at (100, 100) in world coords
      // In screen coords: 800/2 = 400, 600/2 = 300
      // x = 400 - 100 * 1.5 = 250
      // y = 300 - 100 * 1.5 = 150
      expect(camera.x).toBeCloseTo(250, 2);
      expect(camera.y).toBeCloseTo(150, 2);
    });

    it('should respect max zoom limit', () => {
      // Single small node at origin - would normally zoom in very far
      const nodes = [{ position: { x: 0, y: 0 } }];

      const camera = calculateFitToView(nodes, 800, 600, 100, 2);

      // Should clamp to max zoom of 2
      expect(camera.zoom).toBeLessThanOrEqual(2);
    });

    it('should handle negative coordinates', () => {
      const nodes = [
        { position: { x: -200, y: -200 } },
        { position: { x: 0, y: 0 } },
      ];

      const camera = calculateFitToView(nodes, 800, 600, 100, 2);

      expect(camera.zoom).toBeGreaterThan(0);
      expect(camera.zoom).toBeLessThanOrEqual(2);

      // All nodes should be visible
      expect(isFinite(camera.x)).toBe(true);
      expect(isFinite(camera.y)).toBe(true);
    });

    it('should use custom padding', () => {
      const nodes = [
        { position: { x: 0, y: 0 } },
        { position: { x: 200, y: 200 } },
      ];

      const cameraNoPadding = calculateFitToView(nodes, 800, 600, 0, 2);
      const cameraPadding = calculateFitToView(nodes, 800, 600, 100, 2);

      // With padding, zoom should be smaller (zoomed out more)
      expect(cameraPadding.zoom).toBeLessThan(cameraNoPadding.zoom);
    });
  });
});
