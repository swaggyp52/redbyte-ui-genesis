import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { useLabStore } from '../store/labStore';
import type { ValidationError } from '../validation';

export const ValidationPanel: React.FC = () => {
  const doc = useLabStore((s) => s.doc);
  const validation = (doc.results as any)?.validation;

  if (!validation) {
    return null;
  }

  const { allErrors, canAdvance, message } = validation;
  const hasErrors = allErrors.some(e => e.severity === 'error');
  const blockingErrors = allErrors.filter(e => e.severity === 'error');
  const warnings = allErrors.filter(e => e.severity === 'warning');
  const infos = allErrors.filter(e => e.severity === 'info');

  return (
    <div className="space-y-4">
      {/* Summary Banner */}
      <div className={`border-l-4 rounded-lg p-4 flex items-start gap-3 ${
        hasErrors
          ? 'bg-red-950/50 border-red-500/50'
          : !canAdvance
          ? 'bg-amber-950/50 border-amber-500/50'
          : 'bg-emerald-950/50 border-emerald-500/50'
      }`}>
        <div className="flex-shrink-0 mt-0.5">
          {hasErrors ? (
            <AlertCircle className="w-5 h-5 text-red-400" />
          ) : canAdvance ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          )}
        </div>
        <p className={`font-digital font-medium ${
          hasErrors ? 'text-red-300' : canAdvance ? 'text-emerald-300' : 'text-amber-300'
        }`}>
          {message}
        </p>
      </div>

      {/* Detailed Errors (if any exist) */}
      {allErrors.length > 0 && (
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 space-y-3 max-h-96 overflow-y-auto">
          {blockingErrors.length > 0 && (
            <details open>
              <summary className="cursor-pointer font-tech font-semibold text-red-400 flex items-center gap-2 mb-2">
                <AlertCircle size={16} />
                Errors ({blockingErrors.length})
              </summary>
              <div className="space-y-2 ml-6 pl-4 border-l border-red-500/30">
                {blockingErrors.map((err, i) => (
                  <ErrorItem key={i} error={err} />
                ))}
              </div>
            </details>
          )}

          {warnings.length > 0 && (
            <details>
              <summary className="cursor-pointer font-tech font-semibold text-amber-400 flex items-center gap-2 mb-2">
                <AlertTriangle size={16} />
                Warnings ({warnings.length})
              </summary>
              <div className="space-y-2 ml-6 pl-4 border-l border-amber-500/30">
                {warnings.map((err, i) => (
                  <ErrorItem key={i} error={err} />
                ))}
              </div>
            </details>
          )}

          {infos.length > 0 && (
            <details>
              <summary className="cursor-pointer font-tech font-semibold text-cyan-400 flex items-center gap-2 mb-2">
                <Info size={16} />
                Info ({infos.length})
              </summary>
              <div className="space-y-2 ml-6 pl-4 border-l border-cyan-500/30">
                {infos.map((err, i) => (
                  <ErrorItem key={i} error={err} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Guidance Section */}
      {hasErrors && (
        <div className="bg-red-950/20 border border-red-500/30 rounded-lg p-4">
          <h4 className="font-tech font-semibold text-red-300 mb-2 flex items-center gap-2">
            <AlertCircle size={16} />
            How to Fix
          </h4>
          <ul className="space-y-1 list-disc list-inside font-digital text-sm text-red-200/80">
            <li>Review errors above and fix each mismatch</li>
            <li>Start with the Truth Table — make sure digits 0-9 are correct</li>
            <li>Then create K-map groupings for each segment</li>
            <li>Finally, verify expressions match your groupings</li>
          </ul>
        </div>
      )}

      {/* Advancement Status */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${
            canAdvance ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'
          }`} />
          <p className="font-digital text-sm">
            {canAdvance
              ? '✅ You can advance to the next step!'
              : '❌ Fix blocking errors before you can advance'}
          </p>
        </div>
      </div>
    </div>
  );
};

interface ErrorItemProps {
  error: ValidationError;
}

const ErrorItem: React.FC<ErrorItemProps> = ({ error }) => {
  const severityColor = {
    error: 'text-red-300',
    warning: 'text-amber-300',
    info: 'text-cyan-300',
  }[error.severity];

  const severityBg = {
    error: 'bg-red-950/30',
    warning: 'bg-amber-950/30',
    info: 'bg-cyan-950/30',
  }[error.severity];

  return (
    <div className={`${severityBg} rounded p-2 space-y-1`}>
      <p className={`font-digital font-medium ${severityColor} text-sm`}>
        {error.segment && `[${error.segment.toUpperCase()}]`} {error.message}
      </p>
      {error.guidance && (
        <p className="font-digital text-xs text-slate-400 italic pl-2 border-l border-slate-600">
          💡 {error.guidance}
        </p>
      )}
    </div>
  );
};
