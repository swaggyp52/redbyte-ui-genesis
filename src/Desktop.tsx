import React from 'react';
import { useOSStore } from './os/RedByteOS';
import { APPS, AppId, getAppById } from './os/apps';
import { Window } from './components/Window';

function renderApp(appId: AppId): React.ReactNode {
  switch (appId) {
    case 'terminal':
      return React.createElement(require('./apps/Terminal').Terminal);
    case 'notes':
      return React.createElement(require('./apps/Notes').Notes);
    case 'calculator':
      return React.createElement(require('./apps/Calculator').Calculator);
    case 'system':
    default:
      return React.createElement(require('./apps/SystemInfo').SystemInfo);
  }
}

export default function Desktop() {
  const windows = useOSStore((s) => s.windows);
  const focusedId = useOSStore((s) => s.focusedId);
  const openApp = useOSStore((s) => s.openApp);
  const closeWindow = useOSStore((s) => s.closeWindow);
  const focusWindow = useOSStore((s) => s.focusWindow);

  return (
    <div className='h-screen w-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 overflow-hidden relative'>
      {/* Top bar */}
      <div className='h-10 px-4 flex items-center justify-between bg-black/30 backdrop-blur border-b border-white/5'>
        <div className='flex items-center gap-2 text-xs'>
          <span className='h-2 w-2 rounded-full bg-emerald-400 animate-pulse' />
          <span className='font-mono tracking-tight'>RedbyteOS</span>
        </div>
        <div className='text-[11px] text-slate-400'>
          Genesis build · {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Desktop content */}
      <div className='absolute inset-0 pt-10 pb-12 px-6 flex'>
        {/* Left: app icons */}
        <div className='w-56 flex flex-col gap-3 pt-6'>
          {APPS.map((app) => (
            <button
              key={app.id}
              onClick={() => openApp(app.id)}
              className='group flex items-center gap-3 rounded-xl px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-emerald-400/60 transition-all text-left'
            >
              <div className='h-9 w-9 rounded-lg bg-gradient-to-br flex items-center justify-center text-lg shadow-inner from-slate-700 to-slate-900'>
                <span>{app.iconEmoji}</span>
              </div>
              <div className='flex flex-col'>
                <span className='text-xs font-medium'>{app.name}</span>
                <span className='text-[10px] text-slate-400 line-clamp-2'>
                  {app.description}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Right: windows */}
        <div className='flex-1 relative'>
          {windows.map((win, index) => {
            const app = getAppById(win.appId);
            const isFocused = win.id === focusedId;
            const offset = index;
            return (
              <Window
                key={win.id}
                id={win.id}
                title={app.name}
                iconEmoji={app.iconEmoji}
                offset={offset}
                focused={isFocused}
                onClose={() => closeWindow(win.id)}
                onFocus={() => focusWindow(win.id)}
              >
                {renderApp(win.appId)}
              </Window>
            );
          })}
          {windows.length === 0 && (
            <div className='h-full flex items-center justify-center text-center text-sm text-slate-400'>
              <div>
                <div className='text-lg mb-2'>Welcome to RedbyteOS 👋</div>
                <div>Click an app on the left to open a window.</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Taskbar */}
      <div className='absolute bottom-0 inset-x-0 h-10 bg-black/40 backdrop-blur border-t border-white/5 flex items-center px-4 justify-between text-[11px]'>
        <div className='flex items-center gap-2'>
          <span className='font-semibold text-emerald-300'>⋄</span>
          <span className='text-slate-200'>RedbyteOS</span>
          <span className='text-slate-500'>· Genesis Desktop</span>
        </div>
        <div className='flex items-center gap-3 text-slate-400'>
          <span className='hidden sm:inline'>Build: v2.0.0</span>
          <span className='h-1 w-10 rounded-full bg-emerald-400/40 overflow-hidden'>
            <span className='block h-full w-4 bg-emerald-400/80 animate-ping' />
          </span>
        </div>
      </div>
    </div>
  );
}
