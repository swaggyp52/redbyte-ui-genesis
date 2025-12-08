import React, { useState, useRef, useEffect } from 'react';
import type { RedByteApp } from '../types';
import { listExamples, type ExampleId } from '../examples';

interface TerminalProps {
  onOpenApp?: (appId: string, props?: any) => void;
  onThemeChange?: (theme: string) => void;
  onTickRateChange?: (rate: number) => void;
}

interface TerminalLine {
  type: 'input' | 'output' | 'error';
  text: string;
}

const TerminalComponent: React.FC<TerminalProps> = ({
  onOpenApp,
  onThemeChange,
  onTickRateChange,
}) => {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'output', text: 'RedByte OS Genesis Terminal v0.1' },
    { type: 'output', text: 'Type "help" for available commands' },
    { type: 'output', text: '' },
  ]);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [lines]);

  const addLine = (text: string, type: TerminalLine['type'] = 'output') => {
    setLines((prev) => [...prev, { type, text }]);
  };

  const handleCommand = (cmd: string) => {
    addLine(`> ${cmd}`, 'input');

    const parts = cmd.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case 'help':
        addLine('Available commands:');
        addLine('  help              - Show this help message');
        addLine('  about             - About RedByte Genesis');
        addLine('  clear             - Clear terminal screen');
        addLine('  theme <name>      - Set theme (dark-neon | light-frost)');
        addLine('  examples          - List available example circuits');
        addLine('  open <id>         - Open an example circuit');
        addLine('  hz <number>       - Set logic simulation tick rate (1-60)');
        break;

      case 'about':
        addLine('RedByte OS Genesis - Stage E');
        addLine('A modular desktop environment for logic circuit simulation');
        addLine('Built with React, TypeScript, and Three.js');
        break;

      case 'clear':
        setLines([]);
        break;

      case 'theme':
        if (args.length === 0) {
          addLine('Usage: theme <dark-neon | light-frost>', 'error');
        } else if (args[0] === 'dark-neon' || args[0] === 'light-frost') {
          addLine(`Theme set to: ${args[0]}`);
          onThemeChange?.(args[0]);
        } else {
          addLine(`Invalid theme: ${args[0]}`, 'error');
          addLine('Valid themes: dark-neon, light-frost', 'error');
        }
        break;

      case 'examples':
        addLine('Available example circuits:');
        listExamples().forEach((ex) => {
          addLine(`  ${ex.id.padEnd(20)} - ${ex.description}`);
        });
        break;

      case 'open':
        if (args.length === 0) {
          addLine('Usage: open <example-id>', 'error');
        } else {
          const exampleId = args[0] as ExampleId;
          const examples = listExamples();
          const example = examples.find((ex) => ex.id === exampleId);

          if (example) {
            addLine(`Opening example: ${example.name}`);
            onOpenApp?.('logic-playground', { initialExampleId: exampleId });
          } else {
            addLine(`Example not found: ${exampleId}`, 'error');
            addLine('Use "examples" to list available examples', 'error');
          }
        }
        break;

      case 'hz':
        if (args.length === 0) {
          addLine('Usage: hz <number>', 'error');
        } else {
          const rate = parseInt(args[0], 10);
          if (isNaN(rate) || rate < 1 || rate > 60) {
            addLine('Tick rate must be between 1 and 60 Hz', 'error');
          } else {
            addLine(`Tick rate set to: ${rate} Hz`);
            onTickRateChange?.(rate);
          }
        }
        break;

      case '':
        break;

      default:
        addLine(`Command not found: ${command}`, 'error');
        addLine('Type "help" for available commands', 'error');
    }

    addLine('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      handleCommand(input);
      setInput('');
    }
  };

  const getLineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'input':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-300';
    }
  };

  return (
    <div className="h-full flex flex-col bg-black text-white font-mono text-sm">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-1"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((line, i) => (
          <div key={i} className={getLineColor(line.type)}>
            {line.text || '\u00A0'}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-700 p-4">
        <div className="flex items-center gap-2">
          <span className="text-green-400">&gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent outline-none text-white"
            autoFocus
            spellCheck={false}
          />
        </div>
      </form>
    </div>
  );
};

export const TerminalApp: RedByteApp = {
  manifest: {
    id: 'terminal',
    name: 'Terminal',
    iconId: 'terminal',
    singleton: true,
    category: 'system',
    defaultSize: { width: 640, height: 400 },
    minSize: { width: 400, height: 300 },
  },
  component: TerminalComponent,
};
