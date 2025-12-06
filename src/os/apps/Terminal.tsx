import React, { useState, useRef, useEffect } from 'react';

interface Line {
  id: number;
  text: string;
}

const TerminalApp: React.FC = () => {
  const [lines, setLines] = useState<Line[]>([
    { id: 1, text: 'RedByte OS Virtual Terminal' },
    { id: 2, text: 'type \"help\" for a list of commands.' },
  ]);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const append = (text: string) => {
    setLines((prev) => [...prev, { id: Date.now(), text }]);
  };

  const runCommand = (cmd: string) => {
    const lower = cmd.trim().toLowerCase();
    append('> ' + cmd);

    switch (lower) {
      case 'help':
        append('Available commands:');
        append('  help        - show this help list');
        append('  clear       - clear the terminal');
        append('  echo TEXT   - print TEXT');
        append('  time        - show system time');
        append('  about       - about RedByte OS');
        break;

      case 'clear':
        setLines([]);
        break;

      case 'time':
        append('Current Time: ' + new Date().toLocaleTimeString());
        break;

      case 'about':
        append('RedByte OS — virtual computer lab & builder.');
        append('Build CPUs, logic circuits, and virtual machines.');
        break;

      default:
        if (lower.startsWith('echo ')) {
          append(cmd.substring(5));
        } else if (cmd.trim() !== '') {
          append('Unknown command: ' + cmd);
        }
        break;
    }
  };

  const handleSubmit = () => {
    if (!input.trim()) return;
    runCommand(input);
    setInput('');
  };

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [lines]);

  return (
    <div className='w-full h-full bg-black/75 text-slate-200 text-[11px] p-3 flex flex-col'>
      <div className='flex-none border-b border-red-900/60 pb-1 mb-2'>
        <span className='uppercase tracking-[0.2em] text-red-300/80'>
          terminal
        </span>
      </div>

      <div
        ref={scrollRef}
        className='flex-1 overflow-auto space-y-1 custom-scroll font-mono'
      >
        {lines.map((line) => (
          <div key={line.id}>{line.text}</div>
        ))}
      </div>

      <div className='flex gap-2 mt-2'>
        <span className='text-red-400 font-mono'>></span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className='flex-1 bg-black/40 border border-red-900/60 px-2 py-1 rounded outline-none font-mono'
        />
      </div>
    </div>
  );
};

export default TerminalApp;
