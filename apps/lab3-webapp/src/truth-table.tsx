import React from 'react';
import { useLabStore } from './store';
import { SegmentDisplayEnhanced } from './basys-board';
import { Zap, RefreshCw, Info } from 'lucide-react';

export const TruthTableEditor: React.FC = () => {
  const truthTable = useLabStore((s) => s.truthTable);
  const setTableRow = useLabStore((s) => s.setTableRow);
  const toggleDontCare = useLabStore((s) => s.toggleDontCare);
  const fillStandardDigits = useLabStore((s) => s.fillStandardDigits);
  const [selectedRow, setSelectedRow] = React.useState(0);

  const selectedSeg = truthTable[selectedRow]?.seg || [1, 1, 1, 1, 1, 1, 1];

  const toggleSegment = (segIndex: number) => {
    const row = truthTable[selectedRow]!;
    const newSeg = [...row.seg] as [0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1, 0 | 1];
    newSeg[segIndex] = newSeg[segIndex] === 0 ? 1 : 0;
    setTableRow(selectedRow, { seg: newSeg });
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-tech-display text-2xl font-bold text-cyan-400 neon-cyan mb-2">
              Truth Table Editor
            </h2>
            <p className="font-digital text-sm text-slate-400">
              Define segment patterns for each 4-bit input (0-15)
            </p>
          </div>
          <button
            onClick={fillStandardDigits}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-tech font-semibold rounded-lg transition-all duration-200 flex items-center gap-2 glow-box-emerald group"
          >
            <Zap size={18} className="group-hover:animate-pulse" />
            Auto-Fill (0-9)
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 flex items-start gap-3">
          <Info size={20} className="text-cyan-400 flex-shrink-0 mt-0.5" />
          <div className="font-digital text-sm text-cyan-300">
            <strong>Active-Low Logic:</strong> Segments light when set to <code className="bg-slate-800 px-1 py-0.5 rounded">0</code>.
            Use "Auto-Fill" to populate standard digit patterns (0-9), then customize as needed.
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Input Selector */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
          <h3 className="font-tech font-semibold text-emerald-400 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Select Input (0-15)
          </h3>
          <div className="grid grid-cols-4 gap-2 mb-6">
            {truthTable.map((row, i) => (
              <button
                key={i}
                onClick={() => setSelectedRow(i)}
                className={`py-3 px-4 rounded-lg font-tech-display font-bold text-lg transition-all duration-200 ${
                  selectedRow === i 
                    ? 'bg-gradient-to-br from-cyan-500 to-cyan-600 text-white glow-box-cyan shadow-lg scale-105' 
                    : row.seg.some(s => s === 0)
                    ? 'bg-slate-800 text-emerald-400 hover:bg-slate-750 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                }`}
                title={`Input ${i}: ${row.b3}${row.b2}${row.b1}${row.b0}`}
              >
                {i}
              </button>
            ))}
          </div>

          {/* Don't Care Toggle */}
          <label className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
            <input
              type="checkbox"
              checked={truthTable[selectedRow]?.isDontCare || false}
              onChange={() => toggleDontCare(selectedRow)}
              className="w-5 h-5 rounded accent-amber-500"
            />
            <div className="flex-1">
              <span className="font-tech font-semibold text-amber-400">
                Don't Care State
              </span>
              <p className="font-digital text-xs text-slate-500 mt-1">
                Mark unused inputs (10-15) as don't-care for simplification
              </p>
            </div>
          </label>

          {/* Current Input Display */}
          <div className="mt-6 p-4 bg-slate-950/50 rounded-lg border border-slate-700">
            <div className="font-digital text-xs text-slate-400 mb-2">Current Input:</div>
            <div className="flex items-center gap-3">
              <span className="font-tech-display text-3xl font-bold text-cyan-400 neon-cyan">
                {selectedRow}
              </span>
              <span className="font-digital text-slate-500">
                = {truthTable[selectedRow]?.b3}{truthTable[selectedRow]?.b2}{truthTable[selectedRow]?.b1}{truthTable[selectedRow]?.b0}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Segment Editor */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
          <h3 className="font-tech font-semibold text-emerald-400 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Segment Pattern
          </h3>

          {/* Live Preview */}
          <div className="flex justify-center mb-6 p-6 bg-slate-950/50 rounded-lg">
            <SegmentDisplayEnhanced segments={selectedSeg as any} size="large" />
          </div>

          {/* Segment Toggles */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((seg, i) => (
              <button
                key={seg}
                onClick={() => toggleSegment(i)}
                className={`py-6 rounded-lg font-tech-display font-bold transition-all duration-200 ${
                  selectedSeg[i] === 0
                    ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white glow-box-emerald shadow-lg'
                    : 'bg-slate-800 text-slate-500 hover:bg-slate-700 border border-slate-600'
                }`}
                title={`Toggle segment ${seg.toUpperCase()} (${selectedSeg[i] === 0 ? 'ON' : 'OFF'})`}
              >
                <div className="text-xl">{seg}</div>
                <div className="text-xs mt-1 opacity-75">
                  {selectedSeg[i] === 0 ? '0' : '1'}
                </div>
              </button>
            ))}
          </div>

          {/* Binary Display */}
          <div className="p-4 bg-slate-950/50 rounded-lg border border-slate-700">
            <div className="font-digital text-xs text-slate-400 mb-2">Active-Low Binary:</div>
            <code className="font-digital text-emerald-400 text-lg">
              {selectedSeg.map(s => s === 0 ? '0' : '1').join('')}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
};
