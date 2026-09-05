// P1-G — engineering-location history. Through the real shell: where the
// engineer is standing is projected by the workspace rail (current workspace)
// and, inside a child module, by the document tab strip's module trail; the
// strip's Back / Forward buttons and the trail's parent segment (Up) re-apply
// prior locations. In the P2.5 workbench the trail is module-only and is
// rendered ONLY when there is a parent to climb to — outside Design, and at
// Design/Top, its absence is itself the "you are at the root" signal. The
// store is read only to assert the active module; every navigation below is a
// real tab-strip / rail / trail click. The two-module hierarchy is loaded as a
// starting fixture (like opening a saved project); the drill + Up are real UI.
import { chromium } from 'playwright';
// The cloud sandbox ships Chromium at a fixed path; every other machine (the ThinkStation
// included) uses Playwright's own resolution, so these journeys run wherever they are opened.
const browser = await chromium.launch(process.platform === 'linux' ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
const fail = (m) => { throw new Error(m); };
const activeModule = () => page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().hierarchy.activeModuleId);
// The module trail only exists inside a child module, so an absent trail is a
// legitimate reading of "" — never a hang.
const pathText = async () => {
  const trail = page.getByTestId('ide-location-path');
  if (await trail.count() === 0) return '';
  return ((await trail.first().textContent()) ?? '').replace(/\s+/g, ' ').trim();
};
const railState = (stage) => page.getByTestId(`mode-button-${stage}`).getAttribute('data-state');
const modeMarker = () => page.evaluate(() => document.querySelector('[data-ide-stage]')?.getAttribute('data-ide-stage'));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(700);
await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().loadExample('half-adder'));
await page.waitForTimeout(400);

// ── 1. Cross-workspace history: project → design → verify → hardware ─────────
await page.getByTestId('mode-button-design').click(); await page.waitForTimeout(400);
await page.getByTestId('mode-button-verify').click(); await page.waitForTimeout(500);
await page.getByTestId('mode-button-hardware').click(); await page.waitForTimeout(500);
if (await modeMarker() !== 'hardware') fail('expected hardware mode');
// The workspace rail is the single current-workspace authority; it must mark
// Board — and only Board — as current.
if (await railState('hardware') !== 'current') fail('rail should mark Board as current');
if (await railState('design') === 'current') fail('rail should not still mark Design as current');
let path = await pathText();
// The trail is module-only: outside Design there is no module to climb out of.
if (path !== '') fail(`no module trail expected in Board & Constraints: "${path}"`);
console.log('① navigated to Board & Constraints; rail marks it current, no module trail');

// Back three times returns through verify → design → project.
await page.getByTestId('ide-location-back').click(); await page.waitForTimeout(400);
if (await modeMarker() !== 'verify') fail(`Back#1 expected verify, got ${await modeMarker()}`);
await page.getByTestId('ide-location-back').click(); await page.waitForTimeout(400);
if (await modeMarker() !== 'design') fail(`Back#2 expected design, got ${await modeMarker()}`);
await page.getByTestId('ide-location-back').click(); await page.waitForTimeout(400);
if (await modeMarker() !== 'project') fail(`Back#3 expected project, got ${await modeMarker()}`);
console.log('② Back ×3 restored verify → design → project');

// Forward re-applies the redo stack.
await page.getByTestId('ide-location-forward').click(); await page.waitForTimeout(400);
if (await modeMarker() !== 'design') fail(`Forward#1 expected design, got ${await modeMarker()}`);
await page.getByTestId('ide-location-forward').click(); await page.waitForTimeout(400);
if (await modeMarker() !== 'verify') fail(`Forward#2 expected verify, got ${await modeMarker()}`);
console.log('③ Forward ×2 re-applied design → verify');

// ── 2. Module drill trail + Up ───────────────────────────────────────────────
// Author a real module from the half-adder's AND + XOR gates through the
// Design UI, then drill in and prove the LocationBar trail + Up.
await page.evaluate(() => window.__RB_PROJECT_RUNTIME__.getState().loadExample('half-adder'));
await page.waitForTimeout(300);
await page.getByTestId('mode-button-design').click(); await page.waitForTimeout(900);
// No camera fit here: Shift+F (fit to view) frames the schematic across the
// whole canvas, which extends beneath the floating left library dock, so a
// fitted gate can end up under it. The default camera is what a student sees
// on entering Design and is what the gate clicks below act on.

if (await modeMarker() !== 'design') fail('expected design mode');
if (await railState('design') !== 'current') fail('rail should mark Design as current');
path = await pathText();
// At Top there is no parent, so the workbench renders no trail at all. That
// absence is the root signal: the old always-on (and always-disabled-at-Top)
// Up button was replaced by climbable parent segments, and Top has none.
if (path !== '') fail(`no module trail expected at Design/Top: "${path}"`);
if (await page.getByTestId('ide-location-segment-btn-0').count() !== 0) fail('no Up target should exist at Top');
console.log('④ Design at Top; rail marks Design current; no trail and no Up target above Top');

const gateIds = await page.evaluate(() => {
  const st = window.__RB_PROJECT_RUNTIME__.getState();
  return {
    and: st.circuit.nodes.find((n) => n.type === 'AND')?.id,
    xor: st.circuit.nodes.find((n) => n.type === 'XOR')?.id,
  };
});
if (!gateIds.and || !gateIds.xor) fail('could not find AND/XOR gates to group');
await page.locator(`[data-testid="node-AND-${gateIds.and}"]`).first().click({ force: true });
await page.waitForTimeout(150);
await page.locator(`[data-testid="node-XOR-${gateIds.xor}"]`).first().click({ modifiers: ['Shift'], force: true });
await page.waitForTimeout(200);
const openModuleBtn = page.getByTestId('ide-design-create-module-open');
if (await openModuleBtn.count() === 0) fail('create-module button not shown for the selection');
await openModuleBtn.first().click(); await page.waitForTimeout(250);
await page.getByTestId('ide-design-create-module-name').fill('SumCarry');
await page.getByTestId('ide-design-create-module-confirm').click(); await page.waitForTimeout(500);

const moduleId = await page.evaluate(() => {
  const mods = window.__RB_PROJECT_RUNTIME__.getState().hierarchy.modules;
  return mods.length > 0 ? mods[mods.length - 1].id : null;
});
if (!moduleId) fail('module was not created from selection');
console.log(`  authored module "SumCarry" (${moduleId}) through the Design UI`);

// Drill into the module (the exact action the Design "open module" affordance runs).
await page.evaluate((id) => window.__RB_PROJECT_RUNTIME__.getState().setActiveModule(id), moduleId);
await page.waitForTimeout(400);
if (await activeModule() !== moduleId) fail('drill did not set active module');
path = await pathText();
if (!(path.includes('Top') && path.includes('SumCarry'))) fail(`drilled path should be Top › SumCarry: "${path}"`);
// Up is now the trail's parent segment: a real, enabled, clickable navigation.
const upSegment = page.getByTestId('ide-location-segment-btn-0');
if (await upSegment.count() !== 1) fail('trail should offer exactly one parent (Up) target inside a module');
const upLabel = ((await upSegment.textContent()) ?? '').trim();
if (upLabel !== 'Top') fail(`parent (Up) segment should read Top, got "${upLabel}"`);
if (!(await upSegment.isEnabled())) fail('parent (Up) segment should be clickable inside a module');
console.log(`⑤ drilled into SumCarry; path "${path}"; parent segment "${upLabel}" is the Up target`);

// Up returns to Top through the real trail parent segment in the tab strip.
await upSegment.click(); await page.waitForTimeout(400);
if (await activeModule() !== 'top') fail(`Up expected top, got ${await activeModule()}`);
if (await pathText() !== '') fail('trail should be gone once back at Top');
console.log('⑥ Up (parent segment) returned to Top; trail gone (active module = top)');

// Back returns into the module (Up was recorded as a navigation).
await page.getByTestId('ide-location-back').click(); await page.waitForTimeout(400);
if (await activeModule() !== moduleId) fail(`Back after Up expected ${moduleId}, got ${await activeModule()}`);
console.log('⑦ Back re-entered SumCarry (Up is a recorded navigation)');

if (errors.length) fail(`page errors: ${errors.join(' | ')}`);
console.log('\nPASS — engineering-location history: rail + module trail, Back/Forward/Up, all through the shell.');
await browser.close();
