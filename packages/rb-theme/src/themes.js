// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
export const darkTheme = {
    id: 'dark',
    name: 'Dark',
    background: 'bg-zinc-950',
    foreground: 'text-zinc-50',
    accent: 'text-blue-500',
    accentSoft: 'text-blue-300',
    borderSubtle: 'border-zinc-800',
};
export const lightTheme = {
    id: 'light',
    name: 'Light',
    background: 'bg-zinc-50',
    foreground: 'text-zinc-900',
    accent: 'text-blue-600',
    accentSoft: 'text-blue-400',
    borderSubtle: 'border-zinc-200',
};
export const midnightTheme = {
    id: 'midnight',
    name: 'Midnight',
    background: 'bg-slate-950',
    foreground: 'text-slate-50',
    accent: 'text-indigo-400',
    accentSoft: 'text-indigo-300',
    borderSubtle: 'border-slate-800',
};
// Legacy aliases for backwards compatibility
export const neonTheme = darkTheme;
export const carbonTheme = darkTheme;
export const themes = [darkTheme, lightTheme, midnightTheme];
