import React from 'react';
import { useLabStore } from './store/labStore';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export const LiveValidation: React.FC = () => {
  const validationErrors = useLabStore((s) => (s.doc.results as any)?.validationErrors || {});
  const booleanExpressions = useLabStore((s) => s.doc.expressions);

  const SEGMENT_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  const hasErrors = Object.keys(validationErrors).length > 0;

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-pink-400">Live Expression Validation</h3>
        {hasErrors ? (
          <div className="flex items-center gap-2 text-pink-400">
            <AlertCircle size={20} />
            <span className="text-sm font-semibold">Mismatches Found</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 size={20} />
            <span className="text-sm font-semibold">All Valid</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {SEGMENT_NAMES.map((segName: string) => {
          const errors = validationErrors[segName] || [];
          const expr = booleanExpressions[segName as keyof typeof booleanExpressions];
          const hasError = errors.length > 0;

          return (
            <div
              key={segName}
              className={`rounded border-2 p-3 transition-all ${hasError
                ? 'bg-pink-900/20 border-pink-600 shadow-lg shadow-pink-600/50'
                : 'bg-slate-700 border-emerald-600'
                }`}
            >
              <div className="text-center mb-2">
                <div className="text-2xl font-bold">{segName.toUpperCase()}</div>
                <div className={`text-xs ${hasError ? 'text-pink-300' : 'text-emerald-300'}`}>
                  {hasError ? '✗' : '✓'}
                </div>
              </div>
              {hasError && (
                <div className="text-xs text-pink-200 space-y-1 mt-2 border-t border-pink-700 pt-2 max-h-24 overflow-y-auto">
                  {errors.slice(0, 3).map((err: string, idx: number) => (
                    <div key={idx} className="font-mono text-pink-100">
                      {err}
                    </div>
                  ))}
                  {errors.length > 3 && (
                    <div className="text-pink-300 mt-1">+{errors.length - 3} more</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasErrors && (
        <div className="bg-pink-900/20 border border-pink-700 rounded p-3 text-sm text-pink-200">
          <p className="font-semibold mb-1">Validation Issues:</p>
          <p className="text-xs text-pink-100">
            Your boolean expressions don't match the truth table for inputs 0–9. Check the highlighted segments and
            update your expressions. These issues block you from exporting to Verilog until resolved.
          </p>
        </div>
      )}
    </div>
  );
};
