// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useState, useRef, useEffect } from 'react';
import type { RedByteApp } from '../types';
import { listExamples, type ExampleId } from '../examples';
import { useSettingsStore, type ThemeVariant } from '@redbyte/rb-utils';
import { useWindowStore } from '@redbyte/rb-windowing';
import { deleteFile, getFile, listFiles } from '../stores/filesStore';
import { exportAuditLog } from '../utils/audit';

interface TerminalProps {
  onOpenApp?: (appId: string, props?: any) => void;
  onThemeChange?: (theme: ThemeVariant) => void;
  onTickRateChange?: (rate: number) => void;
}

interface TerminalLine {
  type: 'input' | 'output' | 'error';
  text: string;
  title?: string;
}

interface CommandLogEntry {
  seq: number;
  ts_wall: string;
  command: string;
}

interface CommandSpec {
  description: string;
  reads: string[];
  writes: string[];
  produces: string[];
}

const COMMAND_LOG_KEY = 'rb:terminal:log:v1';
const COMMAND_SEQ_KEY = 'rb:terminal:log:seq:v1';
const MAX_LOG_ENTRIES = 200;
let fallbackCommandSeq = 1;

const COMMAND_SPECS: Record<string, CommandSpec> = {
  help: {
    description: 'Show this help message',
    reads: ['command_registry'],
    writes: [],
    produces: [],
  },
  clear: {
    description: 'Clear terminal screen',
    reads: [],
    writes: ['terminal_buffer'],
    produces: [],
  },
  about: {
    description: 'About RedByte OS',
    reads: ['settings'],
    writes: [],
    produces: [],
  },
  status: {
    description: 'Show system status',
    reads: ['settings', 'window_store'],
    writes: [],
    produces: [],
  },
  'apps list': {
    description: 'List running apps',
    reads: ['window_store', 'app_registry'],
    writes: [],
    produces: [],
  },
  'theme list': {
    description: 'List available themes',
    reads: ['settings'],
    writes: [],
    produces: [],
  },
  'theme current': {
    description: 'Show current theme',
    reads: ['settings'],
    writes: [],
    produces: [],
  },
  'theme set': {
    description: 'Set theme variant',
    reads: ['settings'],
    writes: ['settings.theme'],
    produces: [],
  },
  'wallpaper set': {
    description: 'Set wallpaper',
    reads: ['settings'],
    writes: ['settings.wallpaper'],
    produces: [],
  },
  'files list': {
    description: 'List saved circuit files',
    reads: ['logic_files'],
    writes: [],
    produces: [],
  },
  'files open': {
    description: 'Open a saved circuit',
    reads: ['logic_files'],
    writes: ['window_store'],
    produces: [],
  },
  'files delete': {
    description: 'Delete a saved circuit',
    reads: ['logic_files'],
    writes: ['logic_files'],
    produces: [],
  },
  'examples list': {
    description: 'List available example circuits',
    reads: ['examples'],
    writes: [],
    produces: [],
  },
  'examples load': {
    description: 'Open an example circuit',
    reads: ['examples'],
    writes: ['window_store'],
    produces: [],
  },
  'ticks set': {
    description: 'Set simulation tick rate',
    reads: ['settings'],
    writes: ['settings.tick_rate'],
    produces: [],
  },
  log: {
    description: 'Show recent terminal commands',
    reads: ['command_log'],
    writes: [],
    produces: [],
  },
  restart: {
    description: 'Restart RedByte OS',
    reads: [],
    writes: ['session'],
    produces: [],
  },
  'audit export': {
    description: 'Export determinism audit log',
    reads: ['audit_log'],
    writes: [],
    produces: ['audit_artifact'],
  },
};

const COMMAND_USAGE: Record<string, string> = {
  apps: 'Usage: apps list',
  theme: 'Usage: theme list | theme current | theme set <variant>',
  wallpaper: 'Usage: wallpaper set <neon-circuit | frost-grid | solid>',
  files: 'Usage: files list | files open <id> | files delete <id>',
  examples: 'Usage: examples list | examples load <id>',
  ticks: 'Usage: ticks set <number>',
  audit: 'Usage: audit export',
};

const resolveCommandKey = (command: string, args: string[]): string | null => {
  if (!command) return null;
  switch (command) {
    case 'apps':
      return args[0] ? `apps ${args[0]}` : 'apps list';
    case 'theme':
      if (!args[0] || args[0] === 'list') return 'theme list';
      if (args[0] === 'current') return 'theme current';
      if (args[0] === 'set') return 'theme set';
      return null;
    case 'wallpaper':
      return args[0] === 'set' ? 'wallpaper set' : null;
    case 'files':
      return args[0] ? `files ${args[0]}` : 'files list';
    case 'examples':
      return args[0] ? `examples ${args[0]}` : 'examples list';
    case 'ticks':
      return args[0] === 'set' ? 'ticks set' : null;
    case 'audit':
      return args[0] === 'export' ? 'audit export' : null;
    default:
      return command;
  }
};

const formatCommandEffects = (spec: CommandSpec): string => {
  const reads = spec.reads.length > 0 ? spec.reads.join(', ') : 'none';
  const writes = spec.writes.length > 0 ? spec.writes.join(', ') : 'none';
  const produces = spec.produces.length > 0 ? spec.produces.join(', ') : 'none';
  return `reads: ${reads} | writes: ${writes} | produces: ${produces}`;
};

function loadCommandLog(): CommandLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COMMAND_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCommandLog(entries: CommandLogEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COMMAND_LOG_KEY, JSON.stringify(entries));
  } catch {
    // Ignore persistence failures
  }
}

function getNextCommandSeq(): number {
  if (typeof window === 'undefined') {
    const next = fallbackCommandSeq;
    fallbackCommandSeq += 1;
    return next;
  }

  try {
    const raw = localStorage.getItem(COMMAND_SEQ_KEY);
    const parsed = raw ? parseInt(raw, 10) : 1;
    const next = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    localStorage.setItem(COMMAND_SEQ_KEY, String(next + 1));
    return next;
  } catch {
    const next = fallbackCommandSeq;
    fallbackCommandSeq += 1;
    return next;
  }
}

function appendCommandLog(command: string): void {
  const entry: CommandLogEntry = {
    seq: getNextCommandSeq(),
    ts_wall: new Date().toISOString(),
    command,
  };
  const log = loadCommandLog();
  const nextLog = [...log, entry].slice(-MAX_LOG_ENTRIES);
  saveCommandLog(nextLog);
}

const TerminalComponent: React.FC<TerminalProps> = ({
  onOpenApp,
  onThemeChange,
  onTickRateChange,
}) => {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'output', text: 'RedByte OS Terminal v1.0' },
    { type: 'output', text: 'Type "help" for available commands' },
    { type: 'output', text: '' },
  ]);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [lines]);

  const addLine = (
    text: string,
    type: TerminalLine['type'] = 'output',
    title?: string
  ) => {
    setLines((prev) => [...prev, { type, text, title }]);
  };

  const isThemeVariant = (value: string | undefined): value is ThemeVariant =>
    value === 'light' || value === 'dark' || value === 'system';

  const listRunningApps = async () => {
    const windows = useWindowStore.getState().windows;
    const active = windows.filter((w) => w.mode !== 'minimized');

    if (active.length === 0) {
      addLine('No running apps.');
      return;
    }

    addLine('Running apps:');
    const { getApp } = await import('../AppRegistry');
    active.forEach((window) => {
      const app = getApp(window.contentId);
      const name = app?.manifest.name ?? window.contentId;
      addLine(`  ${name} (${window.contentId})`);
    });
  };

  const handleCommand = (cmd: string) => {
    const trimmed = cmd.trim();
    addLine(`> ${cmd}`, 'input');

    if (/[;&|]/.test(trimmed)) {
      addLine('Shell escapes are not supported.', 'error');
      addLine('');
      return;
    }

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    const commandKey = resolveCommandKey(command, args);
    const spec = commandKey ? COMMAND_SPECS[commandKey] : null;

    if (!commandKey || !spec) {
      if (command && COMMAND_USAGE[command]) {
        addLine(COMMAND_USAGE[command], 'error');
      } else if (command) {
        addLine('Command not found. Type "help".', 'error');
      }
      addLine('');
      return;
    }

    appendCommandLog(trimmed);

    switch (command) {
      case 'help':
        addLine('Available commands:');
        addLine(
          '  help                        - Show this help message',
          'output',
          formatCommandEffects(COMMAND_SPECS.help)
        );
        addLine(
          '  clear                       - Clear terminal screen',
          'output',
          formatCommandEffects(COMMAND_SPECS.clear)
        );
        addLine(
          '  about                       - About RedByte OS',
          'output',
          formatCommandEffects(COMMAND_SPECS.about)
        );
        addLine(
          '  status                      - Show system status',
          'output',
          formatCommandEffects(COMMAND_SPECS.status)
        );
        addLine(
          '  apps list                   - List running apps',
          'output',
          formatCommandEffects(COMMAND_SPECS['apps list'])
        );
        addLine(
          '  theme list|current|set <variant>',
          'output',
          formatCommandEffects(COMMAND_SPECS['theme list'])
        );
        addLine(
          '  wallpaper set <id>          - Set wallpaper (neon-circuit | frost-grid | solid)',
          'output',
          formatCommandEffects(COMMAND_SPECS['wallpaper set'])
        );
        addLine(
          '  files list                  - List saved circuit files',
          'output',
          formatCommandEffects(COMMAND_SPECS['files list'])
        );
        addLine(
          '  files open <fileId>         - Open a saved circuit',
          'output',
          formatCommandEffects(COMMAND_SPECS['files open'])
        );
        addLine(
          '  files delete <fileId>       - Delete a saved circuit',
          'output',
          formatCommandEffects(COMMAND_SPECS['files delete'])
        );
        addLine(
          '  examples list               - List available example circuits',
          'output',
          formatCommandEffects(COMMAND_SPECS['examples list'])
        );
        addLine(
          '  examples load <exampleId>   - Open an example circuit',
          'output',
          formatCommandEffects(COMMAND_SPECS['examples load'])
        );
        addLine(
          '  ticks set <number>          - Set logic simulation tick rate (1-60)',
          'output',
          formatCommandEffects(COMMAND_SPECS['ticks set'])
        );
        addLine(
          '  log [count]                 - Show recent terminal commands',
          'output',
          formatCommandEffects(COMMAND_SPECS.log)
        );
        addLine(
          '  audit export                - Export determinism audit log',
          'output',
          formatCommandEffects(COMMAND_SPECS['audit export'])
        );
        addLine(
          '  restart                     - Restart RedByte OS (replays boot)',
          'output',
          formatCommandEffects(COMMAND_SPECS.restart)
        );
        break;

      case 'about':
        addLine('RedByte OS v1.0');
        addLine('Digital Logic Workspace');
        addLine('');
        addLine(`Theme: ${useSettingsStore.getState().themeVariant}`);
        addLine(`Wallpaper: ${useSettingsStore.getState().wallpaperId}`);
        addLine(`Tick Rate: ${useSettingsStore.getState().tickRate} Hz`);
        break;

      case 'status': {
        const settings = useSettingsStore.getState();
        const windows = useWindowStore.getState().windows;
        const active = windows.filter((w) => w.mode !== 'minimized');
        addLine('System Status:');
        addLine(`  Theme: ${settings.themeVariant}`);
        addLine(`  Wallpaper: ${settings.wallpaperId}`);
        addLine(`  Tick Rate: ${settings.tickRate} Hz`);
        addLine(`  Open Windows: ${windows.length}`);
        addLine(`  Active Apps: ${active.length}`);
        break;
      }

      case 'log': {
        const count = args[0] ? parseInt(args[0], 10) : 10;
        if (args[0] && (isNaN(count) || count < 1)) {
          addLine('Usage: log [count]', 'error');
          break;
        }
        const entries = loadCommandLog();
        if (entries.length === 0) {
          addLine('No command log entries.');
          break;
        }
        addLine('Command log:');
        entries.slice(-count).forEach((entry) => {
          const parsed = entry.command.trim().split(/\s+/);
          const entryKey = resolveCommandKey(parsed[0]?.toLowerCase() ?? '', parsed.slice(1));
          const entrySpec = entryKey ? COMMAND_SPECS[entryKey] : null;
          const effects = entrySpec ? ` | ${formatCommandEffects(entrySpec)}` : '';
          addLine(
            `  [${entry.seq}] ${entry.ts_wall} ${entry.command}${effects}`,
            'output',
            entrySpec ? formatCommandEffects(entrySpec) : undefined
          );
        });
        break;
      }

      case 'audit': {
        if (args[0] !== 'export') {
          addLine('Usage: audit export', 'error');
          break;
        }
        exportAuditLog();
        addLine('Audit log exported.');
        break;
      }

      case 'apps': {
        const sub = args[0];
        if (!sub || sub === 'list') {
          listRunningApps().catch(err => addLine(`Error: ${err.message}`, 'error'));
          break;
        }
        addLine('Usage: apps list', 'error');
        break;
      }

      case 'clear':
        setLines([]);
        break;

      case 'theme': {
        const sub = args[0];
        if (!sub || sub === 'list') {
          addLine('Available themes: light, dark, system');
          break;
        }
        if (sub === 'current') {
          addLine(`Current theme: ${useSettingsStore.getState().themeVariant}`);
          break;
        }
        if (sub === 'set') {
          const variant = args[1];
          if (isThemeVariant(variant)) {
            addLine(`Theme set to: ${variant}`);
            useSettingsStore.getState().setThemeVariant(variant);
            onThemeChange?.(variant);
          } else {
            addLine('Valid themes: light, dark, system', 'error');
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
                `  ${file.id} - ${file.name} (updated ${new Date(file.updated_at).toLocaleString()})`
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
          localStorage.removeItem('rb:shell:booted:v1');
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
          <div key={i} className={getLineColor(line.type)} title={line.title}>
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
            aria-label="Terminal command input"
            placeholder="Enter a command"
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
