import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'redbyte-notes';

export function Notes() {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved != null) {
        setValue(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignore
    }
  }, [value]);

  return (
    <div className='h-full flex flex-col gap-2'>
      <div className='flex items-center justify-between'>
        <div className='text-xs text-slate-300'>Persistent notes</div>
        <button
          className='text-[10px] px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200'
          onClick={() => setValue('')}
        >
          Clear
        </button>
      </div>
      <textarea
        className='flex-1 w-full rounded-md bg-slate-900/80 border border-slate-700 px-2 py-1 text-xs font-mono text-slate-100 resize-none outline-none focus:border-emerald-400'
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder='Write anything here. It will stay in your browser between visits.'
      />
      <div className='text-[10px] text-slate-500'>
        Stored locally in your browser only – not sent anywhere.
      </div>
    </div>
  );
}
