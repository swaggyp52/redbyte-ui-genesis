import React from "react";
import { useLearning } from "../context/LearningContext";

interface LearningOverlayProps {
  stepId: string;
  title: string;
  description: string;
  bullets?: string[];
  ctaLabel?: string;
}

const LearningOverlay: React.FC<LearningOverlayProps> = ({
  stepId,
  title,
  description,
  bullets,
  ctaLabel,
}) => {
  const { completed, completeStep, steps, activeStepId } = useLearning();
  const isDone = completed.has(stepId);
  const isActive = activeStepId === stepId;
  const stepMeta = steps.find((s) => s.id === stepId);

  return (
    <div className="rb-glass border border-slate-800/80 rounded-2xl p-3 flex flex-col gap-2 bg-slate-950/70">
      <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.18em] text-slate-400">
        <span className="px-2 py-1 rounded-xl border border-slate-800/80 bg-slate-900/80">
          Guided step
        </span>
        <span className={isDone ? "text-emerald-300" : "text-slate-500"}>{stepMeta?.targetApp}</span>
        {isActive && !isDone && (
          <span className="text-[0.65rem] text-amber-300">active</span>
        )}
        {isDone && (
          <span className="text-[0.65rem] text-emerald-300">completed</span>
        )}
      </div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm text-slate-100 font-semibold">{title}</h3>
          <p className="text-[0.75rem] text-slate-300 leading-relaxed">{description}</p>
          {bullets && bullets.length > 0 && (
            <ul className="mt-2 space-y-1 text-[0.72rem] text-slate-300 list-disc list-inside">
              {bullets.map((b) => (
                <li key={b} className="text-slate-400">
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="text-right text-[0.7rem] text-slate-400">
          <div className="text-[0.65rem] text-slate-500">Step ID: {stepId}</div>
          <button
            onClick={() => completeStep(stepId)}
            className={`mt-2 px-3 py-1 rounded-xl border text-[0.7rem] ${
              isDone
                ? "border-emerald-500/60 text-emerald-300"
                : "border-sky-500/60 text-sky-300 hover:bg-sky-500/10"
            }`}
          >
            {isDone ? "Mark reviewed" : ctaLabel ?? "Mark step done"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LearningOverlay;
