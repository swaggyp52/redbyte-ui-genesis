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
  if ((await landingExample.count()) > 0) {
    await landingExample.click();
  } else {
    const browserExample = page.getByTestId(`ide-project-load-start-${exampleId}`);
    if ((await browserExample.count()) === 0) {
      await page.getByTestId('ide-project-landing-example-logic-gates').click();
      await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30_000 });
      await openMode(page, 'project');
    }
    await page.getByTestId(`ide-project-load-start-${exampleId}`).click();
  }
  await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30_000 });
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

test('ECE141 2-Bit Counter clock policy and export evidence smoke', async ({ page }) => {
  const consoleFailures = captureConsoleFailures(page);

  await loadExample(page, 'two-bit-counter');

  await openMode(page, 'verify');
  await expect(page.getByTestId('ide-verify-clock-policy-panel')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('ide-verify-clock-detected')).toContainText(/CLK100MHZ/i);
  await expect(page.getByTestId('ide-verify-clock-detected')).toContainText(/W5/i);
  await expect(page.getByTestId('ide-verify-clock-mode-summary')).toContainText(/Auto board clock/i);
  await expect(page.getByTestId('ide-verify-clock-reset-summary')).toContainText(/reset/i);
  await expect(page.getByTestId('ide-stimulus-clock-row')).toHaveCount(0);

  await openMode(page, 'hardware');
  await expect(page.getByTestId('ide-hw-map-row-clk')).toContainText(/CLK100MHZ/i);
  await expect(page.getByTestId('ide-hw-map-row-role-clk')).toContainText(/Clock pin/i);
  await expect(page.getByTestId('ide-hw-map-row-role-clk')).toContainText(/Role: clock/i);
  await expect(page.getByTestId('ide-hw-map-row-rst')).toContainText(/RST/i);
  await expect(page.getByTestId('ide-hw-map-row-role-rst')).toContainText(/Role: reset/i);

  await openMode(page, 'export');
  await expect(page.getByTestId('ide-export-evidence-row-e0')).toContainText(/export\/package evidence only/i);
  await expect(page.getByTestId('ide-export-evidence-row-e1')).toContainText(/External evidence required/i);
  await expect(page.getByTestId('ide-export-evidence-row-e2')).toContainText(/E2 does not prove behavior/i);
  await expect(page.getByTestId('ide-export-evidence-row-e3')).toContainText(/manual observation required/i);

  expect(consoleFailures).toEqual([]);
});

test('ECE141 export-ready copy stays E0-only after Verify passes', async ({ page }) => {
  const consoleFailures = captureConsoleFailures(page);

  await loadExample(page, 'logic-gates');
  await openMode(page, 'verify');
  await page.getByTestId('ide-vcb-use-saved-checks').click();
  await page.getByTestId('ide-vcb-run').click();
  await expect(page.getByTestId('ide-verify-pass-hero')).toBeVisible({ timeout: 30_000 });

  await openMode(page, 'export');
  const hero = page.getByTestId('ide-export-readiness-hero');
  await expect(hero).toContainText(/E0/i);
  await expect(hero).not.toContainText(/program board/i);
  await expect(page.getByTestId('ide-export-evidence-row-e0')).toContainText(/export\/package evidence only/i);
  await expect(page.getByTestId('ide-export-evidence-row-e1')).toContainText(/External evidence required/i);
  await expect(page.getByTestId('ide-export-evidence-row-e2')).toContainText(/E2 does not prove behavior/i);
  await expect(page.getByTestId('ide-export-evidence-row-e3')).toContainText(/manual observation required/i);

  expect(consoleFailures).toEqual([]);
});

