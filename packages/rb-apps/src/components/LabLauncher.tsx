import React from 'react';
import { LAB_DEFINITIONS } from '../labs/labDefinitions';

type LabStatus = 'completed' | 'active' | 'upcoming';

interface LabCardProps {
  lab: (typeof LAB_DEFINITIONS)[number];
  status: LabStatus;
  onOpen: (labId: string) => void;
}

const STATUS_CONFIG: Record<LabStatus, { label: string; className: string; dot: string }> = {
  completed: {
    label: 'COMPLETED',
    className: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10',
    dot: 'bg-emerald-400',
  },
  active: {
    label: 'ACTIVE',
    className: 'text-red-400 border-red-400/30 bg-red-400/10 animate-pulse',
    dot: 'bg-red-400 animate-pulse',
  },
  upcoming: {
    label: 'UPCOMING',
    className: 'text-zinc-500 border-zinc-700 bg-zinc-800/50',
    dot: 'bg-zinc-600',
  },
};

const LabCard: React.FC<LabCardProps> = ({ lab, status, onOpen }) => {
  const cfg = STATUS_CONFIG[status];
  return (
    <div
      className={[
        'group relative flex flex-col gap-3 rounded-xl border p-5 transition-all duration-200 cursor-pointer',
        status === 'upcoming'
          ? 'border-zinc-800 bg-zinc-900/60 opacity-70 hover:opacity-90'
          : 'border-zinc-700 bg-zinc-900 hover:border-red-500/50 hover:shadow-[0_0_24px_rgba(255,45,45,0.12)]',
      ].join(' ')}
      onClick={() => onOpen(lab.id)}
    >
      {/* Lab number */}
      <span className="text-xs font-mono text-zinc-600 tracking-widest uppercase">
        Lab {lab.id.replace('lab-', '')}
      </span>

      {/* Title */}
      <h3 className="text-base font-semibold text-zinc-100 leading-tight">{lab.title}</h3>

      {/* Description */}
      <p className="text-sm text-zinc-400 leading-snug flex-1">{lab.learningGoal}</p>

      {/* Footer row */}
      <div className="flex items-center justify-between mt-1">
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider px-2 py-0.5 rounded border ${cfg.className}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
        <span className="text-xs text-zinc-600">{lab.timeEstimate}</span>
      </div>

      {/* Hover CTA */}
      <button
        className={[
          'absolute inset-x-5 bottom-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150',
          'opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0',
          status === 'upcoming'
            ? 'bg-zinc-800 text-zinc-400'
            : 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_12px_rgba(255,45,45,0.4)]',
        ].join(' ')}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(lab.id);
        }}
      >
        Open Lab &rarr;
      </button>
    </div>
  );
};

export interface LabLauncherProps {
  /** Map of labId to status. Defaults to 'upcoming' for unlisted labs. */
  labStatuses?: Partial<Record<string, LabStatus>>;
  onOpenLab: (labId: string) => void;
}

export const LabLauncher: React.FC<LabLauncherProps> = ({ labStatuses = {}, onOpenLab }) => {
  return (
    <div
      className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col"
      style={{
        backgroundImage: `radial-gradient(circle at 50% 0%, rgba(255,45,45,0.06) 0%, transparent 60%),
          linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
        backgroundSize: '100% 100%, 40px 40px, 40px 40px',
      }}
    >
      {/* Header */}
      <header className="flex flex-col items-center pt-16 pb-10 px-8 gap-3">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-md bg-red-600 flex items-center justify-center shadow-[0_0_16px_rgba(255,45,45,0.6)]">
            <span className="text-white font-bold text-sm">RB</span>
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">RedByte</span>
        </div>
        <p className="text-zinc-400 text-sm tracking-wide">
          ECE348 / GECE598 &mdash; Digital Logic &amp; FPGA Design
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-zinc-600">
          <span className="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900">
            Basys3
          </span>
          <span className="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900">
            VHDL
          </span>
          <span className="px-2 py-0.5 rounded border border-zinc-800 bg-zinc-900">
            Labs 1&ndash;8
          </span>
        </div>
      </header>

      {/* Lab grid */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-8 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {LAB_DEFINITIONS.filter((l) => l.id !== 'freeplay').map((lab) => (
            <LabCard
              key={lab.id}
              lab={lab}
              status={labStatuses[lab.id] ?? 'upcoming'}
              onOpen={onOpenLab}
            />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center pb-8 text-xs text-zinc-700">
        redbyteapps.dev &mdash; select a lab to begin
      </footer>
    </div>
  );
};
