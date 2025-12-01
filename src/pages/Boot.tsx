import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOSStore } from '../os/RedByteOS';

export default function Boot() {
  const navigate = useNavigate();
  const reset = useOSStore((s) => s.reset);
  const openApp = useOSStore((s) => s.openApp);

  useEffect(() => {
    reset();
    openApp('system');
    openApp('terminal');
    openApp('notes');

    const timeout = setTimeout(() => {
      navigate('/os');
    }, 1400);

    return () => clearTimeout(timeout);
  }, [navigate, reset, openApp]);

  return (
    <div className='h-screen w-screen flex items-center justify-center bg-black text-slate-100'>
      <div className='flex flex-col items-center gap-3'>
        <div className='h-10 w-10 rounded-2xl bg-emerald-500 flex items-center justify-center text-2xl shadow-lg shadow-emerald-500/40'>
          ⋄
        </div>
        <div className='text-sm font-medium'>Booting RedbyteOS…</div>
        <div className='h-1 w-40 bg-slate-700 rounded-full overflow-hidden'>
          <div className='h-full w-1/3 bg-emerald-400 animate-pulse' />
        </div>
        <div className='text-[11px] text-slate-500'>Preparing desktop and launching core apps.</div>
      </div>
    </div>
  );
}
