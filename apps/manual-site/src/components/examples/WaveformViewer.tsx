import { useState, useEffect, useRef } from 'react';

const TOTAL_TICKS = 64;
const TICK_PERIOD_MS = 50;

// Signal definitions with colors from design system
const SIGNALS = [
  { name: 'CLK', color: '#5ce8c8' },   // rb-signal-clk (teal)
  { name: 'A', color: '#5c8ce8' },     // rb-signal-a (blue)
  { name: 'B', color: '#a85ce8' },     // rb-signal-b (purple)
  { name: 'OUT', color: '#e8a85c' },   // rb-signal-out (orange)
];

// Pre-generate deterministic signal data
function generateSignalData() {
  const data: Record<string, number[]> = {};

  SIGNALS.forEach(({ name }) => {
    data[name] = [];
  });

  for (let tick = 0; tick < TOTAL_TICKS; tick++) {
    // CLK: square wave with period of 8 ticks
    data.CLK.push(Math.floor(tick / 4) % 2);

    // A: changes every 16 ticks
    data.A.push(Math.floor(tick / 16) % 2);

    // B: changes every 12 ticks
    data.B.push(Math.floor(tick / 12) % 2);

    // OUT: XOR of A and B
    data.OUT.push(data.A[tick] ^ data.B[tick]);
  }

  return data;
}

const SIGNAL_DATA = generateSignalData();

export default function WaveformViewer() {
  const [timeIndex, setTimeIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const lastTickRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Stable tick loop
  useEffect(() => {
    if (isPlaying) {
      let animationId: number;

      const tick = (timestamp: number) => {
        if (!lastTickRef.current) lastTickRef.current = timestamp;

        const elapsed = timestamp - lastTickRef.current;

        if (elapsed >= TICK_PERIOD_MS) {
          lastTickRef.current = timestamp;
          setTimeIndex((prev) => {
            if (prev >= TOTAL_TICKS - 1) {
              setIsPlaying(false);
              return prev;
            }
            return prev + 1;
          });
        }

        animationId = requestAnimationFrame(tick);
      };

      animationId = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(animationId);
    } else {
      lastTickRef.current = 0;
    }
  }, [isPlaying]);

  // Draw waveforms
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const signalHeight = height / SIGNALS.length;
    const tickWidth = width / TOTAL_TICKS;

    // Clear
    ctx.fillStyle = '#13161c'; // rb-surface
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;

    // Vertical grid (every 8 ticks)
    for (let i = 0; i <= TOTAL_TICKS; i += 8) {
      const x = i * tickWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal grid (signal separators)
    for (let i = 1; i < SIGNALS.length; i++) {
      const y = i * signalHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw waveforms
    SIGNALS.forEach((signal, signalIdx) => {
      const yBase = signalIdx * signalHeight;
      const yHigh = yBase + signalHeight * 0.2;
      const yLow = yBase + signalHeight * 0.8;

      ctx.strokeStyle = signal.color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let tick = 0; tick < TOTAL_TICKS; tick++) {
        const x = tick * tickWidth;
        const value = SIGNAL_DATA[signal.name][tick];
        const y = value === 1 ? yHigh : yLow;

        if (tick === 0) {
          ctx.moveTo(x, y);
        } else {
          const prevValue = SIGNAL_DATA[signal.name][tick - 1];
          const prevY = prevValue === 1 ? yHigh : yLow;

          if (prevValue !== value) {
            ctx.lineTo(x, prevY);
            ctx.lineTo(x, y);
          }
        }

        ctx.lineTo(x + tickWidth, y);
      }

      ctx.stroke();
    });

    // Time cursor
    const cursorX = timeIndex * tickWidth;
    ctx.strokeStyle = '#e85c5c'; // rb-accent
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, height);
    ctx.stroke();
    ctx.setLineDash([]);

  }, [timeIndex]);

  const handlePlayPause = () => setIsPlaying(!isPlaying);
  const handleReset = () => {
    setTimeIndex(0);
    setIsPlaying(false);
    lastTickRef.current = 0;
  };
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTimeIndex(parseInt(e.target.value, 10));
    setIsPlaying(false);
  };
  const handleStep = (delta: number) => {
    setIsPlaying(false);
    setTimeIndex(prev => Math.max(0, Math.min(TOTAL_TICKS - 1, prev + delta)));
  };

  return (
    <div className="bg-rb-surface border border-rb-border rounded-md overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-rb-border">
        <h3 className="text-h3 text-rb-text">Waveform Viewer</h3>
        <p className="text-sm text-rb-muted mt-1">
          Oscilloscope-style view. Scrub through time to debug signal timing.
        </p>
      </div>

      <div className="p-6 space-y-4">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={handlePlayPause}
            className="btn btn-primary"
          >
            {isPlaying ? (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="mr-2">
                  <rect x="3" y="2" width="4" height="12" />
                  <rect x="9" y="2" width="4" height="12" />
                </svg>
                Pause
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="mr-2">
                  <path d="M4 2l10 6-10 6V2z" />
                </svg>
                Play
              </>
            )}
          </button>

          <button
            type="button"
            aria-label="Step backward"
            onClick={() => handleStep(-1)}
            className="btn btn-secondary px-3"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M10 12L4 8l6-4v8zM12 4v8h-2V4h2z" />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Step forward"
            onClick={() => handleStep(1)}
            className="btn btn-secondary px-3"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 4l6 4-6 4V4zM4 4v8h2V4H4z" />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Reset"
            onClick={handleReset}
            className="btn btn-secondary"
          >
            Reset
          </button>

          <div className="flex items-center gap-2 ml-auto text-sm font-mono">
            <span className="text-rb-dim">Tick:</span>
            <span className="text-rb-text font-semibold tabular-nums">{timeIndex}</span>
            <span className="text-rb-dim">/ {TOTAL_TICKS - 1}</span>
          </div>
        </div>

        {/* Time scrubber */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-rb-dim font-mono">0</span>
          <input
            type="range"
            aria-label="Scrub timeline"
            min="0"
            max={TOTAL_TICKS - 1}
            value={timeIndex}
            onChange={handleSliderChange}
            className="flex-1 h-1.5 bg-rb-raised rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-rb-accent [&::-webkit-slider-thumb]:cursor-pointer
                     [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3
                     [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-rb-accent [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer"
          />
          <span className="text-xs text-rb-dim font-mono">{TOTAL_TICKS - 1}</span>
        </div>

        {/* Waveform display */}
        <div className="flex gap-4">
          {/* Signal labels */}
          <div className="flex flex-col justify-around py-2 pr-2 border-r border-rb-border">
            {SIGNALS.map((signal) => (
              <div key={signal.name} className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: signal.color }}
                />
                <span className="text-xs font-mono text-rb-muted">{signal.name}</span>
              </div>
            ))}
          </div>

          {/* Canvas */}
          <div className="flex-1 bg-rb-surface rounded overflow-hidden">
            <canvas
              ref={canvasRef}
              className="w-full"
              style={{ height: `${SIGNALS.length * 50}px` }}
            />
          </div>
        </div>

        {/* Signal values at current tick */}
        <div className="grid grid-cols-4 gap-3">
          {SIGNALS.map((signal) => {
            const value = SIGNAL_DATA[signal.name][timeIndex];
            return (
              <div key={signal.name} className="bg-rb-raised border border-rb-border rounded-md p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: signal.color }}
                  />
                  <span className="text-xs font-semibold text-rb-muted">{signal.name}</span>
                </div>
                <div
                  className="text-2xl font-mono font-bold"
                  style={{ color: signal.color }}
                >
                  {value}
                </div>
              </div>
            );
          })}
        </div>

        {/* Info */}
        <p className="text-xs text-rb-dim leading-relaxed">
          <span className="text-rb-accent font-medium">Deterministic:</span>{' '}
          Every tick produces the same output. Step backward and forward to see exact signal states at any moment - ideal for debugging timing issues.
        </p>
      </div>
    </div>
  );
}
