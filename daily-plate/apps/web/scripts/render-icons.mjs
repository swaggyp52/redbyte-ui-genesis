import { chromium } from '@playwright/test';
import fs from 'node:fs';
const svg = fs.readFileSync(process.argv[2], 'utf8');
const outDir = process.argv[3];
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const targets = [
  ['icon-512.png', 512, false],
  ['icon-192.png', 192, false],
  ['apple-touch-icon.png', 180, false],
  ['icon-512-maskable.png', 512, true],
];
for (const [name, size, maskable] of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const inner = maskable ? svg.replace('<rect width="512" height="512" rx="112" fill="#FAF7F0"/>', '<rect width="512" height="512" fill="#FAF7F0"/>').replace('viewBox="0 0 512 512"', 'viewBox="-64 -64 640 640"') : svg;
  await page.setContent(`<html><body style="margin:0;background:${maskable ? '#FAF7F0' : 'transparent'}">${inner.replace(/width="512" height="512"/, `width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: `${outDir}/${name}`, omitBackground: !maskable, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
}
await browser.close();
console.log('icons written');
