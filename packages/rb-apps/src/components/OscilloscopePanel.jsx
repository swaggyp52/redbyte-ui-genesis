import React, { useEffect, useRef, useState } from 'react';
import { OscilloscopeDisplay } from '@redbyte/rb-logic-core';

/**
 * React Oscilloscope Component
 * Real-time waveform viewer with Canvas-based rendering
 * Supports panning, zooming, and multiple concurrent signals
 * 
 * Attribution: Connor Angiel
 */
export default function OscilloscopePanel({ circuit, recording }) {
  const canvasRef = useRef(null);
  const [display, setDisplay] = useState(null);
  const [metrics, setMetrics] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);

  // Initialize oscilloscope display
  useEffect(() => {
    if (!canvasRef.current) return;

    const oscDisplay = new OscilloscopeDisplay(canvasRef.current, {
      maxBufferSamples: 10000,
      downsampleTarget: 500,
      enableWebGL: true
    });

    setDisplay(oscDisplay);
  }, []);

  // Load recording data into oscilloscope
  useEffect(() => {
    if (!display || !recording) return;

    display.clear();

    // Get node colors from circuit
    const nodeColors = new Map();
    if (circuit?.nodes) {
      circuit.nodes.forEach((node, idx) => {
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
        nodeColors.set(node.id, colors[idx % colors.length]);
      });
    }

    // Add samples from recording
    recording.events?.forEach(event => {
      if (event.type === 'input_toggled' || event.type === 'node_changed') {
        const nodeId = event.nodeId || event.targetId;
        const value = event.value ? 1 : 0;
        const color = nodeColors.get(nodeId) || '#000000';

        display.addSample(nodeId, value, event.tick, color);
      }
    });

    display.render();
    setMetrics(display.getMetrics());
  }, [display, recording, circuit]);

  // Render loop
  useEffect(() => {
    if (!display) return;

    let animationId;
    const renderLoop = () => {
      display.render();
      setMetrics(display.getMetrics());
      animationId = requestAnimationFrame(renderLoop);
    };

    animationId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animationId);
  }, [display]);

  // Handle mouse wheel zoom
  const handleWheel = (e) => {
    if (!display) return;

    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    display.zoom(factor, e.clientX - canvasRef.current.getBoundingClientRect().left);
  };

  // Handle mouse drag pan
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart(e.clientX);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !display) return;

    const delta = e.clientX - dragStart;
    display.pan(-delta * 0.5); // Pan speed factor
    setDragStart(e.clientX);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="oscilloscope-panel">
      <div className="oscilloscope-header">
        <h2>Oscilloscope</h2>
        <div className="oscilloscope-metrics">
          {metrics.renderTime !== undefined && (
            <span>Render: {metrics.renderTime?.toFixed(2)}ms</span>
          )}
          {metrics.sampleCount !== undefined && (
            <span>Samples: {metrics.sampleCount}</span>
          )}
          {metrics.canvasResolution && (
            <span>Resolution: {metrics.canvasResolution}</span>
          )}
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="oscilloscope-canvas"
        width={800}
        height={400}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      />

      <div className="oscilloscope-controls">
        <button
          onClick={() => display?.clear()}
          title="Clear all waveforms"
        >
          Clear
        </button>
        <button
          onClick={() => display?.pan(-100)}
          title="Pan left"
        >
          ← Pan
        </button>
        <button
          onClick={() => display?.pan(100)}
          title="Pan right"
        >
          Pan →
        </button>
        <button
          onClick={() => display?.zoom(1.2, 400)}
          title="Zoom in"
        >
          🔍 +
        </button>
        <button
          onClick={() => display?.zoom(0.8, 400)}
          title="Zoom out"
        >
          🔍 −
        </button>
      </div>

      <style jsx>{`
        .oscilloscope-panel {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 10px;
          background: #f5f5f5;
          border-radius: 4px;
        }

        .oscilloscope-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .oscilloscope-header h2 {
          margin: 0;
          font-size: 16px;
        }

        .oscilloscope-metrics {
          display: flex;
          gap: 15px;
          font-size: 12px;
          color: #666;
        }

        .oscilloscope-canvas {
          border: 1px solid #ccc;
          background: white;
          cursor: grab;
        }

        .oscilloscope-canvas:active {
          cursor: grabbing;
        }

        .oscilloscope-controls {
          display: flex;
          gap: 5px;
        }

        .oscilloscope-controls button {
          padding: 4px 8px;
          font-size: 12px;
          border: 1px solid #ccc;
          background: white;
          border-radius: 2px;
          cursor: pointer;
        }

        .oscilloscope-controls button:hover {
          background: #e9e9e9;
        }

        .oscilloscope-controls button:active {
          background: #d0d0d0;
        }
      `}</style>
    </div>
  );
}
