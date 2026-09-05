// P2.5 Slice 2 proof — the no-circuit Project landing. Clears storage so the
// student sees the first-launch landing, then captures it at both viewports and
// asserts: one dominant primary ("Start a Lab"), a single subordinate cluster of
// alternatives, the old restating summary line is gone, and no overflow.
import { chromium } from 'playwright';
// The cloud sandbox ships Chromium at a fixed path; every other machine (the ThinkStation
// included) uses Playwright's own resolution, so these journeys run wherever they are opened.
const browser = await chromium.launch(process.platform === 'linux' ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const fail = (m) => { throw new Error(m); };
const OUT = '/tmp/claude-0/-home-user-redbyte-ui-genesis/b4914bef-2a1a-55cb-97de-096a331aef03/scratchpad';

async function run(width, height) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // Landing renders only with no circuit. Ensure we are on the Project stage.
  await page.getByTestId('mode-button-project').click();
  await page.waitForTimeout(300);

  const landing = page.getByTestId('ide-project-landing');
  if (await landing.count() === 0) fail('Project landing not shown on fresh load');

  // ① One dominant primary action.
  const primary = page.getByTestId('ide-project-start-a-lab-primary');
  if (await primary.count() === 0) fail('Start a Lab primary missing');
  if (!((await primary.textContent()) ?? '').includes('Course labs')) fail('primary label wrong');
  if (await primary.getAttribute('data-product-priority') !== 'primary') fail('primary not marked priority');

  // ② The alternatives are one subordinate cluster, not peer buttons.
  const secondary = page.locator('.rb-start-nav-actions');
  if (await secondary.count() === 0) fail('subordinate cluster missing');
  for (const t of ['ide-project-import-primary', 'ide-project-open-existing-primary', 'ide-project-build-fresh-primary']) {
    if (await secondary.getByTestId(t).count() === 0) fail(`alternative not in the subordinate cluster: ${t}`);
  }

  // ③ The old restating summary line is gone (hierarchy is shown, not narrated).
  if (await page.getByTestId('ide-project-start-summary').count() !== 0) fail('restating start-summary line should be removed');

  // ④ The library opens on Course labs with a real preview and one Start command.
  const primaryBox = await primary.boundingBox();
  const anAltBox = await secondary.getByTestId('ide-project-import-primary').boundingBox();
  if (!primaryBox || !anAltBox) fail('could not measure action geometry');
  if (await page.getByTestId('ide-project-start-figure').count() === 0) fail('selected lab has no real preview figure');
  if (await page.locator('.rb-start-primary').count() !== 1) fail('expected exactly one primary Start command in the preview');

  // ⑤ No horizontal overflow.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`horizontal overflow at ${width}×${height}: ${overflow}px`);

  await page.screenshot({ path: `${OUT}/slice2-project-landing-${width}x${height}.png` });
  if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
  await context.close();
  console.log(`[${width}×${height}] PASS — Course labs section with subordinate actions and a real preview`);
}

await run(1440, 900);
await run(1366, 768);
await browser.close();
console.log('\nPASS — Slice 2 Project landing: one dominant action + subordinate alternatives.');
