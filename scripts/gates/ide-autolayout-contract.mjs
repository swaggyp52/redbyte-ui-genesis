// Gate: ide-autolayout-contract
// Verifies that after professor ZIP import + Apply, nodes are:
//   (a) spread across the canvas (not all at the same x)
//   (b) non-overlapping (no two nodes share the same position)
//   (c) cover a minimum horizontal span (> 80px on screen)
//   (d) all visible in the viewport (auto-fit worked)

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runIdeGate, assert } from './_gateHarness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.resolve(
  __dirname,
  '../../packages/rb-apps/src/fixtures/import/zip/02-vivado-nested-andgate.zip'
);

await runIdeGate('IDE auto-layout contract satisfied', async ({ page, baseUrl }) => {
  // ── 1. Navigate to Import ─────────────────────────────────────────────────
  // Suppress the first-visit onboarding overlay so it does not intercept pointer events.
  await page.addInitScript(() => { localStorage.setItem('rb-onboarding-v1-seen', '1'); });
  await page.goto(`${baseUrl}/?mode=import`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
  await page.waitForSelector('[data-testid="ide-mode-import"]', { timeout: 15000 });

  // ── 2. Upload nested Vivado fixture ───────────────────────────────────────
  const zipBytes = readFileSync(FIXTURE_PATH);
  const zipInput = page.locator('[data-testid="ide-import-zip-input"]');
  await zipInput.setInputFiles({
    name: '02-vivado-nested-andgate.zip',
    mimeType: 'application/zip',
    buffer: zipBytes,
  });

  // ── 3. Wait for inspection ────────────────────────────────────────────────
  await page.waitForSelector('[data-testid="ide-import-zip-inspection"]', { timeout: 15000 });

  // ── 4. Apply + confirm ────────────────────────────────────────────────────
  const applyBtn = page.locator('[data-testid="ide-import-process-design"]');
  const disabled = await applyBtn.getAttribute('disabled');
  assert(disabled === null, 'Apply button must not be disabled');
  await applyBtn.click();

  const confirmBtn = page.locator('[data-testid="ide-import-apply-confirm"]');
  const confirmVisible = await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (confirmVisible) {
    await confirmBtn.click();
  }

  // ── 5. Navigate to Design ─────────────────────────────────────────────────
  await page.locator('[data-testid="mode-button-design"]').click();
  await page.waitForSelector('[data-testid="ide-mode-design"]', { timeout: 10000 });

  // Give auto-fit and canvas resize time to settle
  await page.waitForTimeout(800);

  // ── 6. Collect node positions from DOM ───────────────────────────────────
  const nodeCount = await page.locator('[data-node-id]').count();
  assert(nodeCount >= 3, `Must have ≥3 nodes after AND-gate import, got ${nodeCount}`);

  const boxes = await page.locator('[data-node-id]').evaluateAll((nodes) =>
    nodes.map((n) => {
      const rect = n.getBoundingClientRect();
      return {
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
      };
    })
  );

  // (a) Nodes must be spread: at least 2 distinct x centre positions
  const uniqueX = new Set(boxes.map((b) => Math.round(b.cx)));
  assert(
    uniqueX.size >= 2,
    `Nodes must have ≥2 distinct screen-x positions — got ${uniqueX.size}: ${[...uniqueX].join(', ')}`
  );

  // (b) Horizontal span > 80px on screen (nodes not all piled up)
  const minX = Math.min(...boxes.map((b) => b.cx));
  const maxX = Math.max(...boxes.map((b) => b.cx));
  const spanX = maxX - minX;
  assert(spanX > 80, `Horizontal node span must be > 80px, got ${spanX.toFixed(0)}px`);

  // (c) No two nodes have identical screen centre (non-overlapping)
  const centres = boxes.map((b) => `${Math.round(b.cx)},${Math.round(b.cy)}`);
  const uniqueCentres = new Set(centres);
  assert(
    uniqueCentres.size === centres.length,
    `All nodes must have unique screen centres — found duplicate in: ${centres.join(' | ')}`
  );

  // (d) All nodes are visible within the canvas area (auto-fit worked)
  const liveCanvasBox = await page.locator('[data-testid="ide-design-live-canvas"]').boundingBox();
  assert(liveCanvasBox, 'Live canvas element must be visible');
  const pad = 5; // tolerance for borders/shadows
  for (const b of boxes) {
    assert(
      b.top >= liveCanvasBox.y - pad &&
      b.bottom <= liveCanvasBox.y + liveCanvasBox.height + pad &&
      b.left >= liveCanvasBox.x - pad &&
      b.right <= liveCanvasBox.x + liveCanvasBox.width + pad,
      `Node rect (top=${b.top.toFixed(0)} bottom=${b.bottom.toFixed(0)} left=${b.left.toFixed(0)} right=${b.right.toFixed(0)}) is outside live canvas (y=${liveCanvasBox.y.toFixed(0)}..${(liveCanvasBox.y + liveCanvasBox.height).toFixed(0)} x=${liveCanvasBox.x.toFixed(0)}..${(liveCanvasBox.x + liveCanvasBox.width).toFixed(0)})`
    );
  }
});

