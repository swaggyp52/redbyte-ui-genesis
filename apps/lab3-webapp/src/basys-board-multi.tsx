import React, { useState, useEffect } from 'react';
import { SegmentDisplayEnhanced } from './basys-board';

interface BasysBoardMultiProps {
  switches: boolean[]; // 4 switches for B3-B0
  segments: [0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1]; // 7 segments for current digit
  onSwitchToggle: (index: number) => void;
  inputValue: number;
  enableMultiplexing?: boolean;
}

export const BasysBoardMulti: React.FC<BasysBoardMultiProps> = ({ 
  switches, 
  segments, 
  onSwitchToggle, 
  inputValue,
  enableMultiplexing = true 
}) => {
  const [activeDigit, setActiveDigit] = useState(0);
  const [anodeControl, setAnodeControl] = useState([false, false, false, true]); // AN3-AN0 (active-low)

  // Simulate multiplexing at 1kHz per digit (1ms scan time)
  useEffect(() => {
    if (!enableMultiplexing) {
      setAnodeControl([false, false, false, true]); // Only rightmost digit active
      return;
    }

    const interval = setInterval(() => {
      setActiveDigit((prev) => {
        const next = (prev + 1) % 4;
        // Update anode control (active-low: false = ON)
        const newAnode = [true, true, true, true];
        newAnode[3 - next] = false; // AN3 controls digit 0 (leftmost), AN0 controls digit 3 (rightmost)
        setAnodeControl(newAnode);
        return next;
      });
    }, 1); // 1ms per digit = 4ms full cycle = 250Hz refresh rate

    return () => clearInterval(interval);
  }, [enableMultiplexing]);

  // Convert input value to 4-digit hex display
  const hexDigits = [
    (inputValue >> 12) & 0xF, // Digit 0 (leftmost)
    (inputValue >> 8) & 0xF,  // Digit 1
    (inputValue >> 4) & 0xF,  // Digit 2
    inputValue & 0xF,          // Digit 3 (rightmost)
  ];

  // Hex to 7-segment encoding (active-low)
  const hexToSegments = (value: number): [0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1] => {
    const patterns: Record<number, [0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1]> = {
      0: [0, 0, 0, 0, 0, 0, 1], // 0
      1: [1, 0, 0, 1, 1, 1, 1], // 1
      2: [0, 0, 1, 0, 0, 1, 0], // 2
      3: [0, 0, 0, 0, 1, 1, 0], // 3
      4: [1, 0, 0, 1, 1, 0, 0], // 4
      5: [0, 1, 0, 0, 1, 0, 0], // 5
      6: [0, 1, 0, 0, 0, 0, 0], // 6
      7: [0, 0, 0, 1, 1, 1, 1], // 7
      8: [0, 0, 0, 0, 0, 0, 0], // 8
      9: [0, 0, 0, 0, 1, 0, 0], // 9
      0xA: [0, 0, 0, 1, 0, 0, 0], // A
      0xB: [1, 1, 0, 0, 0, 0, 0], // b
      0xC: [0, 1, 1, 0, 0, 0, 1], // C
      0xD: [1, 0, 0, 0, 0, 1, 0], // d
      0xE: [0, 1, 1, 0, 0, 0, 0], // E
      0xF: [0, 1, 1, 1, 0, 0, 0], // F
    };
    return patterns[value] || [1, 1, 1, 1, 1, 1, 1]; // All off for invalid
  };

  // For Lab 3, we show the single-digit output on rightmost display
  const displaySegments = [
    [1, 1, 1, 1, 1, 1, 1] as [0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1], // Digit 0: blank
    [1, 1, 1, 1, 1, 1, 1] as [0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1], // Digit 1: blank
    [1, 1, 1, 1, 1, 1, 1] as [0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1], // Digit 2: blank
    segments, // Digit 3: active segment output
  ];

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-cyan-500/30 rounded-2xl p-8 glow-box-cyan">
      {/* Board Header */}
      <div className="text-center mb-6">
        <h3 className="font-tech-display text-2xl font-bold text-cyan-400 neon-cyan mb-2">
          Virtual Basys 3 Board
        </h3>
        <p className="font-digital text-sm text-slate-400">
          Digilent Basys 3 Artix-7 FPGA Trainer Board - 4-Digit Multiplexed Display
        </p>
      </div>

      {/* Board Layout */}
      <div className="grid grid-cols-2 gap-8">
        {/* Left Side: Input Switches */}
        <div className="bg-slate-950/50 rounded-xl p-6 border border-slate-700">
          <h4 className="font-tech font-semibold text-emerald-400 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Input Switches (SW3-SW0)
          </h4>
          <div className="space-y-3">
            {[3, 2, 1, 0].map((bit) => (
              <div key={bit} className="flex items-center gap-4">
                <span className="font-digital text-slate-400 w-12">{`SW${bit}`}</span>
                <button
                  onClick={() => onSwitchToggle(bit)}
                  className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                    switches[bit]
                      ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 glow-box-cyan'
                      : 'bg-slate-700'
                  }`}
                  title={`Toggle B${bit}`}
                >
                  <div
                    className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-lg transition-all duration-300 ${
                      switches[bit] ? 'left-9' : 'left-1'
                    }`}
                  />
                </button>
                <span className={`font-digital font-bold text-lg ${switches[bit] ? 'text-cyan-400 neon-cyan' : 'text-slate-600'}`}>
                  {switches[bit] ? '1' : '0'}
                </span>
                <span className="font-mono text-xs text-slate-500">{`B${bit}`}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-slate-700">
            <div className="flex justify-between items-center">
              <span className="font-digital text-slate-400">Decimal Value:</span>
              <span className="font-tech-display text-3xl font-bold text-cyan-400 neon-cyan">
                {inputValue}
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Four Seven-Segment Displays */}
        <div className="bg-slate-950/50 rounded-xl p-6 border border-slate-700">
          <h4 className="font-tech font-semibold text-emerald-400 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Seven-Segment Display Array
          </h4>
          
          {/* 4-Digit Display */}
          <div className="flex justify-center items-center gap-4 mb-4">
            {displaySegments.map((segs, digitIdx) => {
              const isActive = !anodeControl[3 - digitIdx]; // Active-low anode
              return (
                <div 
                  key={digitIdx} 
                  className={`transition-opacity duration-100 ${
                    isActive ? 'opacity-100' : 'opacity-20'
                  }`}
                  style={{
                    filter: isActive ? 'brightness(1)' : 'brightness(0.3)',
                  }}
                >
                  <SegmentDisplayEnhanced segments={segs} size="medium" inputValue={digitIdx === 3 ? inputValue : -1} />
                  <div className="text-center mt-2">
                    <span className="font-digital text-xs text-slate-500">
                      AN{3 - digitIdx}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Anode Control Indicators */}
          <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="font-digital text-xs text-slate-400">Anode Select (Active-Low)</span>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={enableMultiplexing}
                  onChange={(e) => {
                    // This would need to be passed as prop for external control
                    // For now it's controlled by component state
                  }}
                  className="w-4 h-4"
                  disabled
                />
                <span className="font-digital text-xs text-slate-400">Multiplexing</span>
              </label>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[3, 2, 1, 0].map((an) => (
                <div key={an} className="text-center">
                  <div
                    className={`w-full h-3 rounded-sm mb-1 transition-all duration-100 ${
                      !anodeControl[an]
                        ? 'bg-cyan-400 glow-box-cyan'
                        : 'bg-slate-800'
                    }`}
                  />
                  <span className="font-digital text-xs text-slate-500">AN{an}</span>
                  <div className="font-digital text-xs text-slate-400 mt-1">
                    {anodeControl[an] ? '1' : '0'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Segment State Indicators */}
          <div className="mt-3 grid grid-cols-7 gap-1">
            {['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((seg, i) => (
              <div key={seg} className="text-center">
                <div
                  className={`w-full h-2 rounded-sm mb-1 transition-all duration-200 ${
                    segments[i] === 0
                      ? 'bg-emerald-400 glow-box-emerald segment-animate'
                      : 'bg-slate-800'
                  }`}
                />
                <span className="font-digital text-xs text-slate-500">{seg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Board Info Footer */}
      <div className="mt-6 pt-4 border-t border-slate-700 flex justify-between items-center text-xs font-digital text-slate-500">
        <span>Active-Low Logic (0 = ON, 1 = OFF)</span>
        <span>Multiplexing: {enableMultiplexing ? '250Hz refresh (1ms/digit)' : 'Static'}</span>
        <span>Constraint File: Basys3_Master.xdc</span>
      </div>

      {/* Technical Info */}
      <div className="mt-3 p-3 bg-slate-900/30 rounded-lg border border-slate-700/50">
        <div className="grid grid-cols-3 gap-4 text-xs font-digital text-slate-400">
          <div>
            <span className="text-slate-500">Active Digit:</span>{' '}
            <span className="text-cyan-400">{activeDigit}</span>
          </div>
          <div>
            <span className="text-slate-500">Scan Rate:</span>{' '}
            <span className="text-emerald-400">{enableMultiplexing ? '250Hz' : 'Static'}</span>
          </div>
          <div>
            <span className="text-slate-500">Persistence:</span>{' '}
            <span className="text-amber-400">4ms cycle</span>
          </div>
        </div>
      </div>
    </div>
  );
};
