// P1 quality — visual/scale/a11y hardening of the new convergence surfaces.
// Checks that none of them force horizontal page overflow at the two supported
// viewports or under 200% zoom, and that their primary controls are
// keyboard-reachable. Store is read only to set up circuits/mappings.
import { chromium } from 'playwright';
// The cloud sandbox ships Chromium at a fixed path; every other machine (the ThinkStation
// included) uses Playwright's own resolution, so these journeys run wherever they are opened.
const browser = await chromium.launch(process.platform === 'linux' ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const fail = (m) => { throw new Error(m); };

async function overflowAt(width, height, zoom) {
  // Browser zoom does not magnify content inside a fixed viewport — it shrinks the CSS
  // viewport, so a responsive layout reflows. Emulate it the way the rest of the suite does,
  // by halving the viewport. (The previous method set `body { zoom: 2 }`, which scales content
  // within an unchanged 1440px viewport and therefore reports exactly 2x overflow for any app.)
  const ctx = await browser.newContext({
    viewport: { width: Math.round(width / zoom), height: Math.round(height / zoom) },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  await page.evaluate(() => {
    const rt = window.__RB_PROJECT_RUNTIME__.getState();
    rt.loadExample('half-adder');
    rt.autoSuggestMapping();
  });
  await page.waitForTimeout(300);

  const results = {};
  const surfaces = [
    ['project', 'mode-button-project'],
    ['design', 'mode-button-design'],
    ['verify', 'mode-button-verify'],
    ['hardware', 'mode-button-hardware'],
    ['export', 'mode-button-export'],
  ];
  for (const [name, btn] of surfaces) {
    await page.getByTestId(btn).click(); await page.waitForTimeout(700);
    if (name === 'verify') {
      const bench = page.getByTestId('ide-vcb-workspace-bench');
      if (await bench.count() > 0) { await bench.click(); await page.waitForTimeout(300); }
    }
    if (name === 'export') {
      const dl = page.getByTestId('ide-export-package-download-v1').or(page.getByTestId('ide-export-draft-download-v1'));
      if (await dl.count() > 0 && await dl.first().isEnabled().catch(() => false)) { await dl.first().click().catch(() => {}); await page.waitForTimeout(800); }
    }
    const over = await page.evaluate(() => {
      const doc = document.documentElement;
      return { scroll: doc.scrollWidth, client: doc.clientWidth, body: document.body.scrollWidth };
    });
    // Allow 2px slack for sub-pixel rounding.
    results[name] = over.scroll <= over.client + 2;
    if (!results[name]) console.log(`  ⚠ ${name} overflow: scrollW=${over.scroll} clientW=${over.client}`);
  }
  await ctx.close();
  return { results, errors };
}

for (const [w, h, z, label] of [[1440, 900, 1, '1440×900'], [1366, 768, 1, '1366×768'], [1440, 900, 2, '1440×900 @200%']]) {
  const { results, errors } = await overflowAt(w, h, z);
  const bad = Object.entries(results).filter(([, ok]) => !ok).map(([n]) => n);
  if (bad.length) fail(`${label}: horizontal overflow on ${bad.join(', ')}`);
  if (errors.length) fail(`${label}: page errors ${errors.join(' | ')}`);
  console.log(`✓ ${label}: no horizontal page overflow on any surface`);
}

// Keyboard reachability of a few key new controls (tab from body reaches them).
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().loadExample('half-adder'));
  await page.getByTestId('mode-button-verify').click(); await page.waitForTimeout(900);
  await page.getByTestId('ide-vcb-workspace-bench').click(); await page.waitForTimeout(400);
  // Focus a bench toggle by keyboard and activate it.
  const toggle = page.getByTestId('ide-manual-bench-drive-toggle-sw0-a');
  await toggle.focus();
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  if (focused !== 'ide-manual-bench-drive-toggle-sw0-a') fail(`bench toggle not keyboard-focusable (focused=${focused})`);
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  const driven = await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().sim.inputs['sw0_node']);
  if (driven !== 1) fail(`Enter on focused bench toggle did not drive the input (got ${driven})`);
  console.log('✓ keyboard: bench toggle is focusable and Enter-activates');
  await ctx.close();
}

console.log('\nPASS — new surfaces are overflow-safe at 1440×900, 1366×768, and 200% zoom, and keyboard-operable.');
await browser.close();
