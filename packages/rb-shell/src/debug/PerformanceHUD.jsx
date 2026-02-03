// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useEffect, useRef } from 'react';

/**
 * PerformanceHUD
 *
 * Real-time performance metrics display for simulation debugging.
 * Shows tick rate, node evaluation, render performance, and memory usage.
 */
export function PerformanceHUD({ simulationEngine, enabled = true }) {
  const [metrics, setMetrics] = useState({
    ticksPerSecond: 0,
    averageTickTime: 0,
    nodesEvaluated: 0,
    fps: 60,
    memoryMb: 0,
    updateCount: 0,
  });

  const [history, setHistory] = useState({
    tickTimes: [],
    fps: [],
    memory: [],
  });

  const metricsRef = useRef({
    lastTickTime: 0,
    tickCount: 0,
    totalTickTime: 0,
    lastFrameTime: 0,
    frameCount: 0,
    totalFrameTime: 0,
  });

  const updateRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    const updateMetrics = () => {
      const now = performance.now();
      const stats = metricsRef.current;

      // Update tick metrics from engine (simulated)
      if (simulationEngine && simulationEngine.profiler) {
        const report = simulationEngine.profiler.getReport();
        setMetrics((prev) => ({
          ...prev,
          ticksPerSecond: report.ticksPerSecond,
          averageTickTime: report.averageTickTime.toFixed(2),
          nodesEvaluated: report.averageNodesPerTick.toFixed(0),
        }));
      }

      // Update memory if available
      if (performance.memory) {
        const memMb = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
        setMetrics((prev) => ({ ...prev, memoryMb: memMb }));

        setHistory((prev) => ({
          ...prev,
          memory: [...prev.memory.slice(-59), parseFloat(memMb)],
        }));
      }

      // Frame timing
      const now_ms = Date.now();
      stats.frameCount++;
      stats.totalFrameTime += 16.67; // Estimate per frame

      if (stats.frameCount % 10 === 0) {
        const fps = Math.round((1000 * stats.frameCount) / stats.totalFrameTime);
        setMetrics((prev) => ({ ...prev, fps }));
        setHistory((prev) => ({
          ...prev,
          fps: [...prev.fps.slice(-59), fps],
        }));
      }

      updateRef.current = requestAnimationFrame(updateMetrics);
    };

    updateRef.current = requestAnimationFrame(updateMetrics);

    return () => {
      if (updateRef.current) {
        cancelAnimationFrame(updateRef.current);
      }
    };
  }, [enabled, simulationEngine]);

  if (!enabled) {
    return null;
  }

  // Simple mini-chart for history
  const renderSparkline = (data, height = 20) => {
    if (data.length === 0) return null;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    });

    return (
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 100 ${height}`}
        style={{ marginTop: '0.25rem' }}
      >
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.5"
        />
      </svg>
    );
  };

  return (
    <div className="performance-hud">
      <div className="hud-title">Performance Metrics</div>

      <div className="metrics-grid">
        {/* Tick Rate */}
        <div className="metric-card">
          <div className="metric-label">Tick Rate</div>
          <div className="metric-value">
            {metrics.ticksPerSecond.toFixed(0)}
            <span className="unit">t/s</span>
          </div>
          <div className="metric-history">
            {renderSparkline(history.fps)}
          </div>
        </div>

        {/* Average Tick Time */}
        <div className="metric-card">
          <div className="metric-label">Avg Tick</div>
          <div className="metric-value">
            {metrics.averageTickTime}
            <span className="unit">ms</span>
          </div>
        </div>

        {/* Nodes Evaluated */}
        <div className="metric-card">
          <div className="metric-label">Nodes/Tick</div>
          <div className="metric-value">
            {metrics.nodesEvaluated}
            <span className="unit">nodes</span>
          </div>
        </div>

        {/* Frame Rate */}
        <div className="metric-card">
          <div className="metric-label">FPS</div>
          <div className={`metric-value ${metrics.fps < 30 ? 'low' : ''}`}>
            {metrics.fps}
            <span className="unit">fps</span>
          </div>
          <div className="metric-history">
            {renderSparkline(history.fps)}
          </div>
        </div>

        {/* Memory */}
        <div className="metric-card">
          <div className="metric-label">Memory</div>
          <div className="metric-value">
            {metrics.memoryMb}
            <span className="unit">MB</span>
          </div>
          <div className="metric-history">
            {renderSparkline(history.memory)}
          </div>
        </div>

        {/* UI Updates */}
        <div className="metric-card">
          <div className="metric-label">Updates</div>
          <div className="metric-value">
            {metrics.updateCount}
            <span className="unit">count</span>
          </div>
        </div>
      </div>

      <style>{`
        .performance-hud {
          position: fixed;
          bottom: 1rem;
          right: 1rem;
          background: rgba(0, 0, 0, 0.85);
          border: 1px solid #00ff88;
          border-radius: 6px;
          padding: 0.75rem;
          font-family: 'Courier New', monospace;
          color: #e0e0e0;
          font-size: 0.75rem;
          z-index: 10000;
          max-width: 250px;
          backdrop-filter: blur(4px);
        }

        .hud-title {
          color: #00ff88;
          font-weight: bold;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
        }

        .metric-card {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(0, 255, 136, 0.3);
          border-radius: 4px;
          padding: 0.5rem;
        }

        .metric-label {
          color: #888;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.25rem;
          font-size: 0.65rem;
        }

        .metric-value {
          display: flex;
          align-items: baseline;
          gap: 0.25rem;
          color: #00ff88;
          font-weight: bold;
          font-size: 1.1rem;
        }

        .metric-value.low {
          color: #ff6666;
        }

        .unit {
          font-size: 0.65rem;
          color: #666;
          font-weight: normal;
        }

        .metric-history {
          color: #00ff88;
          opacity: 0.5;
          height: 20px;
          margin-top: 0.25rem;
        }

        .metric-history svg {
          width: 100%;
          height: 100%;
        }
      `}</style>
    </div>
  );
}

export default PerformanceHUD;
