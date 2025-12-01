import React from 'react';
import { useNavigate } from 'react-router-dom';
import { APPS } from '../../os/apps';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className='min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 flex flex-col'>
      <header className='px-6 py-4 flex items-center justify-between border-b border-white/10'>
        <div className='flex items-center gap-2'>
          <div className='h-7 w-7 rounded-xl bg-emerald-500 flex items-center justify-center text-lg shadow-lg shadow-emerald-500/40'>
            ⋄
          </div>
          <div className='flex flex-col leading-tight'>
            <span className='text-sm font-semibold tracking-tight'>RedbyteOS</span>
            <span className='text-[10px] text-slate-400'>Genesis build · front-end only</span>
          </div>
        </div>
        <button
          onClick={() => navigate('/boot')}
          className='px-4 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-500/30 transition-colors'
        >
          Launch Desktop
        </button>
      </header>

      <main className='flex-1 flex flex-col lg:flex-row items-stretch px-6 py-8 gap-8'>
        {/* Left: Hero copy */}
        <div className='flex-1 flex flex-col justify-center gap-4'>
          <h1 className='text-3xl sm:text-4xl font-semibold tracking-tight'>
            Your browser is now an <span className='text-emerald-400'>OS</span>.
          </h1>
          <p className='text-sm text-slate-300 max-w-xl'>
            RedbyteOS Genesis is a desktop-style environment running entirely on the front end,
            deployed on Cloudflare Pages. Click launch to boot into a faux OS with windows, apps,
            and a terminal.
          </p>
          <div className='flex flex-wrap gap-3 mt-2 text-[11px] text-slate-300'>
            <span className='px-2 py-1 rounded-full bg-white/5 border border-white/10'>
              React 18 · Vite 5
            </span>
            <span className='px-2 py-1 rounded-full bg-white/5 border border-white/10'>
              Cloudflare Pages
            </span>
            <span className='px-2 py-1 rounded-full bg-white/5 border border-white/10'>
              No backend required (yet)
            </span>
          </div>
          <div className='mt-4 flex gap-3'>
            <button
              onClick={() => navigate('/boot')}
              className='px-5 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-500/40 transition-colors'
            >
              Boot RedbyteOS
            </button>
            <a
              href='https://github.com/swaggyp52/redbyte-ui-genesis'
              target='_blank'
              rel='noreferrer'
              className='px-4 py-2 rounded-full border border-white/20 text-xs text-slate-200 hover:bg-white/5 transition-colors'
            >
              View source on GitHub
            </a>
          </div>
        </div>

        {/* Right: App preview cards */}
        <div className='w-full lg:w-[360px] flex flex-col gap-3'>
          <div className='text-[11px] text-slate-400 uppercase tracking-[0.2em]'>
            Preinstalled apps
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3'>
            {APPS.map((app) => (
              <div
                key={app.id}
                className='rounded-2xl border border-white/10 bg-white/5 p-3 flex items-center gap-3'
              >
                <div className='h-10 w-10 rounded-xl bg-slate-900 flex items-center justify-center text-xl'>
                  {app.iconEmoji}
                </div>
                <div className='flex-1 flex flex-col'>
                  <span className='text-xs font-medium'>{app.name}</span>
                  <span className='text-[10px] text-slate-400 line-clamp-2'>{app.description}</span>
                </div>
              </div>
            ))}
          </div>
          <div className='mt-2 text-[10px] text-slate-500'>
            This is all running from static assets on Cloudflare. Later you can plug in real APIs,
            auth, and data.
          </div>
        </div>
      </main>
    </div>
  );
}
