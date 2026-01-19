import { useState, useEffect, useRef } from 'react';

const TOTAL_TICKS = 64;
const SIGNALS = ['CLK', 'A', 'B', 'OUT'];
const TICK_PERIOD_MS = 33; // ~30 ticks/sec
const COLORS = {
  CLK: '#3ff0c8',
  A: '#6ba3ff',
  B: '#9b6bff',
  OUT: '#ff6b95'
};

// Pre-generate deterministic signal data for all ticks
function generateSignalData() {
  const data: Record<string, number[]> = {
    CLK: [],
    A: [],
    B: [],
    OUT: []
  };

  for (let tick = 0; tick < TOTAL_TICKS; tick++) {
    // CLK: square wave with period of 8 ticks
    data.CLK.push(Math.floor(tick / 4) % 2);
    
    // A: changes every 16 ticks
    data.A.push(Math.floor(tick / 16) % 2);
    
    // B: changes every 12 ticks
    data.B.push(Math.floor(tick / 12) % 2);
    
    // OUT: XOR of A and B (combinational logic)
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

  // Stable tick loop using requestAnimationFrame
  useEffect(() => {
    if (isPlaying) {
      let animationId: number;
      
      const tick = (timestamp: number) => {
        if (!lastTickRef.current) lastTickRef.current = timestamp;
        
        const elapsed = timestamp - lastTickRef.current;
        
        // Advance by 1 tick when enough time has passed
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

  // Draw waveforms on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const signalHeight = height / SIGNALS.length;
    const tickWidth = width / TOTAL_TICKS;

    // Clear canvas
    ctx.fillStyle = '#0f1620';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    
    // Vertical grid lines (every 8 ticks)
    for (let i = 0; i <= TOTAL_TICKS; i += 8) {
      const x = i * tickWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal grid lines (between signals)
    for (let i = 1; i < SIGNALS.length; i++) {
      const y = i * signalHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw waveforms as step functions
    SIGNALS.forEach((signal, signalIdx) => {
      const yBase = signalIdx * signalHeight;
      const yHigh = yBase + signalHeight * 0.2;
      const yLow = yBase + signalHeight * 0.8;

      ctx.strokeStyle = COLORS[signal as keyof typeof COLORS];
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let tick = 0; tick < TOTAL_TICKS; tick++) {
        const x = tick * tickWidth;
        const value = SIGNAL_DATA[signal][tick];
        const y = value === 1 ? yHigh : yLow;

        if (tick === 0) {
          ctx.moveTo(x, y);
        } else {
          // Draw step function: horizontal then vertical
          const prevValue = SIGNAL_DATA[signal][tick - 1];
          const prevY = prevValue === 1 ? yHigh : yLow;
          
          if (prevValue !== value) {
            // Vertical transition
            ctx.lineTo(x, prevY);
            ctx.lineTo(x, y);
          }
        }
        
        // Horizontal line to next tick
        ctx.lineTo(x + tickWidth, y);
      }

      ctx.stroke();
    });

    // Draw time cursor
    const cursorX = timeIndex * tickWidth;
    ctx.strokeStyle = '#3ff0c8';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cursorX, 0);
    ctx.lineTo(cursorX, height);
    ctx.stroke();
    ctx.setLineDash([]);

  }, [timeIndex]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setTimeIndex(0);
    setIsPlaying(false);
    lastTickRef.current = 0;
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIndex = parseInt(e.target.value, 10);
    setTimeIndex(newIndex);
    setIsPlaying(false);
  };

  return (
    <div className="bg-rb-surface rounded-lg p-8 border border-rb-border">
      <h3 className="text-2xl font-bold mb-6 text-rb-text">Waveform Viewer</h3>
      
      {/* Controls */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex gap-4">
          <button
            aria-label={isPlaying ? 'Pause playback' : 'Play waveform'}
            onClick={handlePlayPause}
            className="px-6 py-2 bg-rb-accent text-rb-bg font-medium rounded hover:bg-rb-accent-dim transition-colors"
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            aria-label="Reset to tick 0"
            onClick={handleReset}
            className="px-6 py-2 bg-rb-bg border border-rb-border text-rb-text font-medium rounded hover:border-rb-accent transition-colors"
          >
            Reset
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-rb-muted">Tick:</span>
            <span className="text-rb-text font-mono font-bold">{timeIndex}</span>
            <span className="text-rb-muted">/ {TOTAL_TICKS - 1}</span>
          </div>
        </div>

        {/* Time scrubber */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-rb-muted">Time:</span>
          <input
            type="range"
            aria-label="Scrub through waveform time"
            min="0"
            max={TOTAL_TICKS - 1}
            value={timeIndex}
            onChange={handleSliderChange}
            className="flex-1 h-2 bg-rb-bg rounded-lg appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-rb-accent
                     [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 
                     [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-rb-accent [&::-moz-range-thumb]:border-0"
          />
        </div>
      </div>

      {/* Waveform Canvas */}
      <div className="bg-rb-bg rounded-lg p-4 mb-6">
        <canvas
          ref={canvasRef}
          width={800}
          height={240}
          className="w-full"
        />
      </div>

      {/* Signal Values */}
      <div className="grid grid-cols-4 gap-4">
        {SIGNALS.map((signal) => {
          const value = SIGNAL_DATA[signal][timeIndex];
          const color = COLORS[signal as keyof typeof COLORS];
          return (
            <div key={signal} className="bg-rb-bg rounded p-4 border border-rb-border">
              <div className="flex items-center gap-2 mb-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm font-semibold text-rb-text">{signal}</span>
              </div>
              <div className="text-2xl font-mono font-bold" style={{ color }}>
                {value}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-sm text-rb-muted mt-6 leading-relaxed">
        <span className="text-rb-accent">💡 Deterministic behavior:</span> Scrub through time to see the exact state at any tick. 
        Same inputs always produce same outputs—perfect for debugging.
      </p>
    </div>
  );
}
