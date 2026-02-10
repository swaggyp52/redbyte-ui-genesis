import React, { useState } from 'react';
import { useLabStore } from './store/labStore';
import { ChevronDown } from 'lucide-react';

const SEGMENT_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;

const GRAY_CODE_LABELS = {
  rows: ['00', '01', '11', '10'], // B3B2
  cols: ['00', '01', '11', '10'], // B1B0
};

function getPositionToGrayCode(row: number, col: number): string {
  return `${GRAY_CODE_LABELS.rows[row]}${GRAY_CODE_LABELS.cols[col]}`;
}

export const KMapViewer: React.FC = () => {
  const [expandedSegment, setExpandedSegment] = useState<string>('a');
  const kMaps = useLabStore((s) => s.doc.kMaps);
  const setBooleanExpr = useLabStore((s) => s.setBooleanExpr);
  const booleanExpressions = useLabStore((s) => s.doc.expressions);

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-emerald-400">Karnaugh Maps</h3>
      </div>

      <div className="space-y-3">
        {SEGMENT_NAMES.map((segName) => (
          <KMapSegment
            key={segName}
            segmentName={segName}
            isExpanded={expandedSegment === segName}
            onToggle={() => setExpandedSegment(expandedSegment === segName ? '' : segName)}
            kmap={kMaps[segName as keyof typeof kMaps]}
            expr={booleanExpressions[segName as keyof typeof booleanExpressions]}
            onExprChange={(newExpr) => setBooleanExpr(segName, newExpr)}
          />
        ))}
      </div>
    </div>
  );
};

interface KMapSegmentProps {
  segmentName: string;
  isExpanded: boolean;
  onToggle: () => void;
  kmap: any; // K-map grid and metadata for this segment
  expr: string;
  onExprChange: (expr: string) => void;
}

const KMapSegment: React.FC<KMapSegmentProps> = ({ segmentName, isExpanded, onToggle, kmap, expr, onExprChange }) => {
  return (
    <div className="bg-slate-800 rounded border border-slate-700 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700 transition-colors font-semibold"
      >
        <span className="text-lg">Segment {segmentName.toUpperCase()}</span>
        <ChevronDown size={20} style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
      </button>

      {isExpanded && (
        <div className="border-t border-slate-700 p-4 space-y-4">
          {/* K-Map Grid */}
          <div className="inline-flex gap-4">
            <div>
              <div className="text-xs text-slate-400 ml-6 mb-1">B1 B0</div>
              <div className="grid gap-1" style={{ gridTemplateColumns: 'auto repeat(4, 1fr)' }}>
                {/* Top label */}
                <div />
                {GRAY_CODE_LABELS.cols.map((col) => (
                  <div key={col} className="text-xs text-slate-400 text-center font-mono w-8">
                    {col}
                  </div>
                ))}

                {/* Rows with left labels */}
                {GRAY_CODE_LABELS.rows.map((row, rowIdx) => (
                  <React.Fragment key={row}>
                    <div className="text-xs text-slate-400 text-right font-mono w-6">B3B2 {row}</div>
                    {GRAY_CODE_LABELS.cols.map((col, colIdx) => {
                      const gridIndex = rowIdx * 4 + colIdx;
                      const cellValue = kmap.grid[gridIndex];
                      const cellLabel = getPositionToGrayCode(rowIdx, colIdx);

                      const bgColor =
                        cellValue === 1
                          ? 'bg-emerald-600/40 border-emerald-500'
                          : cellValue === 'X'
                            ? 'bg-slate-700 border-slate-600'
                            : 'bg-slate-700 border-slate-600';

                      return (
                        <div
                          key={`${row}-${col}`}
                          className={`w-8 h-8 flex items-center justify-center border ${bgColor} rounded text-xs font-bold cursor-default transition-colors hover:border-emerald-400`}
                          title={`Input: ${cellLabel}`}
                        >
                          {cellValue === 'X' ? '—' : cellValue}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="text-xs text-slate-400 space-y-2 flex flex-col justify-center">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-emerald-600/40 border border-emerald-500 rounded" />
                <span>Minterm (1)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-slate-700 border border-slate-600 rounded" />
                <span>Zero or Don't-Care</span>
              </div>
            </div>
          </div>

          {/* Simplified Expression */}
          <div className="bg-slate-900 rounded p-3">
            <label className="block text-sm text-slate-300 mb-2">Simplified Boolean Expression:</label>
            <input
              type="text"
              value={expr}
              onChange={(e) => onExprChange(e.target.value)}
              className="w-full bg-slate-800 text-slate-50 border border-slate-700 rounded px-3 py-2 font-mono text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              placeholder="e.g., B3 + B2·B1 (use · for AND, + for OR, ' for NOT)"
            />
            <p className="text-xs text-slate-400 mt-2">
              Format: Use B3, B2, B1, B0 for inputs; · for AND; + for OR; ' for NOT
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
