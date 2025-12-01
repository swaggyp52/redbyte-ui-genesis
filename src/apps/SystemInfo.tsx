import React from 'react';

export function SystemInfo() {
  const now = new Date();

  return (
    <div className='h-full flex flex-col gap-2 text-xs'>
      <div className='text-slate-200 font-medium'>RedbyteOS · System Monitor</div>
      <div className='grid grid-cols-2 gap-2 text-[11px]'>
        <div className='space-y-1'>
          <div className='text-slate-400'>Build</div>
          <div className='font-mono text-emerald-300'>v2.0.0-genesis</div>
        </div>
        <div className='space-y-1'>
          <div className='text-slate-400'>Kernel</div>
          <div className='font-mono text-slate-200'>react-18 · vite-5</div>
        </div>
        <div className='space-y-1'>
          <div className='text-slate-400'>Uptime (fake)</div>
          <div className='font-mono text-slate-200'>00:42:13</div>
        </div>
        <div className='space-y-1'>
          <div className='text-slate-400'>Current time</div>
          <div className='font-mono text-slate-200'>{now.toLocaleString()}</div>
        </div>
      </div>
      <div className='mt-3 text-[11px] text-slate-400'>
        This is a demo system panel rendered entirely on the client. Plug in real metrics later
        from Workers / KV / D1.
      </div>
      <div className='mt-auto text-[10px] text-slate-500'>
        RedbyteOS Genesis · running on Cloudflare Pages · front-end only.
      </div>
    </div>
  );
}
