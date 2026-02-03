/**
 * Waveform Performance Tests
 * Tests downsampling, Canvas rendering, and rolling buffers
 * 
 * Attribution: Connor Angiel
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  WaveformDownsampler,
  CanvasWaveformRenderer,
  RollingWaveformBuffer,
  OscilloscopeDisplay
} from '../waveformPerformance';

describe('WaveformDownsampler', () => {
  let downsampler;

  beforeEach(() => {
    downsampler = new WaveformDownsampler(100);
  });

  it('should return original samples if under target', () => {
    const samples = [0, 0.5, 1, 0.5, 0];
    const result = downsampler.downsample(samples);
    expect(result.length).toBeLessThanOrEqual(samples.length);
  });

  it('should reduce large datasets to target size', () => {
    const samples = Array.from({ length: 1000 }, (_, i) => Math.sin((i / 100) * Math.PI));
    const result = downsampler.downsample(samples);
    
    expect(result.length).toBeLessThanOrEqual(100 * 2); // min/max envelope
    expect(result.length).toBeGreaterThan(0);
  });

  it('should preserve min/max peaks', () => {
    const samples = [0, 0.2, 0.5, 0.8, 1.0, 0.8, 0.5, 0.2, 0];
    downsampler = new WaveformDownsampler(3); // Aggressive downsampling
    const result = downsampler.downsample(samples);
    
    const values = result.map(p => p.value);
    const hasMax = values.some(v => Math.abs(v - 1.0) < 0.1);
    const hasMin = values.some(v => Math.abs(v - 0) < 0.1);
    
    expect(hasMax || hasMin).toBe(true);
  });

  it('should handle empty array', () => {
    expect(downsampler.downsample([])).toEqual([]);
  });

  it('should mark min and max types', () => {
    const samples = [0, 0.5, 1, 0.5, 0];
    downsampler = new WaveformDownsampler(2);
    const result = downsampler.downsample(samples);
    
    const types = result.map(p => p.type);
    expect(types).toContain('min');
    expect(types).toContain('max');
  });

  it('should handle adaptive downsampling with zoom', () => {
    const samples = Array.from({ length: 1000 }, (_, i) => Math.sin(i / 100));
    
    const result1 = downsampler.downsampleAdaptive(samples, 0.5);
    const result2 = downsampler.downsampleAdaptive(samples, 2.0);
    
    // Higher zoom should result in more points
    expect(result2.length).toBeGreaterThan(result1.length);
  });
});

describe('RollingWaveformBuffer', () => {
  let buffer;

  beforeEach(() => {
    buffer = new RollingWaveformBuffer(100);
  });

  it('should add samples up to max capacity', () => {
    for (let i = 0; i < 50; i++) {
      buffer.addSample(Math.sin(i / 10), i);
    }
    
    expect(buffer.buffer.length).toBe(50);
    expect(buffer.currentTick).toBe(49);
  });

  it('should evict oldest samples when full', () => {
    for (let i = 0; i < 150; i++) {
      buffer.addSample(i, i);
    }
    
    expect(buffer.buffer.length).toBe(100);
    expect(buffer.startTick).toBe(50); // Lost first 50 samples
  });

  it('should maintain correct tick numbering with eviction', () => {
    for (let i = 0; i < 150; i++) {
      buffer.addSample(i, i);
    }
    
    const samples = buffer.getSamples();
    expect(samples.length).toBe(100);
    expect(samples[0].tick).toBe(50);
    expect(samples[99].tick).toBe(149);
  });

  it('should resize buffer while preserving data', () => {
    for (let i = 0; i < 100; i++) {
      buffer.addSample(i, i);
    }
    
    buffer.setMaxSamples(50);
    expect(buffer.buffer.length).toBeLessThanOrEqual(50);
    expect(buffer.maxSamples).toBe(50);
  });

  it('should reset buffer correctly', () => {
    for (let i = 0; i < 50; i++) {
      buffer.addSample(i, i);
    }
    
    buffer.reset();
    expect(buffer.buffer.length).toBe(0);
    expect(buffer.startTick).toBe(0);
    expect(buffer.currentTick).toBe(0);
  });

  it('should handle continuous streaming', () => {
    const samples = [];
    for (let i = 0; i < 500; i++) {
      buffer.addSample(Math.sin(i / 50), i);
      if (i % 100 === 0) {
        samples.push(...buffer.getSamples());
      }
    }
    
    expect(buffer.buffer.length).toBeLessThanOrEqual(100);
    expect(samples.length).toBeGreaterThan(0);
  });
});

describe('CanvasWaveformRenderer', () => {
  let renderer;
  let mockCanvas;

  beforeEach(() => {
    // Mock canvas element
    mockCanvas = {
      width: 800,
      height: 400,
      getContext: () => ({
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        globalAlpha: 1,
        fillRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        clearRect: () => {}
      })
    };

    renderer = new CanvasWaveformRenderer(mockCanvas);
  });

  it('should set waveform data', () => {
    const samples = Array.from({ length: 100 }, (_, i) => i);
    renderer.setWaveform('node1', samples, '#ff0000');
    
    expect(renderer.waveforms.has('node1')).toBe(true);
    expect(renderer.colors.get('node1')).toBe('#ff0000');
  });

  it('should initialize with zero scroll and zoom', () => {
    expect(renderer.scrollX).toBe(0);
    expect(renderer.pixelsPerTick).toBe(2);
  });

  it('should pan waveforms', () => {
    const samples = Array.from({ length: 1000 }, (_, i) => Math.sin(i / 100));
    renderer.setWaveform('node1', samples);
    
    const initialScroll = renderer.scrollX;
    renderer.pan(100);
    expect(renderer.scrollX).toBeGreaterThan(initialScroll);
  });

  it('should pan with boundaries', () => {
    const samples = Array.from({ length: 100 }, (_, i) => i);
    renderer.setWaveform('node1', samples);
    
    renderer.pan(-1000); // Try to pan left
    expect(renderer.scrollX).toBe(0); // Should clamp to 0
  });

  it('should zoom in and out', () => {
    const samples = Array.from({ length: 100 }, (_, i) => i);
    renderer.setWaveform('node1', samples);
    
    const initialZoom = renderer.pixelsPerTick;
    renderer.zoom(2, 400); // Zoom in
    expect(renderer.pixelsPerTick).toBeGreaterThan(initialZoom);
    
    renderer.zoom(0.5, 400); // Zoom out
    expect(renderer.pixelsPerTick).toBeLessThan(renderer.pixelsPerTick * 0.5);
  });

  it('should get performance metrics', () => {
    const samples = Array.from({ length: 100 }, (_, i) => i);
    renderer.setWaveform('node1', samples);
    renderer.render();
    
    const metrics = renderer.getMetrics();
    expect(metrics.renderTime).toBeGreaterThanOrEqual(0);
    expect(metrics.canvasResolution).toBe('800x400');
  });

  it('should handle multiple waveforms', () => {
    renderer.setWaveform('node1', [0, 0.5, 1], '#ff0000');
    renderer.setWaveform('node2', [1, 0.5, 0], '#00ff00');
    renderer.setWaveform('node3', [0.5, 0, 0.5], '#0000ff');
    
    expect(renderer.waveforms.size).toBe(3);
    expect(renderer.colors.size).toBe(3);
  });
});

describe('OscilloscopeDisplay', () => {
  let display;
  let mockCanvas;

  beforeEach(() => {
    mockCanvas = {
      width: 800,
      height: 400,
      getContext: () => ({
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        globalAlpha: 1,
        fillRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        clearRect: () => {}
      })
    };

    display = new OscilloscopeDisplay(mockCanvas);
  });

  it('should add samples for multiple nodes', () => {
    display.addSample('node1', 0.5, 0, '#ff0000');
    display.addSample('node2', 0.3, 0, '#00ff00');
    
    expect(display.buffers.size).toBe(2);
    expect(display.buffers.has('node1')).toBe(true);
    expect(display.buffers.has('node2')).toBe(true);
  });

  it('should maintain buffers per node', () => {
    for (let i = 0; i < 50; i++) {
      display.addSample('node1', Math.sin(i / 10), i, '#ff0000');
    }
    
    const buffer = display.buffers.get('node1');
    expect(buffer.buffer.length).toBe(50);
  });

  it('should handle long-running simulations with rolling buffer', () => {
    // Simulate 10000 ticks
    for (let i = 0; i < 10000; i++) {
      display.addSample('node1', Math.sin(i / 100), i, '#ff0000');
    }
    
    const buffer = display.buffers.get('node1');
    expect(buffer.buffer.length).toBeLessThanOrEqual(display.options.maxBufferSamples);
  });

  it('should clear all waveforms', () => {
    display.addSample('node1', 0.5, 0, '#ff0000');
    display.addSample('node2', 0.3, 0, '#00ff00');
    
    display.clear();
    expect(display.buffers.size).toBe(0);
  });

  it('should get metrics', () => {
    display.addSample('node1', 0.5, 0, '#ff0000');
    const metrics = display.getMetrics();
    
    expect(metrics).toHaveProperty('samples');
    expect(metrics.samples).toBeGreaterThanOrEqual(0);
  });

  it('should support pan and zoom controls', () => {
    display.addSample('node1', 0.5, 0, '#ff0000');
    
    expect(() => display.pan(50)).not.toThrow();
    expect(() => display.zoom(1.5, 400)).not.toThrow();
    expect(() => display.render()).not.toThrow();
  });
});

describe('Waveform Performance - Integration', () => {
  it('should handle 500+ samples efficiently', () => {
    const downsampler = new WaveformDownsampler(500);
    const samples = Array.from({ length: 5000 }, (_, i) =>
      Math.sin((i / 100) * Math.PI) + 0.1 * Math.random()
    );
    
    const start = performance.now();
    const downsampled = downsampler.downsample(samples);
    const elapsed = performance.now() - start;
    
    expect(downsampled.length).toBeLessThanOrEqual(1000); // max/min envelope
    expect(elapsed).toBeLessThan(10); // Should be very fast
  });

  it('should maintain streaming performance', () => {
    const buffer = new RollingWaveformBuffer(10000);
    
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      buffer.addSample(Math.sin(i / 1000), i);
    }
    const elapsed = performance.now() - start;
    
    expect(elapsed).toBeLessThan(50); // Should complete in < 50ms
    expect(buffer.buffer.length).toBe(10000);
  });
});
