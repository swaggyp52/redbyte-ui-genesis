import React, { useState, useRef, useEffect } from 'react';
import { useLabStore } from './store/labStore';
import { Play, Pause, RotateCcw, ZoomIn, ZoomOut, Maximize2, Activity } from 'lucide-react';

interface WaveformSample {
  time: number;
  inputs: number[];
  segments: number[];
  propagationDelay?: number; // Simulated propagation delay in ns
}

export const WaveformViewerEnhanced: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const [selectedSignals, setSelectedSignals] = useState<string[]>([
    'B3', 'B2', 'B1', 'B0', 'seg_a', 'seg_b', 'seg_c'
  ]);

  const waveformHistory = useLabStore((s) => s.waveformHistory);
  const evalSeg = useLabStore((s) => s.evalSeg);

  const SIGNAL_COLORS: Record<string, string> = {
    B3: '#06b6d4', // cyan
    B2: '#10b981', // emerald
    B1: '#f59e0b', // amber
    B0: '#ec4899', // pink
    seg_a: '#8b5cf6', // purple
    seg_b: '#3b82f6', // blue
    seg_c: '#14b8a6', // teal
    seg_d: '#f97316', // orange
    seg_e: '#22c55e', // green
    seg_f: '#eab308', // yellow
    seg_g: '#ef4444', // red
  };

  const INPUT_NAMES = ['B3', 'B2', 'B1', 'B0'];
  const SEGMENT_NAMES = ['seg_a', 'seg_b', 'seg_c', 'seg_d', 'seg_e', 'seg_f', 'seg_g'];

  // Generate waveform samples with simulated propagation delays
  const samples: WaveformSample[] = [];
  for (let i = 0; i < 16; i++) {
    const output = evalSeg(i);
    const segments = Array.from({ length: 7 }, (_, j) => (output >> j) & 1);
    
    samples.push({
      time: i,
      inputs: [
        (i >> 3) & 1,
        (i >> 2) & 1,
        (i >> 1) & 1,
        (i >> 0) & 1,
      ],
      segments,
      propagationDelay: 5, // 5ns simulated gate delay
    });
  }

  // Draw oscilloscope-style waveforms
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    const gridSpacing = 40 * zoom;
    
    // Vertical grid lines
    for (let x = panOffset % gridSpacing; x < width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal grid lines
    const signalHeight = height / selectedSignals.length;
    for (let i = 0; i <= selectedSignals.length; i++) {
      const y = i * signalHeight;
      ctx.strokeStyle = i === 0 ? '#334155' : '#1e293b';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = '#1e293b';

    // Draw waveforms
    selectedSignals.forEach((signalName, signalIdx) => {
      const y = signalIdx * signalHeight;
      const signalColor = SIGNAL_COLORS[signalName] || '#06b6d4';

      // Draw signal name
      ctx.fillStyle = signalColor;
      ctx.font = 'bold 14px "Share Tech Mono", monospace';
      ctx.fillText(signalName, 10, y + 20);

      // Draw waveform
      ctx.strokeStyle = signalColor;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = signalColor;

      ctx.beginPath();
      const timeScale = 60 * zoom;

      samples.forEach((sample, idx) => {
        let value: number;
        
        if (signalName.startsWith('seg_')) {
          const segIdx = SEGMENT_NAMES.indexOf(signalName);
          value = sample.segments[segIdx];
        } else {
          const inputIdx = INPUT_NAMES.indexOf(signalName);
          value = sample.inputs[inputIdx];
        }

        const x = panOffset + sample.time * timeScale;
        const waveY = y + signalHeight * 0.7 - (value * signalHeight * 0.4);

        if (idx === 0) {
          ctx.moveTo(x, waveY);
        } else {
          // Square wave with transitions
          const prevSample = samples[idx - 1];
          let prevValue: number;
          
          if (signalName.startsWith('seg_')) {
            const segIdx = SEGMENT_NAMES.indexOf(signalName);
            prevValue = prevSample.segments[segIdx];
          } else {
            const inputIdx = INPUT_NAMES.indexOf(signalName);
            prevValue = prevSample.inputs[inputIdx];
          }

          const prevX = panOffset + prevSample.time * timeScale;
          const prevY = y + signalHeight * 0.7 - (prevValue * signalHeight * 0.4);

          // Draw transition
          if (value !== prevValue) {
            ctx.lineTo(x, prevY);
            ctx.lineTo(x, waveY);
          } else {
            ctx.lineTo(x, waveY);
          }
        }
      });

      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // Draw current time cursor
    if (playing && currentTime < samples.length) {
      const cursorX = panOffset + currentTime * 60 * zoom;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Time label
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 12px "Share Tech Mono", monospace';
      ctx.fillText(`t=${currentTime}`, cursorX + 5, 15);
    }
  }, [samples, selectedSignals, zoom, panOffset, currentTime, playing]);

  // Animation loop
  useEffect(() => {
    if (!playing) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= samples.length - 1) {
          setPlaying(false);
          return 0;
        }
        return prev + 1;
      });
    }, 200); // 200ms per step

    return () => clearInterval(interval);
  }, [playing, samples.length]);

  const toggleSignal = (signal: string) => {
    if (selectedSignals.includes(signal)) {
      setSelectedSignals(selectedSignals.filter(s => s !== signal));
    } else {
      setSelectedSignals([...selectedSignals, signal]);
    }
  };

  const handleZoomIn = () => setZoom(Math.min(zoom * 1.5, 4));
  const handleZoomOut = () => setZoom(Math.max(zoom / 1.5, 0.5));
  const handleReset = () => {
    setZoom(1);
    setPanOffset(0);
    setCurrentTime(0);
    setPlaying(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-tech-display text-2xl font-bold text-cyan-400 neon-cyan mb-2 flex items-center gap-2">
              <Activity size={24} />
              Waveform Oscilloscope
            </h2>
            <p className="font-digital text-sm text-slate-400">
              Real-time signal visualization with propagation delays
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* Playback */}
          <div className="flex gap-2 p-1 bg-slate-800/50 rounded-lg border border-slate-700">
            <button
              onClick={() => setPlaying(!playing)}
              className={`p-2 rounded transition-all duration-200 flex items-center gap-2 font-tech ${
                playing
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause size={18} /> : <Play size={18} />}
              {playing ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={handleReset}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
              title="Reset"
            >
              <RotateCcw size={18} />
            </button>
          </div>

          {/* Zoom */}
          <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg border border-slate-700">
            <button
              onClick={handleZoomOut}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
              title="Zoom Out"
            >
              <ZoomOut size={18} />
            </button>
            <div className="px-4 py-2 bg-slate-800 rounded font-digital text-sm text-cyan-400 flex items-center">
              {Math.round(zoom * 100)}%
            </div>
            <button
              onClick={handleZoomIn}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
              title="Zoom In"
            >
              <ZoomIn size={18} />
            </button>
          </div>

          {/* Time display */}
          <div className="ml-auto px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700 font-digital text-sm">
            <span className="text-slate-400">Time:</span>{' '}
            <span className="text-cyan-400">{currentTime}</span>
            <span className="text-slate-500"> / {samples.length - 1}</span>
          </div>
        </div>
      </div>

      {/* Signal selector */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
        <h3 className="font-tech font-semibold text-emerald-400 mb-3">Visible Signals</h3>
        <div className="flex flex-wrap gap-2">
          {[...INPUT_NAMES, ...SEGMENT_NAMES].map((signal) => (
            <button
              key={signal}
              onClick={() => toggleSignal(signal)}
              className={`px-3 py-2 rounded-lg font-digital text-sm transition-all duration-200 ${
                selectedSignals.includes(signal)
                  ? 'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white glow-box-cyan'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
              style={
                selectedSignals.includes(signal)
                  ? { borderLeft: `4px solid ${SIGNAL_COLORS[signal]}` }
                  : {}
              }
            >
              {signal}
            </button>
          ))}
        </div>
      </div>

      {/* Oscilloscope Display */}
      <div className="bg-slate-950 border-2 border-cyan-500/30 rounded-xl overflow-hidden">
        <canvas
          ref={canvasRef}
          width={1200}
          height={Math.max(400, selectedSignals.length * 80)}
          className="w-full"
        />
      </div>

      {/* Status bar */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 flex justify-between items-center font-digital text-xs text-slate-400">
        <span>{selectedSignals.length} signals displayed</span>
        <span>Resolution: {Math.round(zoom * 100)}%</span>
        <span>Simulated propagation: 5ns per gate</span>
      </div>
    </div>
  );
};

export const WaveformViewer = WaveformViewerEnhanced;
