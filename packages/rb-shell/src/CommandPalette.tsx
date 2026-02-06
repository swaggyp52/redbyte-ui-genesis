// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon, type IconName } from '@redbyte/rb-icons';

export type Command =
  | 'focus-next-window'
  | 'close-focused-window'
  | 'minimize-focused-window'
  | 'snap-left'
  | 'snap-right'
  | 'snap-top'
  | 'snap-bottom'
  | 'center-window'
  | 'create-workspace'
  | 'switch-workspace'
  | 'delete-workspace'
  | 'run-macro'
  | 'open-user-manual'
  | 'project-import'
  | 'project-export'
  | 'project-verify'
  | 'project-summary'
  | 'open-example'
  | 'project-export-verilog'
  | 'project-build-bitstream'
  | 'project-program-board'
  | 'project-bitstream-provenance'
  | 'playground-layout-build'
  | 'playground-layout-analyze'
  | 'playground-layout-explain'
  | 'playground-layout-explore'
  | 'playground-layout-quad'
  | 'playground-layout-circuit-only'
  | 'playground-layout-schematic-only'
  | 'playground-layout-scope-only'
  | 'playground-layout-3d-only'
  | 'playground-dock-info'
  | 'playground-dock-health'
  | 'playground-dock-learn'
  | 'playground-dock-probes'
  | 'playground-dock-chips'
  | 'playground-toggle-wire'
  | 'playground-toggle-pause-scroll'
  | 'playground-fit-view'
  | 'playground-reset-view'
  | 'playground-clear-scope'
  | 'playground-project-new'
  | 'playground-project-save'
  | 'playground-project-open'
  | 'playground-project-export';

interface CommandItem {
  id: Command;
  label: string;
  description: string;
  category: 'System' | 'Workspace' | 'Playground';
}

const COMMANDS: CommandItem[] = [
  {
    id: 'focus-next-window',
    label: 'Focus Next Window',
    description: 'Cycle to the next window',
    category: 'System',
  },
  {
    id: 'close-focused-window',
    label: 'Close Window',
    description: 'Close the currently focused window',
    category: 'System',
  },
  {
    id: 'minimize-focused-window',
    label: 'Minimize Window',
    description: 'Minimize the currently focused window',
    category: 'System',
  },
  {
    id: 'snap-left',
    label: 'Snap Left',
    description: 'Snap window to left half of screen',
    category: 'System',
  },
  {
    id: 'snap-right',
    label: 'Snap Right',
    description: 'Snap window to right half of screen',
    category: 'System',
  },
  {
    id: 'snap-top',
    label: 'Snap Top',
    description: 'Snap window to top half of screen',
    category: 'System',
  },
  {
    id: 'snap-bottom',
    label: 'Snap Bottom',
    description: 'Snap window to bottom half of screen',
    category: 'System',
  },
  {
    id: 'center-window',
    label: 'Center Window',
    description: 'Center window on screen',
    category: 'System',
  },
  {
    id: 'create-workspace',
    label: 'Create Workspace',
    description: 'Save current windows as named workspace',
    category: 'Workspace',
  },
  {
    id: 'switch-workspace',
    label: 'Switch Workspace',
    description: 'Switch to a different workspace',
    category: 'Workspace',
  },
  {
    id: 'delete-workspace',
    label: 'Delete Workspace',
    description: 'Delete a workspace',
    category: 'Workspace',
  },
  {
    id: 'run-macro',
    label: 'Run Macro',
    description: 'Execute a saved macro sequence',
    category: 'Workspace',
  },
  {
    id: 'open-user-manual',
    label: 'Open Guide',
    description: 'Help, documentation, and getting-started guide',
    category: 'System',
  },
  {
    id: 'playground-project-new',
    label: 'Playground: New Project',
    description: 'Start a new Logic Playground project',
    category: 'Playground',
  },
  {
    id: 'playground-project-open',
    label: 'Playground: Open Project',
    description: 'Open a Logic Playground project file',
    category: 'Playground',
  },
  {
    id: 'playground-project-save',
    label: 'Playground: Save Project',
    description: 'Export the current Logic Playground project',
    category: 'Playground',
  },
  {
    id: 'playground-project-export',
    label: 'Playground: Export Artifacts',
    description: 'Export netlist, Verilog, or debug bundle',
    category: 'Playground',
  },
  {
    id: 'project-import',
    label: 'Project: Import',
    description: 'Import a .rbx.zip project file',
    category: 'System',
  },
  {
    id: 'project-export',
    label: 'Project: Export',
    description: 'Export current circuit as .rbx.zip',
    category: 'System',
  },
  {
    id: 'project-verify',
    label: 'Project: Verify Reproducibility',
    description: 'Validate project schema and mapping integrity',
    category: 'System',
  },
  {
    id: 'project-summary',
    label: 'Project: Summary',
    description: 'View project metadata and integrity hints',
    category: 'System',
  },
  {
    id: 'open-example',
    label: 'Open Example',
    description: 'Load a pre-built example project',
    category: 'System',
  },
  {
    id: 'project-export-verilog',
    label: 'Project: Export Verilog',
    description: 'Generate synthesizable Verilog HDL and constraints from circuit',
    category: 'System',
  },
  {
    id: 'project-build-bitstream',
    label: 'Project: Build Bitstream',
    description: 'Generate HDL artifacts (requires local Vivado for actual synthesis)',
    category: 'System',
  },
  {
    id: 'project-program-board',
    label: 'Project: Program Board',
    description: 'Prepare bitstream for flashing (requires local toolchain for actual programming)',
    category: 'System',
  },
  {
    id: 'project-bitstream-provenance',
    label: 'Project: Bitstream Provenance',
    description: 'View HDL and bitstream integrity metadata',
    category: 'System',
  },
  {
    id: 'playground-layout-build',
    label: 'Playground: Layout Build',
    description: 'Switch to Build layout',
    category: 'Playground',
  },
  {
    id: 'playground-layout-analyze',
    label: 'Playground: Layout Analyze',
    description: 'Switch to Analyze layout',
    category: 'Playground',
  },
  {
    id: 'playground-layout-explain',
    label: 'Playground: Layout Explain',
    description: 'Switch to Explain layout',
    category: 'Playground',
  },
  {
    id: 'playground-layout-explore',
    label: 'Playground: Layout Explore',
    description: 'Switch to Explore layout',
    category: 'Playground',
  },
  {
    id: 'playground-layout-quad',
    label: 'Playground: Layout Quad',
    description: 'Switch to Quad layout',
    category: 'Playground',
  },
  {
    id: 'playground-layout-circuit-only',
    label: 'Playground: Circuit Only',
    description: 'Switch to Circuit-only layout',
    category: 'Playground',
  },
  {
    id: 'playground-layout-schematic-only',
    label: 'Playground: Schematic Only',
    description: 'Switch to Schematic-only layout',
    category: 'Playground',
  },
  {
    id: 'playground-layout-scope-only',
    label: 'Playground: Scope Only',
    description: 'Switch to Scope-only layout',
    category: 'Playground',
  },
  {
    id: 'playground-layout-3d-only',
    label: 'Playground: 3D Only',
    description: 'Switch to 3D-only layout',
    category: 'Playground',
  },
  {
    id: 'playground-dock-info',
    label: 'Playground: Open Info Tab',
    description: 'Open RightDock Info tab',
    category: 'Playground',
  },
  {
    id: 'playground-dock-health',
    label: 'Playground: Open Health Tab',
    description: 'Open RightDock Health tab',
    category: 'Playground',
  },
  {
    id: 'playground-dock-learn',
    label: 'Playground: Open Learn Tab',
    description: 'Open RightDock Learn tab',
    category: 'Playground',
  },
  {
    id: 'playground-dock-probes',
    label: 'Playground: Open Probes Tab',
    description: 'Open RightDock Probes tab',
    category: 'Playground',
  },
  {
    id: 'playground-dock-chips',
    label: 'Playground: Open Chips Tab',
    description: 'Open RightDock Chips tab',
    category: 'Playground',
  },
  {
    id: 'playground-toggle-wire',
    label: 'Playground: Toggle Wire Tool',
    description: 'Toggle wire tool in circuit view',
    category: 'Playground',
  },
  {
    id: 'playground-toggle-pause-scroll',
    label: 'Playground: Toggle Pause Scroll',
    description: 'Toggle oscilloscope pause scroll',
    category: 'Playground',
  },
  {
    id: 'playground-fit-view',
    label: 'Playground: Fit View',
    description: 'Fit circuit view to contents',
    category: 'Playground',
  },
  {
    id: 'playground-reset-view',
    label: 'Playground: Reset View',
    description: 'Reset circuit view camera',
    category: 'Playground',
  },
  {
    id: 'playground-clear-scope',
    label: 'Playground: Clear Scope',
    description: 'Clear oscilloscope display',
    category: 'Playground',
  },
];

const COMMAND_ICON_MAP: Partial<Record<Command, IconName>> = {
  'focus-next-window': 'window-maximize',
  'close-focused-window': 'window-close',
  'minimize-focused-window': 'window-minimize',
  'snap-left': 'window-maximize',
  'snap-right': 'window-maximize',
  'snap-top': 'window-maximize',
  'snap-bottom': 'window-maximize',
  'center-window': 'grid',
  'create-workspace': 'folder',
  'switch-workspace': 'grid',
  'delete-workspace': 'window-close',
  'run-macro': 'circuit-board',
  'open-user-manual': 'book',
};

interface CommandPaletteProps {
  onExecute: (command: Command) => void;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ onExecute, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
    inputRef.current?.focus();
  }, []);

  const filteredCommands = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return COMMANDS;
    return COMMANDS.filter((command) =>
      `${command.label} ${command.description}`.toLowerCase().includes(trimmed)
    );
  }, [query]);

  const sections = useMemo(() => {
    const grouped: Record<string, CommandItem[]> = {};
    filteredCommands.forEach((command) => {
      grouped[command.category] = grouped[command.category] ?? [];
      grouped[command.category].push(command);
    });
    const order: Array<CommandItem['category']> = ['System', 'Workspace', 'Playground'];
    return order
      .filter((category) => grouped[category]?.length)
      .map((category) => ({ title: category, items: grouped[category] }));
  }, [filteredCommands]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(0);
    }
  }, [filteredCommands.length, selectedIndex]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const command = filteredCommands[selectedIndex];
      if (!command) return;
      onExecute(command.id);
      onClose();
      return;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-start justify-center pt-28 z-[9999]"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="border rounded-2xl shadow-2xl w-[560px] overflow-hidden backdrop-blur-xl"
        style={{
          borderColor: 'var(--rb-ui-border)',
          background: 'var(--rb-ui-surface-2)',
          boxShadow: 'var(--rb-ui-shadow-3)',
          outline: 'none',
        }}
      >
        <div className="p-4 border-b" style={{ borderColor: 'var(--rb-ui-border)' }}>
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em]">Command Palette</div>
          <div className="mt-2 flex items-center gap-2 rounded-xl border px-3 py-2"
            style={{ borderColor: 'var(--rb-ui-border)', background: 'var(--rb-ui-surface-2)' }}
          >
            <Icon name="search" size={16} />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type to filter commands..."
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              aria-label="Command search"
            />
            <span className="text-[10px] font-mono text-slate-500">Ctrl/Cmd+Shift+P</span>
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              No matching commands.
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.title} className="border-b" style={{ borderColor: 'var(--rb-ui-border)' }}>
                <div className="px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  {section.title}
                </div>
                {section.items.map((command) => {
                  const index = filteredCommands.findIndex((item) => item.id === command.id);
                  const isSelected = index === selectedIndex;
                  const icon = COMMAND_ICON_MAP[command.id] ?? (command.category === 'Playground' ? 'logic' : 'grid');
                  return (
                    <button
                      key={command.id}
                      onClick={() => {
                        onExecute(command.id);
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full text-left px-4 py-3 border-t transition-colors ${
                        isSelected ? 'bg-cyan-900/30 text-cyan-200' : 'text-slate-200 hover:bg-slate-900/60'
                      }`}
                      style={{ borderColor: 'var(--rb-ui-border)' }}
                      data-selected={isSelected ? 'true' : 'false'}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 h-8 w-8 rounded-lg border flex items-center justify-center"
                          style={{ borderColor: 'var(--rb-ui-border)', background: 'var(--rb-ui-surface-2)' }}
                        >
                          <Icon name={icon} size={16} />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{command.label}</div>
                          <div className="text-xs text-slate-500 mt-1">{command.description}</div>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">Enter</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t text-xs text-slate-500" style={{ borderColor: 'var(--rb-ui-border)', background: 'var(--rb-ui-surface-2)' }}>
          <kbd className="px-1.5 py-0.5 bg-slate-900 rounded">↑↓</kbd> Navigate{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-900 rounded">Enter</kbd> Execute{' '}
          <kbd className="px-1.5 py-0.5 bg-slate-900 rounded">Esc</kbd> Close
        </div>
      </div>
    </div>
  );
};
