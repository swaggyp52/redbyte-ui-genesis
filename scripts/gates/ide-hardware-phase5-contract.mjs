#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  assert,
  loadStarterProject,
  runIdeGate,
  visible,
} from './_gateHarness.mjs';
import {
  assertBuildHash,
  assertNoRootOverflow,
  captureBrowserProblems,
  installCleanStudentContext,
} from './_workbenchReconstructionHarness.mjs';

const VIEWPORTS = [
  { label: '1366x768', width: 1366, height: 768 },
  { label: '1440x900', width: 1440, height: 900 },
  { label: '1920x1080', width: 1920, height: 1080 },
];
const OUTPUT_DIR = path.resolve('.redbyte/product-immersion/unified-v3-rc/map-phase5-contract');

await runIdeGate('IDE hardware Phase 5 grouping and conflict contract satisfied', async ({ page, baseUrl }) => {
  const browserProblems = captureBrowserProblems(page);
  const failures = [];
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await installCleanStudentContext(page);

  for (const viewport of VIEWPORTS) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`${baseUrl}/?mode=project&e2e=1&gate=hardware-phase5-${viewport.label}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null);
      await page.waitForSelector('[data-testid="ide-mode-project"]', { timeout: 15000 });
      await loadStarterProject(page, { exactExampleId: 'two-bit-counter' });
      await openMode(page, 'hardware', `${viewport.label}/Map Pins`);
      await assertBuildHash(page, `${viewport.label}/Map Pins`);

      const table = page.getByTestId('ide-hw-map-table').first();
      assert(await visible(table), `${viewport.label}: primary mapping table is missing`);
      const groups = await table.locator('tbody[data-testid^="ide-hw-map-group-"]').evaluateAll((nodes) =>
        nodes.map((node) => {
          const heading = node.querySelector('.ide-hw-v3__group-heading');
          const headingStyle = heading instanceof HTMLElement ? getComputedStyle(heading) : null;
          return {
            id: node.getAttribute('data-testid'),
            text: (node.querySelector('.ide-hw-v3__group-row')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
            rowIds: [...node.querySelectorAll('[data-testid^="ide-hw-map-row-"]')]
              .map((row) => row.getAttribute('data-testid'))
              .filter((value) => value && !value.includes('-signal-') && !value.includes('-role-') && !value.includes('-binding-') && !value.includes('-status-') && !value.includes('-action-')),
            fontSize: headingStyle ? Number.parseFloat(headingStyle.fontSize) : 0,
            clipped: heading instanceof HTMLElement
              ? heading.scrollWidth > heading.clientWidth + 1 || heading.scrollHeight > heading.clientHeight + 1
              : true,
          };
        }),
      );
      const byId = new Map(groups.map((group) => [group.id, group]));
      const clockReset = byId.get('ide-hw-map-group-clock-reset');
      const inputs = byId.get('ide-hw-map-group-inputs');
      const outputs = byId.get('ide-hw-map-group-outputs');
      assert(clockReset && /clock\s*\/\s*reset/i.test(clockReset.text), `${viewport.label}: Clock / Reset group is missing: ${JSON.stringify(groups)}`);
      assert(inputs && /inputs/i.test(inputs.text), `${viewport.label}: Inputs group is missing: ${JSON.stringify(groups)}`);
      assert(outputs && /outputs/i.test(outputs.text), `${viewport.label}: Outputs group is missing: ${JSON.stringify(groups)}`);
      assert(groups.every((group) => group.fontSize >= 13), `${viewport.label}: group heading text floor failed: ${JSON.stringify(groups)}`);
      assert(groups.every((group) => !group.clipped), `${viewport.label}: group heading is intrinsically clipped: ${JSON.stringify(groups)}`);
      assert((clockReset?.rowIds.length ?? 0) >= 2, `${viewport.label}: Clock / Reset rows are not grouped together: ${JSON.stringify(clockReset)}`);
      assert((inputs?.rowIds.length ?? 0) >= 1, `${viewport.label}: Inputs group has no signal rows`);
      assert((outputs?.rowIds.length ?? 0) >= 1, `${viewport.label}: Outputs group has no signal rows`);

      const fixture = await page.evaluate(() => {
        const runtime = window.__RB_PROJECT_RUNTIME__?.getState?.();
        const rows = runtime?.projectIoRows ?? [];
        const authority = rows.find((row) => String(row.id).toLowerCase() === 'en')
          ?? rows.find((row) => /enable/i.test(String(row.label ?? '')));
        const victim = rows.find((row) =>
          row.id !== authority?.id &&
          row.direction === 'in' &&
          !/clock/i.test(String(row.timingRole ?? row.label ?? row.id))
        );
        if (!runtime?.setMappingPin || !authority || !victim) {
          throw new Error('Could not seed the duplicate EN/RST mapping fixture.');
        }
        runtime.setMappingPin(victim.id, authority.pin || 'SW0');
        return {
          authorityId: authority.id,
          authorityLabel: authority.label ?? authority.id,
          victimId: victim.id,
          victimLabel: victim.label ?? victim.id,
        };
      });

      const victimRow = page.getByTestId(`ide-hw-map-row-${fixture.victimId}`).first();
      await victimRow.getByRole('button').click();
      const callout = page.getByTestId('ide-hw-selected-mapping-conflict').first();
      await callout.waitFor({ state: 'visible', timeout: 10000 });
      const conflictText = await text(callout);
      assert(includesIdentity(conflictText, fixture.authorityLabel), `${viewport.label}: conflict copy omits ${fixture.authorityLabel}: ${conflictText}`);
      assert(includesIdentity(conflictText, fixture.victimLabel), `${viewport.label}: conflict copy omits ${fixture.victimLabel}: ${conflictText}`);
      assert(/SW0/i.test(conflictText) && /V17/i.test(conflictText), `${viewport.label}: conflict copy omits exact resource/pin: ${conflictText}`);

      const conflictGeometry = await callout.evaluate((element) => ({
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
        clipped: element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1,
      }));
      assert(conflictGeometry.fontSize >= 13, `${viewport.label}: conflict copy text floor failed: ${JSON.stringify(conflictGeometry)}`);
      assert(!conflictGeometry.clipped, `${viewport.label}: conflict copy is intrinsically clipped: ${JSON.stringify(conflictGeometry)}`);
      assert(
        !(await visible(page.getByTestId('ide-hw-export-repair-callout').first())),
        `${viewport.label}: a duplicated technical Export diagnostic wall still precedes the mapping task`,
      );
      const taskGeometry = await page.evaluate(() => {
        const table = document.querySelector('[data-testid="ide-hw-map-table"]')?.getBoundingClientRect();
        const editor = document.querySelector('[data-testid="ide-hw-selected-mapping-editor"]')?.getBoundingClientRect();
        return {
          viewportHeight: innerHeight,
          tableTop: table?.top ?? Number.POSITIVE_INFINITY,
          tableBottom: table?.bottom ?? Number.NEGATIVE_INFINITY,
          editorTop: editor?.top ?? Number.POSITIVE_INFINITY,
          editorBottom: editor?.bottom ?? Number.NEGATIVE_INFINITY,
        };
      });
      assert(
        taskGeometry.tableTop < taskGeometry.viewportHeight && taskGeometry.tableBottom > 0,
        `${viewport.label}: the mapping table does not intersect the seeded-conflict initial viewport: ${JSON.stringify(taskGeometry)}`,
      );
      assert(
        taskGeometry.editorTop < taskGeometry.viewportHeight && taskGeometry.editorBottom > 0,
        `${viewport.label}: the inline conflict editor does not intersect the seeded-conflict initial viewport: ${JSON.stringify(taskGeometry)}`,
      );
      await assertNoRootOverflow(page, `${viewport.label}/Map Pins Phase 5`);
      await page.screenshot({ path: path.join(OUTPUT_DIR, `${viewport.label}-grouped-conflict.png`), fullPage: false });
    } catch (error) {
      failures.push(`${viewport.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  assert(browserProblems.length === 0, `Hardware Phase 5 browser errors: ${JSON.stringify(browserProblems.slice(0, 8))}`);
  assert(failures.length === 0, `Hardware Phase 5 failures:\n${failures.join('\n')}`);
});

async function openMode(page, mode, label) {
  const button = page.getByTestId(`mode-button-${mode}`).first();
  assert(await visible(button), `${label}: workflow navigation control is unavailable`);
  await button.click();
  await page.waitForSelector(`[data-testid="ide-mode-${mode}"]`, { timeout: 15000 });
  await page.waitForTimeout(120);
}

function includesIdentity(textValue, identity) {
  const normalizedText = String(textValue).toUpperCase().replace(/[^A-Z0-9]+/g, ' ');
  const normalizedIdentity = String(identity).toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  return normalizedIdentity.length > 0 && normalizedText.includes(normalizedIdentity);
}

async function text(locator) {
  return ((await locator.textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
}
