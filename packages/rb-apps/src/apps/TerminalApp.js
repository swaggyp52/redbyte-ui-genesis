import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { listExamples } from '../examples';
import { getApp } from '../AppRegistry';
import { useSettingsStore } from '@redbyte/rb-utils';
import { useWindowStore } from '@redbyte/rb-windowing';
import { deleteFile, getFile, listFiles } from '../stores/filesStore';
import { exportAuditLog } from '../utils/audit';
import { useFileSystemStore } from '../stores/fileSystemStore';
import { logSystemEvent, useSystemLogStore } from '../stores/systemLogStore';
import { digestValue, stableStringify } from '../utils/digest';
import { Icon } from '@redbyte/rb-icons';
import { useLabStore } from '@redbyte/rb-logic-3d';
const COMMAND_LOG_KEY = 'rb:terminal:log:v1';
const COMMAND_SEQ_KEY = 'rb:terminal:log:seq:v1';
const MAX_LOG_ENTRIES = 200;
let fallbackCommandSeq = 1;
const COMMAND_SPECS = {
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
    open: {
        description: 'Open an app window',
        reads: ['app_registry'],
        writes: ['window_store'],
        produces: [],
    },
    focus: {
        description: 'Focus a window by id or app',
        reads: ['window_store'],
        writes: ['window_store'],
        produces: [],
    },
    'list windows': {
        description: 'List open windows',
        reads: ['window_store'],
        writes: [],
        produces: [],
    },
    'list files': {
        description: 'List virtual filesystem files',
        reads: ['file_system'],
        writes: [],
        produces: [],
    },
    cat: {
        description: 'Print file contents from the virtual filesystem',
        reads: ['file_system'],
        writes: [],
        produces: [],
    },
    theme: {
        description: 'Set theme variant',
        reads: ['settings'],
        writes: ['settings.theme'],
        produces: [],
    },
    record: {
        description: 'Toggle determinism recorder',
        reads: ['determinism'],
        writes: ['determinism'],
        produces: [],
    },
    'export capsule': {
        description: 'Export deterministic capsule',
        reads: ['determinism', 'window_store', 'settings', 'system_log'],
        writes: [],
        produces: ['capsule_artifact'],
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
    'arduino upload': {
        description: 'Upload an Arduino sketch via bridge agent',
        reads: ['file_system', 'bridge_transport'],
        writes: ['hardware'],
        produces: ['hardware_state'],
    },
    'arduino list-ports': {
        description: 'List available serial ports via bridge agent',
        reads: ['bridge_transport'],
        writes: [],
        produces: [],
    },
    'audit export': {
        description: 'Export determinism audit log',
        reads: ['audit_log'],
        writes: [],
        produces: ['audit_artifact'],
    },
    'lab ls': {
        description: 'List lab capsule files',
        reads: ['file_system'],
        writes: [],
        produces: [],
    },
    'lab open': {
        description: 'Open a lab capsule file',
        reads: ['file_system'],
        writes: ['window_store'],
        produces: [],
    },
    'lab export': {
        description: 'Export current lab session',
        reads: ['lab_session'],
        writes: [],
        produces: ['lab_capsule'],
    },
    'lab verify': {
        description: 'Verify lab capsule integrity',
        reads: ['file_system'],
        writes: [],
        produces: [],
    },
    'lab replay': {
        description: 'Open lab capsule in replay mode',
        reads: ['file_system'],
        writes: ['window_store'],
        produces: [],
    },
};
const COMMAND_USAGE = {
    open: 'Usage: open <appId>',
    focus: 'Usage: focus <windowId | appId>',
    list: 'Usage: list windows | list files',
    cat: 'Usage: cat <fileId | fileName>',
    theme: 'Usage: theme <dark | light | midnight>',
    record: 'Usage: record on | record off',
    export: 'Usage: export capsule',
    apps: 'Usage: apps list',
    wallpaper: 'Usage: wallpaper set <neon-circuit | frost-grid | solid>',
    files: 'Usage: files list | files open <id> | files delete <id>',
    examples: 'Usage: examples list | examples load <id>',
    ticks: 'Usage: ticks set <number>',
    arduino: 'Usage: arduino list-ports | arduino upload <port> <file> [--board uno|nano]',
    audit: 'Usage: audit export',
    lab: 'Usage: lab ls | lab open <fileId> | lab export | lab verify <fileId> | lab replay <fileId>',
};
const resolveCommandKey = (command, args) => {
    if (!command)
        return null;
    switch (command) {
        case 'open':
            return 'open';
        case 'focus':
            return 'focus';
        case 'list':
            if (args[0] === 'windows')
                return 'list windows';
            if (args[0] === 'files')
                return 'list files';
            return null;
        case 'cat':
            return 'cat';
        case 'record':
            return 'record';
        case 'export':
            return args[0] === 'capsule' ? 'export capsule' : null;
        case 'apps':
            return args[0] ? `apps ${args[0]}` : 'apps list';
        case 'theme':
            if (!args[0])
                return 'theme';
            if (args[0] === 'list')
                return 'theme list';
            if (args[0] === 'current')
                return 'theme current';
            if (args[0] === 'set')
                return 'theme set';
            return 'theme';
        case 'wallpaper':
            return args[0] === 'set' ? 'wallpaper set' : null;
        case 'files':
            return args[0] ? `files ${args[0]}` : 'files list';
        case 'examples':
            return args[0] ? `examples ${args[0]}` : 'examples list';
        case 'ticks':
            return args[0] === 'set' ? 'ticks set' : null;
        case 'arduino':
            if (args[0] === 'upload')
                return 'arduino upload';
            if (args[0] === 'list-ports')
                return 'arduino list-ports';
            return 'arduino';
        case 'audit':
            return args[0] === 'export' ? 'audit export' : null;
        case 'lab':
            if (args[0] === 'ls')
                return 'lab ls';
            if (args[0] === 'open')
                return 'lab open';
            if (args[0] === 'export')
                return 'lab export';
            if (args[0] === 'verify')
                return 'lab verify';
            if (args[0] === 'replay')
                return 'lab replay';
            return null;
        default:
            return command;
    }
};
const formatCommandEffects = (spec) => {
    const reads = spec.reads.length > 0 ? spec.reads.join(', ') : 'none';
    const writes = spec.writes.length > 0 ? spec.writes.join(', ') : 'none';
    const produces = spec.produces.length > 0 ? spec.produces.join(', ') : 'none';
    return `reads: ${reads} | writes: ${writes} | produces: ${produces}`;
};
function loadCommandLog() {
    if (typeof window === 'undefined')
        return [];
    try {
        const raw = localStorage.getItem(COMMAND_LOG_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function saveCommandLog(entries) {
    if (typeof window === 'undefined')
        return;
    try {
        localStorage.setItem(COMMAND_LOG_KEY, JSON.stringify(entries));
    }
    catch {
        // Ignore persistence failures
    }
}
function getNextCommandSeq() {
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
    }
    catch {
        const next = fallbackCommandSeq;
        fallbackCommandSeq += 1;
        return next;
    }
}
function appendCommandLog(command) {
    const entry = {
        seq: getNextCommandSeq(),
        ts_wall: new Date().toISOString(),
        command,
    };
    const log = loadCommandLog();
    const nextLog = [...log, entry].slice(-MAX_LOG_ENTRIES);
    saveCommandLog(nextLog);
}
const TerminalComponent = ({ onOpenApp, onThemeChange, onTickRateChange, determinismRecorder, getCurrentCircuit, versionLabel, }) => {
    const [lines, setLines] = useState([
        { type: 'output', text: 'RedByte OS Terminal v1.0' },
        { type: 'output', text: 'Type "help" for available commands' },
        { type: 'output', text: '' },
    ]);
    const [input, setInput] = useState('');
    const inputRef = useRef(null);
    const scrollRef = useRef(null);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [paletteQuery, setPaletteQuery] = useState('');
    const [paletteIndex, setPaletteIndex] = useState(0);
    const paletteItems = useMemo(() => {
        const entries = Object.entries(COMMAND_SPECS).map(([id, spec]) => ({
            id,
            label: spec.description,
        }));
        if (!paletteQuery.trim())
            return entries;
        const lowered = paletteQuery.toLowerCase();
        return entries.filter((item) => item.id.includes(lowered) || item.label.toLowerCase().includes(lowered));
    }, [paletteQuery]);
    useEffect(() => {
        setPaletteIndex(0);
    }, [paletteQuery, paletteItems.length]);
    useEffect(() => {
        const target = scrollRef.current;
        if (!target)
            return;
        if (typeof target.scrollTo === 'function') {
            target.scrollTo(0, target.scrollHeight);
        }
        else {
            target.scrollTop = target.scrollHeight;
        }
    }, [lines]);
    const addLine = (text, type = 'output', title) => {
        setLines((prev) => [...prev, { type, text, title }]);
    };
    const logCommandEvent = (level, message, data) => {
        logSystemEvent({
            level,
            source: 'terminal',
            message,
            data,
        });
    };
    const resolveThemeVariant = (value) => {
        if (!value)
            return null;
        const normalized = value.toLowerCase();
        if (normalized === 'dark' || normalized === 'redbyte-dark' || normalized === 'redbyte')
            return 'dark';
        if (normalized === 'light' || normalized === 'instrument' || normalized === 'inst')
            return 'light';
        if (normalized === 'midnight')
            return 'midnight';
        if (normalized === 'system')
            return 'system';
        return null;
    };
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
    const listWindows = () => {
        const windows = useWindowStore.getState().windows;
        if (windows.length === 0) {
            addLine('No windows open.');
            return;
        }
        addLine('Windows:');
        windows.forEach((window) => {
            const focused = window.focused ? '*' : ' ';
            addLine(` ${focused} ${window.id} | ${window.contentId} | ${window.title} | ${window.mode}`);
        });
    };
    const listVirtualFiles = () => {
        const files = useFileSystemStore.getState().getAllFiles();
        if (files.length === 0) {
            addLine('No virtual files found.');
            return;
        }
        addLine('Virtual files:');
        files.forEach((file) => {
            addLine(`  ${file.id} | ${file.name} | ${file.modified}`);
        });
    };
    const catVirtualFile = (query) => {
        if (!query) {
            addLine('Usage: cat <fileId | fileName>', 'error');
            return;
        }
        const fs = useFileSystemStore.getState();
        let file = fs.getFile(query);
        if (!file) {
            const all = fs.getAllFiles();
            file = all.find((entry) => entry.name.toLowerCase() === query.toLowerCase()) ?? null;
        }
        if (!file) {
            addLine('File not found in virtual filesystem.', 'error');
            return;
        }
        addLine(`--- ${file.name} (${file.id}) ---`);
        addLine(file.content ? file.content : '[empty]');
    };
    const downloadText = (filename, text) => {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    };
    const exportCapsule = () => {
        const windows = useWindowStore.getState().windows;
        const settings = useSettingsStore.getState();
        const systemLog = useSystemLogStore.getState().entries;
        const determinismLog = determinismRecorder?.getLog ? determinismRecorder.getLog() : null;
        const payload = {
            schema_version: 'rb_capsule_v1',
            created_at: new Date().toISOString(),
            version: versionLabel ?? 'unknown',
            ui_state: {
                windows,
                nextZIndex: useWindowStore.getState().nextZIndex,
                settings,
            },
            determinism: determinismLog,
            system_log: systemLog,
        };
        const hash = digestValue(payload);
        const capsule = { ...payload, hash };
        downloadText(`rb-capsule-${Date.now()}.json`, stableStringify(capsule));
    };
    const handleCommand = (cmd) => {
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
            }
            else if (command) {
                addLine('Command not found. Type "help".', 'error');
            }
            addLine('');
            return;
        }
        appendCommandLog(trimmed);
        logCommandEvent('action', 'Command executed', { command: trimmed });
        switch (command) {
            case 'help':
                addLine('Available commands:');
                addLine('  help                        - Show this help message', 'output', formatCommandEffects(COMMAND_SPECS.help));
                addLine('  clear                       - Clear terminal screen', 'output', formatCommandEffects(COMMAND_SPECS.clear));
                addLine('  open <appId>                - Open an app window', 'output', formatCommandEffects(COMMAND_SPECS.open));
                addLine('  focus <windowId|appId>      - Focus a window', 'output', formatCommandEffects(COMMAND_SPECS.focus));
                addLine('  list windows                - List open windows', 'output', formatCommandEffects(COMMAND_SPECS['list windows']));
                addLine('  list files                  - List virtual filesystem files', 'output', formatCommandEffects(COMMAND_SPECS['list files']));
                addLine('  cat <fileId|fileName>       - Print a virtual file', 'output', formatCommandEffects(COMMAND_SPECS.cat));
                addLine('  theme <name>                - Set theme (dark | light | midnight)', 'output', formatCommandEffects(COMMAND_SPECS.theme));
                addLine('  record on|off               - Toggle determinism recorder', 'output', formatCommandEffects(COMMAND_SPECS.record));
                addLine('  export capsule              - Export determinism capsule', 'output', formatCommandEffects(COMMAND_SPECS['export capsule']));
                addLine('  about                       - About RedByte OS', 'output', formatCommandEffects(COMMAND_SPECS.about));
                addLine('  status                      - Show system status', 'output', formatCommandEffects(COMMAND_SPECS.status));
                addLine('  apps list                   - List running apps', 'output', formatCommandEffects(COMMAND_SPECS['apps list']));
                addLine('  theme list|current|set <variant>', 'output', formatCommandEffects(COMMAND_SPECS['theme list']));
                addLine('  wallpaper set <id>          - Set wallpaper (neon-circuit | frost-grid | solid)', 'output', formatCommandEffects(COMMAND_SPECS['wallpaper set']));
                addLine('  files list                  - List saved circuit files', 'output', formatCommandEffects(COMMAND_SPECS['files list']));
                addLine('  files open <fileId>         - Open a saved circuit', 'output', formatCommandEffects(COMMAND_SPECS['files open']));
                addLine('  files delete <fileId>       - Delete a saved circuit', 'output', formatCommandEffects(COMMAND_SPECS['files delete']));
                addLine('  examples list               - List available example circuits', 'output', formatCommandEffects(COMMAND_SPECS['examples list']));
                addLine('  examples load <exampleId>   - Open an example circuit', 'output', formatCommandEffects(COMMAND_SPECS['examples load']));
                addLine('  ticks set <number>          - Set logic simulation tick rate (1-60)', 'output', formatCommandEffects(COMMAND_SPECS['ticks set']));
                addLine('  log [count]                 - Show recent terminal commands', 'output', formatCommandEffects(COMMAND_SPECS.log));
                addLine('  audit export                - Export determinism audit log', 'output', formatCommandEffects(COMMAND_SPECS['audit export']));
                addLine('  restart                     - Restart RedByte OS (replays boot)', 'output', formatCommandEffects(COMMAND_SPECS.restart));
                break;
            case 'about':
                addLine(versionLabel ? `RedByte OS ${versionLabel}` : 'RedByte OS');
                addLine('Deterministic Logic Workspace');
                addLine('');
                addLine(`Theme: ${useSettingsStore.getState().themeVariant}`);
                addLine(`Wallpaper: ${useSettingsStore.getState().wallpaperId}`);
                addLine(`Tick Rate: ${useSettingsStore.getState().tickRate} Hz`);
                break;
            case 'open': {
                const appId = args[0];
                if (!appId) {
                    addLine(COMMAND_USAGE.open, 'error');
                    break;
                }
                const app = getApp(appId);
                if (!app) {
                    addLine(`App not found: ${appId}`, 'error');
                    logCommandEvent('error', 'App not found', { appId });
                    break;
                }
                onOpenApp?.(appId);
                addLine(`Opened ${app.manifest.name}.`);
                logCommandEvent('info', 'App opened', { appId });
                break;
            }
            case 'focus': {
                const query = args.join(' ').trim();
                if (!query) {
                    addLine(COMMAND_USAGE.focus, 'error');
                    break;
                }
                const store = useWindowStore.getState();
                const windows = store.windows;
                let target = windows.find((w) => w.id === query);
                if (!target) {
                    target = windows.find((w) => w.contentId === query);
                }
                if (!target) {
                    target = windows.find((w) => w.title.toLowerCase() === query.toLowerCase());
                }
                if (!target) {
                    addLine('Window not found.', 'error');
                    logCommandEvent('error', 'Window not found', { query });
                    break;
                }
                if (target.mode === 'minimized') {
                    store.restoreWindow(target.id);
                }
                store.focusWindow(target.id);
                addLine(`Focused ${target.title} (${target.id}).`);
                logCommandEvent('info', 'Window focused', { windowId: target.id });
                break;
            }
            case 'list': {
                const sub = args[0];
                if (sub === 'windows') {
                    listWindows();
                    break;
                }
                if (sub === 'files') {
                    listVirtualFiles();
                    break;
                }
                addLine(COMMAND_USAGE.list, 'error');
                break;
            }
            case 'cat': {
                const target = args.join(' ').trim();
                catVirtualFile(target);
                break;
            }
            case 'record': {
                const sub = args[0];
                if (!determinismRecorder || !getCurrentCircuit) {
                    addLine('Determinism recorder unavailable.', 'error');
                    break;
                }
                if (!sub) {
                    addLine(`Recording: ${determinismRecorder.isRecording ? 'on' : 'off'}`);
                    break;
                }
                if (sub === 'on') {
                    const circuit = getCurrentCircuit();
                    if (!circuit) {
                        addLine('No active circuit to record.', 'error');
                        logCommandEvent('warning', 'Record failed (no circuit)');
                        break;
                    }
                    determinismRecorder.startRecording(circuit);
                    addLine('Recording enabled.');
                    logCommandEvent('info', 'Recording started');
                    break;
                }
                if (sub === 'off') {
                    determinismRecorder.stopRecording();
                    addLine('Recording stopped.');
                    logCommandEvent('info', 'Recording stopped');
                    break;
                }
                addLine(COMMAND_USAGE.record, 'error');
                break;
            }
            case 'export': {
                if (args[0] !== 'capsule') {
                    addLine(COMMAND_USAGE.export, 'error');
                    break;
                }
                exportCapsule();
                addLine('Capsule exported.');
                logCommandEvent('info', 'Capsule exported');
                break;
            }
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
                    addLine(`  [${entry.seq}] ${entry.ts_wall} ${entry.command}${effects}`, 'output', entrySpec ? formatCommandEffects(entrySpec) : undefined);
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
                if (!sub) {
                    const current = useSettingsStore.getState().themeVariant;
                    addLine(`Current theme: ${current}`);
                    addLine('Available themes: dark, light, midnight');
                    break;
                }
                if (sub === 'list') {
                    addLine('Available themes: dark, light, midnight');
                    break;
                }
                if (sub === 'current') {
                    addLine(`Current theme: ${useSettingsStore.getState().themeVariant}`);
                    break;
                }
                if (sub === 'set') {
                    const variant = resolveThemeVariant(args[1]);
                    if (variant) {
                        addLine(`Theme set to: ${variant}`);
                        useSettingsStore.getState().setThemeVariant(variant);
                        onThemeChange?.(variant);
                    }
                    else {
                        addLine('Valid themes: dark, light, midnight', 'error');
                    }
                    break;
                }
                const variant = resolveThemeVariant(sub);
                if (variant) {
                    addLine(`Theme set to: ${variant}`);
                    useSettingsStore.getState().setThemeVariant(variant);
                    onThemeChange?.(variant);
                    break;
                }
                addLine(COMMAND_USAGE.theme, 'error');
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
                }
                else {
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
                    const exampleId = args[1];
                    const example = listExamples().find((ex) => ex.id === exampleId);
                    if (example) {
                        addLine(`Opening example: ${example.name}`);
                        onOpenApp?.('logic-playground', { initialExampleId: exampleId });
                    }
                    else {
                        addLine('Example not found. Use "examples list".', 'error');
                    }
                }
                else {
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
                }
                else {
                    addLine(`Tick rate set to: ${rate} Hz`);
                    useSettingsStore.getState().setTickRate(rate);
                    onTickRateChange?.(rate);
                }
                break;
            }
            case 'arduino': {
                const sub = args[0];
                if (sub === 'list-ports') {
                    const transport = useLabStore.getState().activeTransport;
                    if (!transport || typeof transport.listDevices !== 'function') {
                        addLine('No active bridge transport.', 'error');
                        break;
                    }
                    addLine('Scanning for serial devices...');
                    const listFn = transport.listDevices.bind(transport);
                    (async () => {
                        try {
                            const result = await listFn();
                            if (result && result.devices) {
                                addLine('Available Arduino/Serial Devices:');
                                result.devices.forEach((d) => {
                                    addLine(`  ${d.port} - ${d.manufacturer || 'unknown'} (${d.target || 'generic'})`);
                                });
                            }
                            else {
                                addLine('No devices found.', 'output');
                            }
                        }
                        catch (err) {
                            addLine(`Error listing devices: ${err.message}`, 'error');
                        }
                        addLine('');
                    })();
                    break;
                }
                if (sub !== 'upload') {
                    addLine(COMMAND_USAGE.arduino, 'error');
                    break;
                }
                const port = args[1];
                const filename = args[2];
                if (!port || !filename) {
                    addLine(COMMAND_USAGE.arduino, 'error');
                    break;
                }
                // Parse optional board flag
                let board = 'arduino-uno';
                const boardIndex = args.indexOf('--board');
                if (boardIndex !== -1 && args[boardIndex + 1]) {
                    const b = args[boardIndex + 1].toLowerCase();
                    if (b === 'nano')
                        board = 'arduino-nano';
                }
                const fs = useFileSystemStore.getState();
                const file = fs.getFile(filename) || fs.getAllFiles().find(f => f.name === filename);
                if (!file || !file.content) {
                    addLine(`File not found: ${filename}`, 'error');
                    break;
                }
                addLine(`Preparing upload for ${board} on ${port}...`);
                const transport = useLabStore.getState().activeTransport;
                if (!transport || typeof transport.uploadSketch !== 'function') {
                    addLine('Active transport does not support sketch uploads (switch to HARDWARE mode).', 'error');
                    break;
                }
                const fqbn = board === 'arduino-uno' ? 'arduino:avr:uno' : 'arduino:avr:nano';
                const uploadFn = transport.uploadSketch.bind(transport);
                (async () => {
                    try {
                        const result = await uploadFn({
                            target: board,
                            port,
                            fqbn,
                            sketchText: file.content
                        });
                        if (result && result.ok) {
                            addLine(`✓ Success: ${result.message || 'Sketch uploaded.'}`);
                            addLine(`  Artifact SHA256: ${result.artifact?.sketchSha256.substring(0, 12)}...`);
                        }
                        else {
                            addLine(`✖ Failed: ${result?.message || 'Unknown error'}`, 'error');
                            if (result?.errorCode)
                                addLine(`  Code: ${result.errorCode}`, 'error');
                        }
                    }
                    catch (err) {
                        addLine(`✖ Error: ${err.message}`, 'error');
                    }
                    addLine('');
                })();
                break;
            }
            case 'files': {
                const sub = args[0];
                if (!sub || sub === 'list') {
                    const files = listFiles();
                    if (files.length === 0) {
                        addLine('No saved circuits found.');
                    }
                    else {
                        addLine('Saved circuits:');
                        files.forEach((file) => addLine(`  ${file.id} - ${file.name} (updated ${new Date(file.updated_at).toLocaleString()})`));
                    }
                    break;
                }
                if (sub === 'open') {
                    const fileId = args[1];
                    const file = fileId ? getFile(fileId) : null;
                    if (file) {
                        addLine(`Opening file: ${file.name}`);
                        onOpenApp?.('logic-playground', { initialFileId: file.id });
                    }
                    else {
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
                    }
                    else {
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
                }
                catch { }
                addLine('Restarting RedByte OS…');
                setTimeout(() => window.location.reload(), 300);
                break;
            }
            case 'lab': {
                const sub = args[0];
                if (!sub) {
                    addLine(COMMAND_USAGE.lab, 'error');
                    break;
                }
                if (sub === 'ls') {
                    // List .labcapsule.json or .rb-lab.zip files
                    const fs = useFileSystemStore.getState();
                    const allFiles = fs.getAllFiles();
                    const capsules = allFiles.filter((f) => f.name.endsWith('.labcapsule.json') || f.name.endsWith('.rb-lab.zip')).sort((a, b) => a.name.localeCompare(b.name));
                    if (capsules.length === 0) {
                        addLine('No lab capsule files found.');
                    }
                    else {
                        addLine('Lab capsules:');
                        capsules.forEach((f) => addLine(`  ${f.id} - ${f.name}`));
                    }
                    break;
                }
                if (sub === 'open') {
                    const fileId = args[1];
                    if (!fileId) {
                        addLine('Usage: lab open <fileId>', 'error');
                        break;
                    }
                    const fs = useFileSystemStore.getState();
                    const file = fs.getFile(fileId);
                    if (!file) {
                        addLine('File not found. Use "lab ls".', 'error');
                        break;
                    }
                    addLine(`Opening lab: ${file.name}`);
                    // Open in Virtual Lab or Lab Assignment based on file type
                    onOpenApp?.('virtual-lab', { initialCapsuleId: file.id });
                    logCommandEvent('info', 'Lab opened', { fileId });
                    break;
                }
                if (sub === 'export') {
                    addLine('Exporting current lab session...');
                    addLine('Use the Export button in Virtual Lab for full capsule export.', 'output');
                    break;
                }
                if (sub === 'verify') {
                    const fileId = args[1];
                    if (!fileId) {
                        addLine('Usage: lab verify <fileId>', 'error');
                        break;
                    }
                    const fs = useFileSystemStore.getState();
                    const file = fs.getFile(fileId);
                    if (!file || !file.content) {
                        addLine('File not found or empty.', 'error');
                        break;
                    }
                    try {
                        const capsule = JSON.parse(file.content);
                        const hasHash = !!capsule.meta?.capsuleHash || !!capsule.meta?.deterministicHash;
                        addLine(`Capsule: ${file.name}`);
                        addLine(`  Version: ${capsule.meta?.capsuleVersion ?? 'unknown'}`);
                        addLine(`  Hash: ${hasHash ? 'Present' : 'Missing'}`);
                        addLine(`  Status: ${hasHash ? '✓ Verified' : '⚠ Unverified'}`);
                    }
                    catch {
                        addLine('Failed to parse capsule.', 'error');
                    }
                    break;
                }
                if (sub === 'replay') {
                    const fileId = args[1];
                    if (!fileId) {
                        addLine('Usage: lab replay <fileId>', 'error');
                        break;
                    }
                    const fs = useFileSystemStore.getState();
                    const file = fs.getFile(fileId);
                    if (!file) {
                        addLine('File not found. Use "lab ls".', 'error');
                        break;
                    }
                    addLine(`Opening replay: ${file.name}`);
                    onOpenApp?.('virtual-lab', { initialCapsuleId: file.id, replayMode: true });
                    logCommandEvent('info', 'Lab replay', { fileId });
                    break;
                }
                addLine(COMMAND_USAGE.lab, 'error');
                break;
            }
            default:
                addLine('Command not found. Type "help".', 'error');
        }
        addLine('');
    };
    const openPalette = () => {
        setPaletteOpen(true);
        setPaletteQuery('');
        setPaletteIndex(0);
    };
    const closePalette = () => {
        setPaletteOpen(false);
        setPaletteQuery('');
        setPaletteIndex(0);
        inputRef.current?.focus();
    };
    const handlePaletteSelect = (commandId) => {
        closePalette();
        handleCommand(commandId);
    };
    const handlePaletteKeyDown = (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closePalette();
            return;
        }
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setPaletteIndex((prev) => Math.min(prev + 1, paletteItems.length - 1));
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setPaletteIndex((prev) => Math.max(prev - 1, 0));
            return;
        }
        if (event.key === 'Enter') {
            event.preventDefault();
            const selected = paletteItems[paletteIndex];
            if (selected) {
                handlePaletteSelect(selected.id);
            }
        }
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        if (input.trim()) {
            handleCommand(input);
            setInput('');
        }
    };
    const handleInputKeyDown = (event) => {
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') {
            event.preventDefault();
            openPalette();
        }
    };
    const getLineColor = (type) => {
        switch (type) {
            case 'input':
                return 'text-green-400';
            case 'error':
                return 'text-red-400';
            default:
                return 'text-gray-300';
        }
    };
    return (_jsxs("div", { className: "h-full flex flex-col font-mono text-sm relative", style: { background: 'var(--rb-bg)', color: 'var(--rb-text)' }, children: [_jsx("div", { ref: scrollRef, className: "flex-1 overflow-y-auto p-4 space-y-1", onClick: () => inputRef.current?.focus(), children: lines.map((line, i) => (_jsx("div", { className: getLineColor(line.type), title: line.title, children: line.text || '\u00A0' }, i))) }), _jsx("form", { onSubmit: handleSubmit, className: "border-t p-4", style: { borderColor: 'var(--rb-border)' }, children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-cyan-300", children: ">" }), _jsx("input", { ref: inputRef, type: "text", value: input, onChange: (e) => setInput(e.target.value), onKeyDown: handleInputKeyDown, className: "flex-1 bg-transparent outline-none", "aria-label": "Terminal command input", placeholder: "Enter a command", autoFocus: true, spellCheck: false })] }) }), paletteOpen && (_jsx("div", { className: "absolute inset-0 bg-black/70 flex items-start justify-center pt-16", onKeyDown: handlePaletteKeyDown, children: _jsxs("div", { className: "w-full max-w-lg rounded-lg shadow-2xl", style: { border: '1px solid var(--rb-border)', background: 'var(--rb-surface-0)' }, children: [_jsxs("div", { className: "flex items-center gap-2 px-3 py-2 text-xs", style: { borderBottom: '1px solid var(--rb-border)', color: 'var(--rb-text-3)' }, children: [React.createElement(Icon, { name: 'search', size: 16 }), _jsx("input", { value: paletteQuery, onChange: (e) => setPaletteQuery(e.target.value), className: "flex-1 bg-transparent outline-none", style: { color: 'var(--rb-text)' }, placeholder: "Filter commands...", autoFocus: true }), _jsx("span", { className: "text-[10px]", style: { color: 'var(--rb-text-3)' }, children: "Esc" })] }), _jsxs("div", { className: "max-h-72 overflow-y-auto", children: [paletteItems.length === 0 && (_jsx("div", { className: "px-3 py-3 text-xs", style: { color: 'var(--rb-text-3)' }, children: "No matches." })), paletteItems.map((item, index) => (_jsxs("button", { onClick: () => handlePaletteSelect(item.id), className: "w-full text-left px-3 py-2 text-xs", style: {
                                        borderBottom: '1px solid var(--rb-surface-0)',
                                        background: index === paletteIndex ? 'var(--rb-accent-muted)' : 'transparent',
                                        color: index === paletteIndex ? 'var(--rb-accent)' : 'var(--rb-text-2)',
                                    }, children: [_jsx("div", { className: "font-mono", style: { color: 'var(--rb-text)' }, children: item.id }), _jsx("div", { className: "text-[11px]", style: { color: 'var(--rb-text-3)' }, children: item.label })] }, item.id)))] })] }) }))] }));
};
export const TerminalApp = {
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
