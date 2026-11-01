import React from 'react';
import type { SubmissionBundleStatusSnapshot } from '../export/submissionBundle';

interface ECELabSubmissionBundleActionProps {
  disabled: boolean;
  isGenerating: boolean;
  status: SubmissionBundleStatusSnapshot | null;
  onGenerate: () => void;
}

export const ECELabSubmissionBundleAction: React.FC<ECELabSubmissionBundleActionProps> = ({
  disabled,
  isGenerating,
  status,
  onGenerate,
}) => (
  <>
    <button
      type="button"
      onClick={onGenerate}
      disabled={disabled || isGenerating}
      className="flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold tracking-wider transition-all border border-transparent hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
      style={{ color: '#e4e4e7' }}
      data-testid="ece-lab-generate-submission-bundle"
      title="Generate deterministic submission bundle"
    >
      {isGenerating ? 'GENERATING…' : 'GENERATE SUBMISSION BUNDLE'}
    </button>
    {status?.filename ? (
      <span
        className={`rounded px-2 py-0.5 text-[9px] font-mono ${
          status.reproducibilityStatus === 'pass'
            ? 'bg-green-500/20 text-green-200'
            : status.reproducibilityStatus === 'fail'
              ? 'bg-yellow-500/20 text-yellow-100'
              : 'bg-slate-700/60 text-slate-300'
        }`}
        data-testid="ece-lab-submission-bundle-status"
        title={status.filename}
      >
        {status.filename}
      </span>
    ) : null}
  </>
);
