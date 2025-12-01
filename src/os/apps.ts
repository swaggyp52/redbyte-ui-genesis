export type AppId = 'terminal' | 'notes' | 'calculator' | 'system';

export interface AppDefinition {
  id: AppId;
  name: string;
  description: string;
  iconEmoji: string;
  accent: string;
}

export const APPS: AppDefinition[] = [
  {
    id: 'terminal',
    name: 'Terminal',
    description: 'Run fake RedbyteOS commands and see logs.',
    iconEmoji: '⌨️',
    accent: 'from-slate-700 to-slate-900',
  },
  {
    id: 'notes',
    name: 'Notes',
    description: 'Quick scratchpad that persists in your browser.',
    iconEmoji: '📝',
    accent: 'from-amber-500 to-amber-700',
  },
  {
    id: 'calculator',
    name: 'Calculator',
    description: 'Simple calculator for quick math.',
    iconEmoji: '🧮',
    accent: 'from-emerald-500 to-emerald-700',
  },
  {
    id: 'system',
    name: 'System Monitor',
    description: 'See basic RedbyteOS info + fake stats.',
    iconEmoji: '📊',
    accent: 'from-sky-500 to-indigo-600',
  },
];

export function getAppById(id: AppId): AppDefinition {
  const app = APPS.find((a) => a.id === id);
  if (!app) {
    throw new Error('Unknown app id: ' + id);
  }
  return app;
}
