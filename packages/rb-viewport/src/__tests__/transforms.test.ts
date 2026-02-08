// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Coordinate transform tests

import { describe, it, expect } from 'vitest';
import { screenToWorld, worldToScreen, fitToBounds } from '../transforms.js';
import type { Camera, ContentBounds } from '../types.js';

describe('Coordinate Transforms', () => {
  const baseCamera: Camera = { x: 0, y: 0, zoom: 1 };

  describe('screenToWorld', () => {
    it('converts screen coordinates with identity camera', () => {
      const result = screenToWorld(100, 200, baseCamera);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('applies pan offset', () => {
      const camera: Camera = { x: 50, y: 75, zoom: 1 };
      const result = screenToWorld(100, 200, camera);
      expect(result).toEqual({ x: 50, y: 125 });
    });

    it('applies zoom scale', () => {
      const camera: Camera = { x: 0, y: 0, zoom: 2 };
      const result = screenToWorld(100, 200, camera);
      expect(result).toEqual({ x: 50, y: 100 });
    });

    it('applies combined pan and zoom', () => {
      const camera: Camera = { x: 40, y: 60, zoom: 2 };
      const result = screenToWorld(100, 200, camera);
      expect(result).toEqual({ x: 30, y: 70 });
    });

    it('handles zoom at 0.5', () => {
      const camera: Camera = { x: 0, y: 0, zoom: 0.5 };
      const result = screenToWorld(100, 200, camera);
      expect(result).toEqual({ x: 200, y: 400 });
    });
  });

  describe('worldToScreen', () => {
    it('converts world coordinates with identity camera', () => {
      const result = worldToScreen(100, 200, baseCamera);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('applies pan offset', () => {
      const camera: Camera = { x: 50, y: 75, zoom: 1 };
      const result = worldToScreen(100, 200, camera);
      expect(result).toEqual({ x: 150, y: 275 });
    });

    it('applies zoom scale', () => {
      const camera: Camera = { x: 0, y: 0, zoom: 2 };
      const result = worldToScreen(50, 100, camera);
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('applies combined pan and zoom', () => {
      const camera: Camera = { x: 40, y: 60, zoom: 2 };
      const result = worldToScreen(30, 70, camera);
      expect(result).toEqual({ x: 100, y: 200 });
    });
  });

  describe('Round-trip conversions', () => {
    it('screen -> world -> screen with identity camera', () => {
      const original = { screen: { x: 150, y: 250 } };
      const world = screenToWorld(original.screen.x, original.screen.y, baseCamera);
      const screen = worldToScreen(world.x, world.y, baseCamera);

      expect(screen.x).toBeCloseTo(original.screen.x);
      expect(screen.y).toBeCloseTo(original.screen.y);
    });

    it('screen -> world -> screen with pan and zoom', () => {
      const camera: Camera = { x: 40, y: 60, zoom: 2.5 };
      const original = { screen: { x: 300, y: 400 } };

      const world = screenToWorld(original.screen.x, original.screen.y, camera);
      const screen = worldToScreen(world.x, world.y, camera);

      expect(screen.x).toBeCloseTo(original.screen.x, 10);
      expect(screen.y).toBeCloseTo(original.screen.y, 10);
    });

    it('world -> screen -> world with identity camera', () => {
      const original = { world: { x: 150, y: 250 } };
      const screen = worldToScreen(original.world.x, original.world.y, baseCamera);
      const world = screenToWorld(screen.x, screen.y, baseCamera);

      expect(world.x).toBeCloseTo(original.world.x);
      expect(world.y).toBeCloseTo(original.world.y);
    });

    it('world -> screen -> world with pan and zoom', () => {
      const camera: Camera = { x: 100, y: 150, zoom: 1.5 };
      const original = { world: { x: 80, y: 120 } };

      const screen = worldToScreen(original.world.x, original.world.y, camera);
      const world = screenToWorld(screen.x, screen.y, camera);

      expect(world.x).toBeCloseTo(original.world.x, 10);
      expect(world.y).toBeCloseTo(original.world.y, 10);
    });
  });

  describe('fitToBounds', () => {
    it('returns identity when content is empty', () => {
      const bounds: ContentBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
      const result = fitToBounds(bounds, 800, 600);

      expect(result.x).toBe(400); // viewport center
      expect(result.y).toBe(300);
      expect(result.zoom).toBe(1.0);
    });

    it('centers content in viewport', () => {
      const bounds: ContentBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      const result = fitToBounds(bounds, 800, 600, 60);

      // Content center is at (50, 50)
      // Should be centered in viewport
      expect(result.x).toBeLessThan(800);
      expect(result.y).toBeLessThan(600);
      expect(result.zoom).toBeGreaterThan(0);
    });

    it('respects max zoom constraint', () => {
      const bounds: ContentBounds = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
      const result = fitToBounds(bounds, 800, 600, 60, 2.0);

      expect(result.zoom).toBeLessThanOrEqual(2.0);
    });

    it('scales down content that is too large', () => {
      const bounds: ContentBounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
      const result = fitToBounds(bounds, 800, 600, 60);

      // Content is larger than viewport, so zoom should be < 1.0
      expect(result.zoom).toBeLessThan(1.0);
    });

    it('handles negative coordinates', () => {
      const bounds: ContentBounds = { minX: -100, minY: -100, maxX: 100, maxY: 100 };
      const result = fitToBounds(bounds, 800, 600);

      expect(result.zoom).toBeGreaterThan(0);
      // Content center at (0, 0) should be centered in viewport at (400, 300)
      expect(result.x).toBeCloseTo(400, 50);
      expect(result.y).toBeCloseTo(300, 50);
    });

    it('respects margin around content', () => {
      const bounds: ContentBounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
      const result1 = fitToBounds(bounds, 800, 600, 0);  // No margin
      const result2 = fitToBounds(bounds, 800, 600, 100); // Large margin

      // With margin, zoom should be smaller (more margin = less zoom)
      expect(result1.zoom).toBeGreaterThanOrEqual(result2.zoom);
    });
  });

  describe('Zoom towards point', () => {
    it('maintains screen position during zoom-in', () => {
      const camera: Camera = { x: 0, y: 0, zoom: 1 };
      const screenPoint = { x: 400, y: 300 }; // Center of 800x600 viewport

      // Get world position at current zoom
      const worldPos = screenToWorld(screenPoint.x, screenPoint.y, camera);

      // Zoom in by 2x
      const newZoom = 2;
      const newCamera: Camera = {
        x: screenPoint.x - worldPos.x * newZoom,
        y: screenPoint.y - worldPos.y * newZoom,
        zoom: newZoom,
      };

      // Verify screen point still maps to same world position
      const checkPos = screenToWorld(screenPoint.x, screenPoint.y, newCamera);
      expect(checkPos.x).toBeCloseTo(worldPos.x, 5);
      expect(checkPos.y).toBeCloseTo(worldPos.y, 5);
    });

    it('zoom-to-point preserves world coordinate', () => {
      const camera: Camera = { x: 50, y: 75, zoom: 1.5 };
      const screenPoint = { x: 200, y: 150 };

      const originalWorld = screenToWorld(screenPoint.x, screenPoint.y, camera);

      // Zoom to 3x
      const newZoom = 3;
      const newCamera: Camera = {
        x: screenPoint.x - originalWorld.x * newZoom,
        y: screenPoint.y - originalWorld.y * newZoom,
        zoom: newZoom,
      };

      const newWorld = screenToWorld(screenPoint.x, screenPoint.y, newCamera);
      expect(newWorld.x).toBeCloseTo(originalWorld.x, 5);
      expect(newWorld.y).toBeCloseTo(originalWorld.y, 5);
    });
  });

  describe('Edge cases', () => {
    it('handles very small zoom values', () => {
      const camera: Camera = { x: 0, y: 0, zoom: 0.01 };
      const result = screenToWorld(100, 200, camera);
      expect(result).toEqual({ x: 10000, y: 20000 });
    });

    it('handles very large coordinates', () => {
      const camera: Camera = { x: 10000, y: 20000, zoom: 1 };
      const result = screenToWorld(5000, 10000, camera);
      // screenToWorld: (screenX - camera.x) / camera.zoom = (5000 - 10000) / 1 = -5000
      expect(result).toEqual({ x: -5000, y: -10000 });
    });

    it('handles negative pan values', () => {
      const camera: Camera = { x: -100, y: -200, zoom: 1 };
      const result = screenToWorld(100, 200, camera);
      expect(result).toEqual({ x: 200, y: 400 });
    });

    it('handles zero screen coordinates', () => {
      const camera: Camera = { x: 50, y: 75, zoom: 2 };
      const result = screenToWorld(0, 0, camera);
      expect(result).toEqual({ x: -25, y: -37.5 });
    });
  });
});
