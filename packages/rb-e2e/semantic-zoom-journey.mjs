// P1-G — model-driven semantic zoom. The Design canvas density tier follows
// the camera: zoom out past the threshold and the canvas switches to the
// legible `classroom` tier; zoom back in and it returns to compact `dense`.
// Through the real UI: drive the zoom buttons and assert the canvas's
// data-presentation-zoom tier tracks the model.
import { chromium } from 'playwright';
// The cloud sandbox ships Chromium at a fixed path; every other machine (the ThinkStation
// included) uses Playwright's own resolution, so these journeys run wherever they are opened.
const browser = await chromium.launch(process.platform === 'linux' ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
const fail = (m) => { throw new Error(m); };
const tier = () => page.evaluate(() => document.querySelector('[data-presentation-zoom]')?.getAttribute('data-presentation-zoom'));
const zoomPct = async () => {
  const t = (await page.getByTestId('ide-design-zoom-readout').textContent()) ?? '';
  return parseInt(t.replace('%', ''), 10);
};

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(700);
await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().loadExample('half-adder'));
await page.waitForTimeout(300);
await page.getByTestId('mode-button-design').click(); await page.waitForTimeout(700);

// At the default zoom the canvas edits closely → dense/detail tier.
if (await tier() !== 'dense') fail(`expected dense tier at default zoom, got ${await tier()}`);
console.log(`① default zoom ${await zoomPct()}% → tier "dense" (detail)`);

// Zoom out until below the classroom threshold (~72%).
for (let i = 0; i < 12 && (await zoomPct()) > 65; i += 1) {
  await page.getByTestId('ide-design-zoom-out').click(); await page.waitForTimeout(120);
}
const outPct = await zoomPct();
if (outPct > 72) fail(`could not zoom out below threshold (at ${outPct}%)`);
await page.waitForTimeout(200);
if (await tier() !== 'classroom') fail(`expected classroom tier when zoomed out to ${outPct}%, got ${await tier()}`);
if (await page.getByTestId('ide-design-presentation-zoom-indicator').count() === 0)
  fail('classroom indicator not shown when zoomed out');
console.log(`② zoomed out to ${outPct}% → tier "classroom" (legible overview) + indicator shown`);

// Zoom back in above the exit threshold (~85%).
for (let i = 0; i < 14 && (await zoomPct()) < 95; i += 1) {
  await page.getByTestId('ide-design-zoom-in').click(); await page.waitForTimeout(120);
}
const inPct = await zoomPct();
if (inPct < 85) fail(`could not zoom back in above threshold (at ${inPct}%)`);
await page.waitForTimeout(200);
if (await tier() !== 'dense') fail(`expected dense tier when zoomed in to ${inPct}%, got ${await tier()}`);
console.log(`③ zoomed back in to ${inPct}% → tier "dense" (detail) — hysteresis held cleanly`);

if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log('\nPASS — model-driven semantic zoom: the canvas density tier follows the camera.');
await browser.close();
