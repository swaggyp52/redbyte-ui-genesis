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
            <SegmentDisplayEnhanced segments={segments} size="large" inputValue={inputValue} />
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

// Enhanced Segment Display Component with Interactive Tooltips
interface SegmentDisplayEnhancedProps {
  segments: [0|1, 0|1, 0|1, 0|1, 0|1, 0|1, 0|1];
  size?: 'small' | 'medium' | 'large';
  inputValue?: number;
}

export const SegmentDisplayEnhanced: React.FC<SegmentDisplayEnhancedProps> = ({ segments, size = 'medium', inputValue = 0 }) => {
  const [hoveredSegment, setHoveredSegment] = React.useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 });
  
  const sizeMap = {
    small: { width: 60, height: 90, stroke: 6 },
    medium: { width: 100, height: 150, stroke: 10 },
    large: { width: 140, height: 210, stroke: 14 },
  };

  const { width, height, stroke } = sizeMap[size];
  const pad = stroke * 2;

  // Segment metadata: position for tooltip, label, and description
  const segmentMetadata = {
    a: { label: 'a', position: 'top', desc: 'Top horizontal segment' },
    b: { label: 'b', position: 'top-right', desc: 'Top-right vertical segment' },
    c: { label: 'c', position: 'bottom-right', desc: 'Bottom-right vertical segment' },
    d: { label: 'd', position: 'bottom', desc: 'Bottom horizontal segment' },
    e: { label: 'e', position: 'bottom-left', desc: 'Bottom-left vertical segment' },
    f: { label: 'f', position: 'top-left', desc: 'Top-left vertical segment' },
    g: { label: 'g', position: 'middle', desc: 'Middle horizontal segment' },
  };

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
  
  // Check if input is in don't-care range (10-15, or A-F in hex)
  const isDontCare = inputValue >= 10 && inputValue <= 15;

  const handleSegmentHover = (name: string, e: React.MouseEvent) => {
    setHoveredSegment(name);
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    setTooltipPos({ x: rect.left, y: rect.top });
  };

  return (
    <div className="relative inline-block">
      {/* Don't-Care Warning */}
      {isDontCare && (
        <div className="absolute inset-0 bg-slate-900/60 rounded-lg flex items-center justify-center z-20 backdrop-blur-sm">
          <div className="text-center">
            <p className="font-tech text-sm text-amber-300 font-semibold">Don't Care Input</p>
            <p className="font-digital text-xs text-amber-200 mt-1">Input {inputValue} ({String.fromCharCode(65 + (inputValue - 10))})</p>
            <p className="font-digital text-xs text-amber-200">No defined output</p>
          </div>
        </div>
      )}
      
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={`filter drop-shadow-lg transition-opacity duration-300 ${isDontCare ? 'opacity-40' : 'opacity-100'}`}
      >
        <defs>
          <filter id="segment-glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="segment-glow-bright">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {segmentNames.map((name, i) => {
          const isOn = segments[i] === 0; // Active-low
          const isHovered = hoveredSegment === name;
          return (
            <g
              key={name}
              onMouseEnter={(e) => handleSegmentHover(name, e)}
              onMouseLeave={() => setHoveredSegment(null)}
              style={{ cursor: 'pointer' }}
            >
              <path
                d={segmentPaths[name]}
                fill={isOn ? '#10b981' : '#1e293b'}
                stroke={isOn ? isHovered ? '#34d399' : '#10b981' : '#334155'}
                strokeWidth={isHovered ? 2 : 1}
                filter={isOn ? isHovered ? 'url(#segment-glow-bright)' : 'url(#segment-glow)' : undefined}
                className={`transition-all duration-150 ${isOn ? 'segment-animate' : ''}`}
                opacity={isOn ? isHovered ? 1 : 0.9 : isHovered ? 0.5 : 0.3}
              />
              {/* Hover highlight overlay */}
              {isHovered && (
                <path
                  d={segmentPaths[name]}
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="2"
                  opacity="0.4"
                  className="animate-pulse"
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Interactive Tooltip */}
      {hoveredSegment && !isDontCare && (
        <div className="absolute bg-slate-950 border border-cyan-500/50 rounded-lg p-3 z-30 shadow-xl whitespace-nowrap text-xs font-digital"
          style={{
            left: `${tooltipPos.x + width / 2 - 50}px`,
            top: `${tooltipPos.y + height + 10}px`,
            minWidth: '120px',
          }}
        >
          <div className="font-tech font-semibold text-cyan-400 mb-1">
            Segment {hoveredSegment.toUpperCase()}
          </div>
          <div className="text-slate-300 text-xs mb-2">
            {segmentMetadata[hoveredSegment as keyof typeof segmentMetadata].desc}
          </div>
          <div className={`font-mono font-bold ${segments[segmentNames.indexOf(hoveredSegment as any)] === 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
            Value: {segments[segmentNames.indexOf(hoveredSegment as any)]}
          </div>
          <div className="text-slate-400 text-xs mt-1">
            {segments[segmentNames.indexOf(hoveredSegment as any)] === 0 ? '✓ Lit' : '✗ Dark'}
          </div>
        </div>
      )}
    </div>
  );
};
