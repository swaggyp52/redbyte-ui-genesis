import React from 'react';

interface WindowProps {
  id: string;
  title: string;
  iconEmoji?: string;
  offset?: number;
  focused?: boolean;
  onClose: () => void;
  onFocus: () => void;
  children: React.ReactNode;
}

export function Window(props: WindowProps) {
  const { id, title, iconEmoji, offset = 0, focused, onClose, onFocus, children } = props;

  const top = 80 + offset * 26;
  const left = 120 + offset * 32;

  return (
    <div
      onMouseDown={onFocus}
      className={
        'absolute rounded-2xl border shadow-xl bg-slate-900/95 backdrop-blur overflow-hidden transition-all ' +
        (focused
          ? 'border-emerald-400/70 shadow-emerald-500/30'
          : 'border-white/10 shadow-black/60 opacity-90')
      }
      style={{
        top,
        left,
        width: 520,
        maxWidth: 'calc(100% - 120px)',
        height: 320,
      }}
      data-window-id={id}
    >
      {/* Title bar */}
      <div className='h-9 flex items-center justify-between px-3 border-b border-white/10 bg-slate-950/80'>
        <div className='flex items-center gap-2'>
          <div className='flex gap-1.5 mr-2'>
            <span className='h-2.5 w-2.5 rounded-full bg-rose-500' />
            <span className='h-2.5 w-2.5 rounded-full bg-amber-400' />
            <span className='h-2.5 w-2.5 rounded-full bg-emerald-400' />
          </div>
          {iconEmoji && (
            <span className='text-sm mr-1' aria-hidden='true'>
              {iconEmoji}
            </span>
          )}
          <span className='text-xs font-medium text-slate-100 truncate'>{title}</span>
        </div>
        <button
          onClick={onClose}
          className='text-[11px] px-2 py-0.5 rounded-full bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white transition-colors'
        >
          Close
        </button>
      </div>

      {/* Content */}
      <div className='w-full h-[calc(100%-2.25rem)] p-3 text-xs text-slate-100 overflow-auto bg-gradient-to-br from-slate-900/80 to-slate-950/90'>
        {children}
      </div>
    </div>
  );
}
