import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';

const buildFixture = async (): Promise<string> => {
  const source = `import React from 'react';
import { createRoot } from 'react-dom/client';
import { Desktop, Taskbar } from '../src';
import type { AppManifest } from '@rb/rb-apps';

const apps: AppManifest[] = [{ id: 'terminal', title: 'Terminal' }];

const App = () => (
  <Desktop apps={apps}>
    <Taskbar />
  </Desktop>
);

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing root');
}

const root = createRoot(container);
root.render(<App />);`;

  const result = await build({
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    loader: { '.tsx': 'tsx', '.ts': 'ts' },
    stdin: {
      contents: source,
      resolveDir: path.resolve(__dirname, '../../src'),
      sourcefile: 'app.tsx',
    },
    tsconfigRaw: {
      compilerOptions: {
        jsx: 'react-jsx',
        paths: {
          '@rb/*': ['../*/src'],
        },
      },
    },
  });

  return result.outputFiles[0].text;
};

test('window lifecycle: launch, move, resize, minimize, restore', async ({ page }) => {
  const script = await buildFixture();
  const encoded = Buffer.from(script).toString('base64');

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.setContent(
    `<div id="root"></div><script type="module" src="data:text/javascript;base64,${encoded}"></script>`,
  );

  await page.getByRole('menuitem', { name: 'Terminal' }).click();
  const windowDialog = page.getByRole('dialog', { name: /Terminal window/ });
  await expect(windowDialog).toBeVisible();
  const initialBox = await windowDialog.boundingBox();
  if (!initialBox) throw new Error('No window bounding box');

  await page.mouse.move(initialBox.x + 50, initialBox.y + 20);
  await page.mouse.down();
  await page.mouse.move(initialBox.x + 120, initialBox.y + 80);
  await page.mouse.up();

  const movedBox = await windowDialog.boundingBox();
  if (!movedBox) throw new Error('No moved bounding box');
  expect(movedBox.x).toBeGreaterThan(initialBox.x);

  const resizeHandle = windowDialog.getByLabel('Resize handle');
  const resizeBox = await resizeHandle.boundingBox();
  if (!resizeBox) throw new Error('No resize handle');
  await page.mouse.move(resizeBox.x + 2, resizeBox.y + 2);
  await page.mouse.down();
  await page.mouse.move(resizeBox.x + 60, resizeBox.y + 40);
  await page.mouse.up();

  const resizedBox = await windowDialog.boundingBox();
  if (!resizedBox) throw new Error('No resized bounding box');
  expect(resizedBox.width).toBeGreaterThan(initialBox.width);

  await windowDialog.getByRole('button', { name: 'Maximize window' }).click();
  const maximized = await windowDialog.boundingBox();
  if (!maximized) throw new Error('No maximized box');
  expect(maximized.width).toBeGreaterThan(resizedBox.width);

  const taskButton = page.getByRole('button', { name: /Terminal/ });
  await taskButton.dblclick();
  await expect(windowDialog).toBeHidden();

  await taskButton.click();
  await expect(windowDialog).toBeVisible();
});
