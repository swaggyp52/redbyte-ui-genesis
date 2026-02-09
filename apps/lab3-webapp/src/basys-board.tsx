import React from 'react';

interface BasysBoardProps {
  switches: boolean[]; // 4 switches for B3-B0
  segments: [0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1]; // 7 segments
  onSwitchToggle: (index: number) => void;
  inputValue: number;
}

export const BasysBoard: React.FC<BasysBoardProps> = ({ switches, segments, onSwitchToggle, inputValue }) => {
  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-2 border-cyan-500/30 rounded-2xl p-8 glow-box-cyan">
      {/* Board Header */}
      <div className="text-center mb-6">
        <h3 className="font-tech-display text-2xl font-bold text-cyan-400 neon-cyan mb-2">
          Virtual Basys 3 Board
        </h3>
        <p className="font-digital text-sm text-slate-400">
          Digilent Basys 3 Artix-7 FPGA Trainer Board
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

        {/* Right Side: Seven-Segment Display */}
        <div className="bg-slate-950/50 rounded-xl p-6 border border-slate-700">
          <h4 className="font-tech font-semibold text-emerald-400 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Seven-Segment Display
          </h4>
          <div className="flex justify-center items-center h3/4">
            <SegmentDisplayEnhanced segments={segments} size="large" />
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1">
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
        <span>Constraint File: Basys3_Master.xdc</span>
      </div>
    </div>
  );
};

// Enhanced Segment Display Component
interface SegmentDisplayEnhancedProps {
  segments: [0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1];
  size?: 'small' | 'medium' | 'large';
}

export const SegmentDisplayEnhanced: React.FC<SegmentDisplayEnhancedProps> = ({ segments, size = 'medium' }) => {
  const sizeMap = {
    small: { width: 60, height: 90, stroke: 6 },
    medium: { width: 100, height: 150, stroke: 10 },
    large: { width: 140, height: 210, stroke: 14 },
  };

  const { width, height, stroke } = sizeMap[size];
  const pad = stroke * 2;

  // SVG path definitions for each segment (active-low: 0 = lit)
  const segmentPaths = {
    a: `M${pad + 10},${pad} L${width - pad - 10},${pad} L${width - pad - 15},${pad + 8} L${pad + 15},${pad + 8}Z`,
    b: `M${width - pad},${pad + 12} L${width - pad},${height / 2 - 15} L${width - pad - 8},${height / 2 - 10} L${width - pad - 8},${pad + 17}Z`,
    c: `M${width - pad},${height / 2 + 15} L${width - pad},${height - pad - 12} L${width - pad - 8},${height - pad - 17} L${width - pad - 8},${height / 2 + 10}Z`,
    d: `M${pad + 10},${height - pad} L${width - pad - 10},${height - pad} L${width - pad - 15},${height - pad - 8} L${pad + 15},${height - pad - 8}Z`,
    e: `M${pad},${height / 2 + 15} L${pad},${height - pad - 12} L${pad + 8},${height - pad - 17} L${pad + 8},${height / 2 + 10}Z`,
    f: `M${pad},${pad + 12} L${pad},${height / 2 - 15} L${pad + 8},${height / 2 - 10} L${pad + 8},${pad + 17}Z`,
    g: `M${pad + 12},${height / 2} L${width - pad - 12},${height / 2} L${width - pad - 17},${height / 2 - 5} L${width - pad - 17},${height / 2 + 5} L${width - pad - 12},${height / 2 + 10} L${pad + 12},${height / 2 + 10} L${pad + 17},${height / 2 + 5} L${pad + 17},${height / 2 - 5}Z`,
  };

  const segmentNames: (keyof typeof segmentPaths)[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="filter drop-shadow-lg"
    >
      <defs>
        <filter id="segment-glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      {segmentNames.map((name, i) => {
        const isOn = segments[i] === 0; // Active-low
        return (
          <path
            key={name}
            d={segmentPaths[name]}
            fill={isOn ? '#10b981' : '#1e293b'}
            stroke={isOn ? '#10b981' : '#334155'}
            strokeWidth={1}
            filter={isOn ? 'url(#segment-glow)' : undefined}
            className={isOn ? 'segment-animate' : 'transition-all duration-200'}
            opacity={isOn ? 0.9 : 0.3}
          />
        );
      })}
    </svg>
  );
};
