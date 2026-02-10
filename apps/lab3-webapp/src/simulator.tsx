import React, { useState, useEffect } from 'react';
import { useLabStore } from './store/labStore';
import { BasysBoard } from './basys-board';
import { BasysBoardMulti } from './basys-board-multi';
import { Play, Pause, SkipForward, RotateCcw, CheckCircle2, AlertCircle, LayoutGrid } from 'lucide-react';

export const Simulator: React.FC = () => {
  const simulationInput = useLabStore((s) => s.simulationInput);
  const setSimulationInput = useLabStore((s) => s.setSimulationInput);
  const runAllVectors = useLabStore((s) => s.runAllVectors);
  const evalSeg = useLabStore((s) => s.evalSeg);
  const validationResults = useLabStore((s) => s.validationResults);
  const [isAnimating, setIsAnimating] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [multiDigitMode, setMultiDigitMode] = useState(false);
  const [showFailures, setShowFailures] = useState(false);

  const currentOutput = evalSeg(simulationInput);
  const currentSeg: [0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1] = [
    ((currentOutput >> 0) & 1) as 0 | 1,
    ((currentOutput >> 1) & 1) as 0 | 1,
    ((currentOutput >> 2) & 1) as 0 | 1,
    ((currentOutput >> 3) & 1) as 0 | 1,
    ((currentOutput >> 4) & 1) as 0 | 1,
    ((currentOutput >> 5) & 1) as 0 | 1,
    ((currentOutput >> 6) & 1) as 0 | 1,
  ];

  const switches = [
    ((simulationInput >> 0) & 1) === 1,
    ((simulationInput >> 1) & 1) === 1,
    ((simulationInput >> 2) & 1) === 1,
    ((simulationInput >> 3) & 1) === 1,
  ];

  const handleSwitchToggle = (bit: number) => {
    setIsAnimating(true);
    const newVal = ((simulationInput >> bit) & 1) === 1 
      ? simulationInput & ~(1 << bit) 
      : simulationInput | (1 << bit);
    setSimulationInput(newVal);
    setTimeout(() => setIsAnimating(false), 200);
  };

  const handleNext = () => {
    setIsAnimating(true);
    const nextVal = (simulationInput + 1) % 16;
    setSimulationInput(nextVal);
    setTimeout(() => setIsAnimating(false), 200);
  };

  const handleReset = () => {
    setIsAnimating(true);
    setSimulationInput(0);
    setTimeout(() => setIsAnimating(false), 200);
  };

  // Auto-run functionality
  useEffect(() => {
    if (autoRunning) {
      const interval = setInterval(() => {
        setSimulationInput((simulationInput + 1) % 16);
      }, 800);
      return () => clearInterval(interval);
    }
  }, [autoRunning, setSimulationInput, simulationInput]);

  const requiredResults = validationResults.filter((r) => r.input < 10);
  const passCount = requiredResults.filter((r) => r.pass).length;
  const failedResults = requiredResults.filter((r) => !r.pass);
  const hasRun = validationResults.length > 0;
  const allPassed = hasRun && requiredResults.length > 0 && passCount === requiredResults.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-tech-display text-2xl font-bold text-cyan-400 neon-cyan mb-2">
              Interactive Simulator
            </h2>
            <p className="font-digital text-sm text-slate-400">
              Test your seven-segment logic with animated signal propagation
            </p>
          </div>
          <button
            onClick={() => setMultiDigitMode(!multiDigitMode)}
            className={`px-4 py-2 rounded-lg font-tech font-semibold transition-all duration-200 flex items-center gap-2 ${
              multiDigitMode
                ? 'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white glow-box-cyan'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="Toggle 4-digit multiplexed display"
          >
            <LayoutGrid size={18} />
            {multiDigitMode ? '4-Digit Mode' : 'Single Digit'}
          </button>
        </div>
      </div>

      {/* Virtual Board */}
      {multiDigitMode ? (
        <BasysBoardMulti
          switches={switches}
          segments={currentSeg}
          onSwitchToggle={handleSwitchToggle}
          inputValue={simulationInput}
          enableMultiplexing={true}
        />
      ) : (
        <BasysBoard 
          switches={switches}
          segments={currentSeg}
          onSwitchToggle={handleSwitchToggle}
          inputValue={simulationInput}
        />
      )}

      {/* Control Panel */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
        <h3 className="font-tech font-semibold text-emerald-400 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Simulation Controls
        </h3>
        
        <div className="grid md:grid-cols-2 gap-4">
          {/* Manual Controls */}
          <div className="space-y-3">
            <div className="text-sm font-digital text-slate-400 mb-2">Manual Control:</div>
            <div className="flex gap-2">
              <button
                onClick={() => setAutoRunning(!autoRunning)}
                className={`flex-1 py-3 px-4 rounded-lg font-tech font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                  autoRunning
                    ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white glow-box-amber'
                    : 'bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white glow-box-cyan'
                }`}
                title={autoRunning ? 'Pause auto-increment' : 'Auto-increment through inputs'}
              >
                {autoRunning ? <><Pause size={18} /> Pause</> : <><Play size={18} /> Auto Run</>}
              </button>
              <button
                onClick={handleNext}
                disabled={autoRunning}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-tech font-semibold transition-all duration-200 flex items-center gap-2"
                title="Next input (+1)"
              >
                <SkipForward size={18} />
              </button>
              <button
                onClick={handleReset}
                disabled={autoRunning}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-tech font-semibold transition-all duration-200 flex items-center gap-2"
                title="Reset to 0"
              >
                <RotateCcw size={18} />
              </button>
            </div>
          </div>

          {/* Validation Test */}
          <div className="space-y-3">
            <div className="text-sm font-digital text-slate-400 mb-2">Full Validation:</div>
            <button
              onClick={runAllVectors}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-tech font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 glow-box-emerald"
            title="Test all 16 input combinations"
            >
              <Play size={18} />
              Run All 16 Tests
            </button>
          </div>
        </div>
      </div>

      {/* Validation Results */}
      {hasRun && (
        <div className={`border rounded-xl p-6 ${
          allPassed 
            ? 'bg-emerald-950/30 border-emerald-500/30' 
            : 'bg-red-950/30 border-red-500/30'
        }`}>
          <div className="flex items-center justify-between gap-3 mb-4">
            {allPassed ? (
              <>
                <CheckCircle2 size={24} className="text-emerald-400" />
                <div>
                  <h3 className="font-tech-display text-lg font-bold text-emerald-400">
                    ✓ {passCount}/{requiredResults.length} vectors correct
                  </h3>
                  <p className="font-digital text-sm text-emerald-300">
                    All required vectors (0-9) are correct
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle size={24} className="text-red-400" />
                <div>
                  <h3 className="font-tech-display text-lg font-bold text-red-400">
                    ✓ {passCount}/{requiredResults.length} vectors correct — {failedResults.length} failed
                  </h3>
                  <p className="font-digital text-sm text-red-300">
                    Click to view failed cases
                  </p>
                </div>
              </>
            )}
            {!allPassed && failedResults.length > 0 && (
              <button
                onClick={() => setShowFailures((prev) => !prev)}
                className="px-3 py-1.5 rounded-md text-xs font-tech font-semibold bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-all"
              >
                {showFailures ? 'Hide failures' : 'View failures'}
              </button>
            )}
          </div>

          {failedResults.length > 0 && showFailures && (
            <div className="mb-4 space-y-2">
              {failedResults.map((r) => {
                const inputBits = r.input.toString(2).padStart(4, '0');
                const expectedBits = r.expected.toString(2).padStart(7, '0');
                const actualBits = r.actual.toString(2).padStart(7, '0');
                const mismatch = r.mismatchSegments?.length
                  ? r.mismatchSegments.join(', ')
                  : 'Unknown';
                return (
                  <div
                    key={r.input}
                    className="bg-red-950/40 border border-red-500/30 rounded-lg px-4 py-3"
                  >
                    <div className="font-tech text-sm text-red-300">
                      ❌ Input: {inputBits}
                    </div>
                    <div className="font-digital text-xs text-red-200/80 mt-1">
                      Expected: {expectedBits} | Got: {actualBits}
                    </div>
                    <div className="font-digital text-xs text-red-200/80 mt-1">
                      Mismatch: {mismatch}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Results Grid */}
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {validationResults.map((r, i) => (
              <div
                key={i}
                className={`p-2 rounded-lg text-center font-digital text-sm transition-all duration-200 ${
                  r.pass
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
                title={r.pass ? `Input ${i}: Correct` : `Input ${i}: Expected ${r.expected}, got ${r.actual}`}
              >
                {i}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
