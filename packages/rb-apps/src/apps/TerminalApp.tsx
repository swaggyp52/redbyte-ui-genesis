import React, { useState, useRef, useEffect } from 'react';
import type { RedByteApp } from '../types';
import { listExamples, type ExampleId } from '../examples';
import { useSettingsStore } from '@rb/rb-utils';
import { deleteFile, getFile, listFiles } from '../stores/filesStore';

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
        addLine('  help                        - Show this help message');
        addLine('  clear                       - Clear terminal screen');
        addLine('  about                       - About RedByte Genesis');
        addLine('  theme list|current|set <variant>');
        addLine('  wallpaper set <id>          - Set wallpaper (neon-circuit | frost-grid | solid)');
        addLine('  files list                  - List saved circuit files');
        addLine('  files open <fileId>         - Open a saved circuit');
        addLine('  files delete <fileId>       - Delete a saved circuit');
        addLine('  examples list               - List available example circuits');
        addLine('  examples load <exampleId>   - Open an example circuit');
        addLine('  ticks set <number>          - Set logic simulation tick rate (1-60)');
        addLine('  restart                     - Restart RedByte OS (replays boot)');
        break;

      case 'about':
        addLine('RedByte OS Genesis - Stage E/F');
        addLine('A modular desktop environment for logic circuit simulation');
        addLine(`Theme: ${useSettingsStore.getState().themeVariant}`);
        addLine(`Wallpaper: ${useSettingsStore.getState().wallpaperId}`);
        addLine(`Tick Rate: ${useSettingsStore.getState().tickRate} Hz`);
        break;

      case 'clear':
        setLines([]);
        break;

      case 'theme': {
        const sub = args[0];
        if (!sub || sub === 'list') {
          addLine('Available themes: dark-neon, light-frost');
          break;
        }
        if (sub === 'current') {
          addLine(`Current theme: ${useSettingsStore.getState().themeVariant}`);
          break;
        }
        if (sub === 'set') {
          const variant = args[1];
          if (variant === 'dark-neon' || variant === 'light-frost') {
            addLine(`Theme set to: ${variant}`);
            useSettingsStore.getState().setThemeVariant(variant);
            onThemeChange?.(variant);
          } else {
            addLine('Valid themes: dark-neon, light-frost', 'error');
          }
          break;
        }
        addLine('Usage: theme list | theme current | theme set <variant>', 'error');
        break;
      }

      case 'wallpaper': {
        if (args[0] !== 'set') {
          addLine("Usage: wallpaper set <neon-circuit | frost-grid | solid>", 'error');
          break;
        }
        const wallpaper = args[1];
        if (wallpaper === 'neon-circuit' || wallpaper === 'frost-grid' || wallpaper === 'solid') {
          useSettingsStore.getState().setWallpaperId(wallpaper);
          addLine(`Wallpaper set to: ${wallpaper}`);
        } else {
          addLine('Valid wallpapers: neon-circuit, frost-grid, solid', 'error');
        }
        break;
      }

      case 'examples': {
        const sub = args[0];
        if (!sub || sub === 'list') {
          addLine('Available example circuits:');
          listExamples().forEach((ex) => addLine(`  ${ex.name} (${ex.id})`));
          break;
        }

        if (sub === 'load') {
          const exampleId = args[1] as ExampleId;
          const example = listExamples().find((ex) => ex.id === exampleId);
          if (example) {
            addLine(`Opening example: ${example.name}`);
            onOpenApp?.('logic-playground', { initialExampleId: exampleId });
          } else {
            addLine('Example not found. Use "examples list".', 'error');
          }
        } else {
          addLine('Usage: examples list | examples load <id>', 'error');
        }
        break;
      }

      case 'ticks': {
        if (args[0] !== 'set') {
          addLine('Usage: ticks set <number>', 'error');
          break;
        }
        const rate = parseInt(args[1], 10);
        if (isNaN(rate) || rate < 1 || rate > 60) {
          addLine('Tick rate must be between 1 and 60 Hz', 'error');
        } else {
          addLine(`Tick rate set to: ${rate} Hz`);
          useSettingsStore.getState().setTickRate(rate);
          onTickRateChange?.(rate);
        }
        break;
      }

      case 'files': {
        const sub = args[0];
        if (!sub || sub === 'list') {
          const files = listFiles();
          if (files.length === 0) {
            addLine('No saved circuits found.');
          } else {
            addLine('Saved circuits:');
            files.forEach((file) =>
              addLine(
                `  ${file.id} - ${file.name} (updated ${new Date(file.updatedAt).toLocaleString()})`
              )
            );
          }
          break;
        }

        if (sub === 'open') {
          const fileId = args[1];
          const file = fileId ? getFile(fileId) : null;
          if (file) {
            addLine(`Opening file: ${file.name}`);
            onOpenApp?.('logic-playground', { initialFileId: file.id });
          } else {
            addLine('File not found. Use "files list".', 'error');
          }
          break;
        }

        if (sub === 'delete') {
          const fileId = args[1];
          const file = fileId ? getFile(fileId) : null;
          if (file) {
            deleteFile(file.id);
            addLine(`Deleted file: ${file.name}`);
          } else {
            addLine('File not found. Use "files list".', 'error');
          }
          break;
        }

        addLine('Usage: files list | files open <id> | files delete <id>', 'error');
        break;
      }

      case '':
        break;

      case 'restart': {
        try {
          localStorage.removeItem('rb:shell:booted');
        } catch {}
        addLine('Restarting RedByte OS…');
        setTimeout(() => window.location.reload(), 300);
        break;
      }

      default:
        addLine('Command not found. Type "help".', 'error');
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
