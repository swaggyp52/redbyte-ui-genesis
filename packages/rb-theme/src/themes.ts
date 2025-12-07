import type { ThemeTokenSet } from './types';

export const neonTheme: ThemeTokenSet = {
  id: 'neon',
  name: 'Neon',
  background: 'bg-slate-950',
  foreground: 'text-slate-50',
  accent: 'text-pink-500',
  accentSoft: 'text-pink-300',
  borderSubtle: 'border-slate-800',
};

export const carbonTheme: ThemeTokenSet = {
  id: 'carbon',
  name: 'Carbon',
  background: 'bg-neutral-900',
  foreground: 'text-neutral-50',
  accent: 'text-blue-500',
  accentSoft: 'text-blue-300',
  borderSubtle: 'border-neutral-700',
};

export const midnightTheme: ThemeTokenSet = {
  id: 'midnight',
  name: 'Midnight',
  background: 'bg-indigo-950',
  foreground: 'text-indigo-50',
  accent: 'text-purple-500',
  accentSoft: 'text-purple-300',
  borderSubtle: 'border-indigo-800',
};

export const themes: ThemeTokenSet[] = [neonTheme, carbonTheme, midnightTheme];
