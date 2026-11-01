import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STUDIO_KEYMAP } from '../keymap';

// The shipped workbench keys, read from their sources (the studio may not edit legacy surfaces).
const source = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
  .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
const modal = source('../../../rb-apps/src/apps/ide/components/KeyboardShortcutsModal.tsx');
const ide = source('../../../rb-apps/src/apps/IdeApp.tsx');

function tokens(keys: string): string[] {
  return keys.split(' / ').map((key) => key.trim().toLowerCase().replace(/\s+/g, '+').replace(/^escape$/, 'esc'));
}

const shipped = new Map<string, string>();
for (const match of modal.matchAll(/\{ action: '([^']+)', keys: '([^']+)' \}/g)) {
  for (const key of tokens(match[2])) shipped.set(key, match[1]);
}
for (const line of ide.split('\n').filter((text) => text.includes('shortcut: { key:'))) {
  const title = /title: ['`]([^'`]+)['`]/.exec(line)?.[1] ?? 'command';
  const label = /shortcut: \{ key: '[^']+'(?:, modifiers: \[[^\]]*\])?, label: '([^']+)' \}/.exec(line)?.[1];
  if (label) for (const key of tokens(label)) if (!shipped.has(key)) shipped.set(key, title);
}
// The command palette is bound directly in IdeApp's key handler.
if (/event\.key\.toLowerCase\(\) === 'k'/.test(ide)) shipped.set('ctrl+k', 'Command palette');

describe('studio keymap', () => {
  it('reads the shipped workbench keys', () => {
    for (const key of ['1', '2', '3', '4', '5', 'ctrl+s', 'ctrl+z', 'ctrl+shift+z', 'ctrl+y', 'ctrl+k', '?', 'f', '←', '→', 'esc', 'delete', 's', 'w', 'g', 'r', 'j', 'k']) {
      expect(shipped.has(key), key).toBe(true);
    }
  });

  it('collides with a shipped key only where it keeps the shipped meaning', () => {
    const collisions = STUDIO_KEYMAP.flatMap((binding) => tokens(binding.keys).filter((key) => shipped.has(key)).map((key) => `${key} · ${binding.action}`));
    const declared = STUDIO_KEYMAP.filter((binding) => binding.extendsShipped).flatMap((binding) => tokens(binding.keys).map((key) => `${key} · ${binding.action}`));
    expect(collisions.sort()).toEqual(declared.sort());
  });

  it('never binds Alt (browser Back/Forward) and never binds one key twice in overlapping scopes', () => {
    const seen = new Map<string, string>();
    for (const binding of STUDIO_KEYMAP) {
      expect(binding.keys.toLowerCase()).not.toContain('alt');
      for (const key of tokens(binding.keys)) {
        const previous = seen.get(key);
        expect(previous === undefined || (previous !== 'global' && binding.scope !== 'global' && previous !== binding.scope), `${key} bound twice`).toBe(true);
        seen.set(key, binding.scope);
      }
    }
  });
});
