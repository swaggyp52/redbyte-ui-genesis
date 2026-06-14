import { expect, test, type Page } from '@playwright/test';

async function dismissIntroChrome(page: Page): Promise<void> {
  await page.getByTestId('ide-onboarding-skip').click({ timeout: 1_500 }).catch(() => {});
  await page.getByRole('button', { name: /Dismiss/i }).click({ timeout: 1_500 }).catch(() => {});
}

async function openProject(page: Page): Promise<void> {
  await page.goto('/?mode=project', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('ide-root')).toBeVisible({ timeout: 30_000 });
  await dismissIntroChrome(page);
}

async function openMode(page: Page, mode: 'project' | 'design' | 'verify' | 'hardware' | 'export'): Promise<void> {
  await page.getByTestId(`mode-button-${mode}`).click();
  await expect(page.getByTestId(`ide-mode-${mode}`)).toBeVisible({ timeout: 30_000 });
}

async function loadExample(page: Page, exampleId: string): Promise<void> {
  await openProject(page);
  const landingExample = page.getByTestId(`ide-project-landing-example-${exampleId}`);
  if (await landingExample.isVisible().catch(() => false)) {
    await landingExample.click();
  } else {
    await openExamplesDisclosure(page);
    const pathStep = page.getByTestId(`ide-projectx-path-step-${exampleId}`);
    if (await pathStep.isVisible().catch(() => false)) {
      await pathStep.click();
      await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30_000 });
      return;
    }
    const browserExample = page.getByTestId(`ide-project-load-start-${exampleId}`);
    if (!(await browserExample.isVisible().catch(() => false))) {
      await page.getByTestId('ide-project-landing-example-logic-gates').click();
      await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30_000 });
      await openMode(page, 'project');
      await openExamplesDisclosure(page);
    }
    await page.getByTestId(`ide-project-load-start-${exampleId}`).click();
  }
  await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30_000 });
}

async function openExamplesDisclosure(page: Page): Promise<void> {
  const disclosure = page.getByTestId('ide-project-examples-disclosure');
  if ((await disclosure.count()) === 0) return;
  if ((await disclosure.getAttribute('data-expanded').catch(() => 'true')) === 'true') return;
  await page.getByTestId('ide-projectx-examples-toggle').click();
}

function captureConsoleFailures(page: Page): string[] {
  const failures: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (
      message.type() === 'error' &&
      !text.includes('Failed to load resource: the server responded with a status of 404')
    ) {
      failures.push(text);
    }
    if (text.includes('[CircuitStore] Circuit mutation called but engines not connected!')) {
      failures.push(text);
    }
  });
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
  return failures;
}

test('ECE141 Map Pins manual edit and starter recovery smoke', async ({ page }) => {
  const consoleFailures = captureConsoleFailures(page);

  await loadExample(page, 'logic-gates');
  await openMode(page, 'hardware');

  await expect(page.getByTestId('ide-hw-map-dock')).toContainText(/Map Pins/i);
  await expect(page.getByTestId('ide-hw-map-row-sw0')).toContainText(/SW0/i);
  await expect(page.getByTestId('ide-hw-map-row-binding-sw0')).toContainText(/SW0 \(pin V17\)/i);

  await page.getByTestId('ide-hw-map-row-sw0').click();
  await expect(page.getByTestId('ide-hw-map-row-sw0')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('ide-hw-map-row-sw0')).toHaveClass(/is-selected/);
  await expect(page.getByTestId('ide-hw-map-sw-2-hit')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('ide-hw-map-sw-2-hit').click();
  await expect(page.getByTestId('ide-hw-map-row-binding-sw0')).toContainText(/SW2 \(pin W16\)/i);

  await openMode(page, 'design');
  await openMode(page, 'hardware');
  await expect(page.getByTestId('ide-hw-map-row-binding-sw0')).toContainText(/SW2 \(pin W16\)/i);

  await openMode(page, 'export');
  await page.locator('summary').filter({ hasText: /Pin binding/i }).click();
  await expect(page.getByTestId('ide-export-mapping-table')).toContainText(/SW2 \(pin W16\)/i);

  await loadExample(page, 'half-adder');
  await openMode(page, 'hardware');
  await expect(page.getByTestId('ide-hw-map-row-binding-sw0')).toContainText(/SW0 \(pin V17\)/i);
  await expect(page.getByTestId('ide-hw-map-row-binding-sw1')).toContainText(/SW1 \(pin V16\)/i);
  await expect(page.getByTestId('ide-hw-map-row-binding-sw1')).not.toContainText(/SW2/i);

  expect(consoleFailures).toEqual([]);
});
