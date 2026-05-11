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

async function openMode(
  page: Page,
  mode: 'project' | 'design' | 'verify' | 'hardware' | 'export'
): Promise<void> {
  await page.getByTestId(`mode-button-${mode}`).click();
  await expect(page.getByTestId(`ide-mode-${mode}`)).toBeVisible({ timeout: 30_000 });
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

test('ECE141 2-Bit Counter Verify Compare passes and Export stays E0-only', async ({ page }) => {
  const consoleFailures = captureConsoleFailures(page);

  await openProject(page);
  await page.getByTestId('ide-project-landing-example-two-bit-counter').click();
  await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30_000 });

  await openMode(page, 'verify');
  await expect(page.getByTestId('ide-verify-clock-policy-panel')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('ide-verify-clock-detected')).toContainText(/CLK100MHZ/i);
  await expect(page.getByTestId('ide-verify-clock-mode-summary')).toContainText(/Auto board clock/i);
  await expect(page.getByTestId('ide-verify-clock-reset-summary')).toContainText(/BTNC|reset/i);

  await page.getByTestId('ide-vcb-use-saved-checks').click();
  await page.getByTestId('ide-vcb-run').click();
  await expect(page.getByTestId('ide-verify-pass-hero')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('ide-vcb-evidence')).toHaveText(/14\/14 match/i, {
    timeout: 30_000,
  });
  await expect(page.getByTestId('ide-verify-results-summary')).toContainText(/Passed/i);

  await openMode(page, 'hardware');
  await expect(page.getByTestId('ide-hw-map-row-clk')).toContainText(/CLK100MHZ/i);
  await expect(page.getByTestId('ide-hw-map-row-role-clk')).toContainText(/Role: clock/i);
  await expect(page.getByTestId('ide-hw-map-row-rst')).toContainText(/RST/i);
  await expect(page.getByTestId('ide-hw-map-row-role-rst')).toContainText(/Role: reset/i);

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
