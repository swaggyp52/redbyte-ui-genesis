import React from 'react';
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import type { KMapState, TruthTableRow, ValidationResult } from './types';

export type ProgressStep = {
  id: string;
  label: string;
  status: 'complete' | 'in-progress' | 'incomplete' | 'error';
  description?: string;
  tabId?: string;
  optional?: boolean;
};

interface ProgressTrackerProps {
  steps: ProgressStep[];
  activeStepId?: string;
  nextStepId?: string;
  onStepClick?: (step: ProgressStep) => void;
  className?: string;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  steps,
  activeStepId,
  nextStepId,
  onStepClick,
  className = '',
}) => {
  const totalRequired = steps.filter((step) => !step.optional).length || 1;
  const completedRequired = steps.filter((step) => !step.optional && step.status === 'complete').length;

  return (
    <div className={`bg-slate-900/50 border border-slate-700 rounded-xl p-6 ${className}`}>
      <h3 className="font-tech-display text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
        Lab Progress
      </h3>
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;
          const isActive = activeStepId === step.id;
          const isNext = nextStepId === step.id;
          const isClickable = !!onStepClick && !!step.tabId;
          return (
            <div key={step.id} className="relative">
              <button
                type="button"
                onClick={isClickable ? () => onStepClick?.(step) : undefined}
                className={`w-full text-left flex items-start gap-3 rounded-lg px-2 py-1 transition-all duration-200 ${
                  isClickable ? 'hover:bg-slate-800/60' : ''
                } ${isActive ? 'bg-slate-800/70 ring-1 ring-cyan-500/40' : ''} ${isNext ? 'ring-1 ring-emerald-400/50 pulse-active' : ''}`}
              >
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
                    {step.optional && (
                      <span className="ml-2 text-[10px] text-slate-500 font-digital">optional</span>
                    )}
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
              </button>

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
            {Math.round((completedRequired / totalRequired) * 100)}%
          </span>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500 glow-box-cyan"
            style={{
              width: `${(completedRequired / totalRequired) * 100}%`
            }}
          />
        </div>
      </div>
    </div>
  );
};

export function buildProgressSteps({
  truthTable,
  kMaps,
  validationResults,
  verilogCode,
  lastExportAt,
}: {
  truthTable: TruthTableRow[];
  kMaps: KMapState;
  validationResults: ValidationResult[];
  verilogCode: string;
  lastExportAt?: number;
}) {
  const truthTableFilled = truthTable
    .slice(0, 10)
    .every(row => row.seg.some(s => s === 0));

  const kMapsGenerated = Object.keys(kMaps).length > 0;
  const requiredResults = validationResults.filter((r) => r.input < 10);
  const hasValidation = requiredResults.length > 0;
  const failedRequired = requiredResults.filter((r) => !r.pass);
  const validationStatus = hasValidation
    ? failedRequired.length > 0
      ? 'error'
      : 'complete'
    : kMapsGenerated
      ? 'in-progress'
      : 'incomplete';

  const verilogExported = verilogCode.length > 50;
  const exportComplete = !!lastExportAt;

  const steps: ProgressStep[] = [
    {
      id: 'truth-table',
      label: 'Defined Truth Table (0-9)',
      status: truthTableFilled ? 'complete' : 'incomplete',
      description: truthTableFilled ? 'All standard digits filled' : 'Fill patterns for digits 0-9',
      tabId: 'table',
    },
    {
      id: 'kmaps',
      label: 'Derived K-Maps',
      status: kMapsGenerated ? 'complete' : truthTableFilled ? 'in-progress' : 'incomplete',
      description: kMapsGenerated ? 'Expressions generated' : 'Generate K-maps from truth table',
      tabId: 'kmaps',
    },
    {
      id: 'validation',
      label: 'Validated Vectors',
      status: validationStatus,
      description: hasValidation
        ? failedRequired.length > 0
          ? `${failedRequired.length} vector${failedRequired.length === 1 ? '' : 's'} failed`
          : 'All required vectors correct'
        : 'Run validation in simulator',
      tabId: 'simulator',
    },
    {
      id: 'verilog',
      label: 'Generated Verilog',
      status: verilogExported ? 'complete' : validationStatus === 'complete' ? 'in-progress' : 'incomplete',
      description: verilogExported ? 'Verilog ready to export' : 'Generate expressions or Verilog',
      tabId: 'verilog',
    },
    {
      id: 'export',
      label: 'Exported Circuit',
      status: exportComplete ? 'complete' : 'incomplete',
      description: exportComplete ? 'Export complete' : 'Optional export step',
      tabId: 'export',
      optional: true,
    },
  ];

  const nextStep = steps.find((step) => !step.optional && step.status === 'error')
    ?? steps.find((step) => !step.optional && step.status === 'incomplete')
    ?? steps.find((step) => !step.optional && step.status === 'in-progress');

  return { steps, nextStepId: nextStep?.id };
}

// Hook to calculate progress
export function useLabProgress() {
  const truthTable = useLabStore((s) => s.doc.truthTable);
  const kMaps = useLabStore((s) => s.doc.kMaps);
  const validationResults = useLabStore((s) => s.validationResults);
  const verilogCode = useLabStore((s) => s.verilogCode);
  const lastExportAt = useLabStore((s) => s.lastExportAt);
  return buildProgressSteps({ truthTable, kMaps, validationResults, verilogCode, lastExportAt });
}

// Import useLabStore at top of file
import { useLabStore } from './store/labStore';
