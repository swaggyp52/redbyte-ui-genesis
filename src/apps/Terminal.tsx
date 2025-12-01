import React, { useState } from 'react';

interface Line {
  id: number;
  text: string;
}

let lineCounter = 1;

export function Terminal() {
  const [lines, setLines] = useState<Line[]>([
    { id: lineCounter++, text: 'RedbyteOS shell v0.1.0' },
    { id: lineCounter++, text: 'Type help to see available commands.' },
  ]);
  const [input, setInput] = useState('');

  function append(text: string) {
    setLines((prev) => [...prev, { id: lineCounter++, text }]);
  }

  function handleCommand(raw: string) {
    const cmd = raw.trim();
    if (!cmd) return;

    append('> ' + cmd);

    if (cmd === 'help') {
      append('Available commands: help, apps, about, clear, time');
    } else if (cmd === 'apps') {
      append('Installed apps: terminal, notes, calculator, system');
    } else if (cmd === 'about') {
      append('RedbyteOS Genesis · running in your browser · powered by React.');
    } else if (cmd === 'time') {
      append('Current time: ' + new Date().toLocaleString());
    } else if (cmd === 'clear') {
      setLines([]);
      return;
    } else {
      append('Unknown command. Type help.');
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = input;
    setInput('');
    handleCommand(value);
  }

  return (
    <div className='h-full flex flex-col bg-slate-950/90 rounded-md border border-slate-800 overflow-hidden'>
      <div className='px-2 py-1 text-[10px] bg-slate-900 border-b border-slate-800 text-emerald-300 font-mono'>
        redbyte@os: ~
      </div>
      <div className='flex-1 px-2 py-1 text-[11px] font-mono text-slate-100 overflow-auto space-y-0.5'>
        {lines.map((line) => (
          <div key={line.id}>{line.text}</div>
        ))}
      </div>
      <form onSubmit={onSubmit} className='px-2 py-1 border-t border-slate-800 flex items-center gap-1'>
        <span className='text-[11px] font-mono text-emerald-300'>➜</span>
        <input
          className='flex-1 bg-transparent text-[11px] font-mono text-slate-100 outline-none border-none'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoComplete='off'
          spellCheck={false}
        />
      </form>
    </div>
  );
}
