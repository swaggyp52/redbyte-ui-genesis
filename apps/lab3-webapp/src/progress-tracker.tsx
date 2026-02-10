import React from 'react';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';

interface ProgressTrackerProps {
  steps: {
    id: string;
    label: string;
    status: 'complete' | 'in-progress' | 'incomplete' | 'error';
    description?: string;
  }[];
  className?: string;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({ steps, className = '' }) => {
  return (
    <div className={`bg-slate-900/50 border border-slate-700 rounded-xl p-6 ${className}`}>
      <h3 className="font-tech-display text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
        Lab Progress
      </h3>
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          return (
            <div key={step.id} className="relative">
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {step.status === 'complete' && (
                    <CheckCircle2 size={20} className="text-emerald-400" />
                  )}
                  {step.status === 'in-progress' && (
                    <Circle size={20} className="text-cyan-400 animate-pulse" />
                  )}
                  {step.status === 'incomplete' && (
                    <Circle size={20} className="text-slate-600" />
                  )}
                  {step.status === 'error' && (
                    <AlertCircle size={20} className="text-red-400" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className={`font-tech font-semibold text-sm ${
                    step.status === 'complete' ? 'text-emerald-400' :
                    step.status === 'in-progress' ? 'text-cyan-400' :
                    step.status === 'error' ? 'text-red-400' :
                    'text-slate-500'
                  }`}>
                    {step.label}
                  </div>
                  {step.description && (
                    <div className="font-digital text-xs text-slate-500 mt-1">
                      {step.description}
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                {step.status === 'complete' && (
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs font-digital rounded-full border border-emerald-500/30">
                    ✓
                  </span>
                )}
                {step.status === 'in-progress' && (
                  <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs font-digital rounded-full border border-cyan-500/30 pulse-active">
                    ●
                  </span>
                )}
              </div>

              {/* Connecting Line */}
              {!isLast && (
                <div className={`ml-2.5 mt-1 w-0.5 h-6 ${
                  step.status === 'complete' ? 'bg-emerald-400/30' : 'bg-slate-700'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Overall Progress Bar */}
      <div className="mt-6 pt-4 border-t border-slate-700">
        <div className="flex justify-between items-center mb-2">
          <span className="font-digital text-xs text-slate-400">Overall Progress</span>
          <span className="font-tech text-sm font-bold text-cyan-400">
            {Math.round((steps.filter(s => s.status === 'complete').length / steps.length) * 100)}%
          </span>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500 glow-box-cyan"
            style={{
              width: `${(steps.filter(s => s.status === 'complete').length / steps.length) * 100}%`
            }}
          />
        </div>
      </div>
    </div>
  );
};

// Hook to calculate progress
export function useLabProgress() {
  const truthTable = useLabStore((s) => s.doc.truthTable);
  const kMaps = useLabStore((s) => s.doc.kMaps);
  const validationResults = useLabStore((s) => s.validationResults);
  const verilogCode = useLabStore((s) => s.verilogCode);

  // Check if truth table is filled (at least 0-9)
  const truthTableFilled = truthTable
    .slice(0, 10)
    .every(row => row.seg.some(s => s === 0));

  // Check if K-maps exist
  const kMapsGenerated = Object.keys(kMaps).length > 0;

  // Check if simulation passed
  const simulationPassed = validationResults.length > 0 && 
    validationResults.filter(r => r.pass).length >= 10; // At least digits 0-9 correct

  // Check if Verilog exported
  const verilogExported = verilogCode.length > 50;

  const steps = [
    {
      id: 'truth-table',
      label: 'Truth Table',
      status: truthTableFilled ? 'complete' as const : 'incomplete' as const,
      description: truthTableFilled ? 'All standard digits filled' : 'Fill patterns for digits 0-9',
    },
    {
      id: 'kmaps',
      label: 'K-Maps & Simplification',
      status: kMapsGenerated ? 'complete' as const : truthTableFilled ? 'in-progress' as const : 'incomplete' as const,
      description: kMapsGenerated ? 'Boolean expressions generated' : 'Generate K-maps from truth table',
    },
    {
      id: 'simulation',
      label: 'Simulation & Validation',
      status: simulationPassed ? 'complete' as const : kMapsGenerated ? 'in-progress' as const : 'incomplete' as const,
      description: simulationPassed ? `All tests passing` : 'Test all 16 input combinations',
    },
    {
      id: 'export',
      label: 'Export & Documentation',
      status: verilogExported ? 'complete' as const : simulationPassed ? 'in-progress' as const : 'incomplete' as const,
      description: verilogExported ? 'Ready for Vivado' : 'Generate Verilog and PDF report',
    },
  ];

  return steps;
}

// Import useLabStore at top of file
import { useLabStore } from './store/labStore';
