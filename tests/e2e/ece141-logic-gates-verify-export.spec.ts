import { expect, test } from '@playwright/test';

test('ECE141 Logic Gates starter verify/export smoke', async ({ page }) => {
  const consoleFailures: string[] = [];
  const circuitStoreEngineWarnings: string[] = [];

  page.on('console', (message) => {
    const text = message.text();
    if (
      message.type() === 'error' &&
      !text.includes('Failed to load resource: the server responded with a status of 404')
    ) {
      consoleFailures.push(text);
    }
    if (text.includes('[CircuitStore] Circuit mutation called but engines not connected!')) {
      circuitStoreEngineWarnings.push(text);
    }
  });

  page.on('pageerror', (error) => {
    consoleFailures.push(`pageerror: ${error.message}`);
  });

  await page.goto('/?mode=project', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('ide-root')).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('ide-onboarding-skip').click({ timeout: 1_500 }).catch(() => {});
  await page.getByRole('button', { name: /Dismiss/i }).click({ timeout: 1_500 }).catch(() => {});

  await page.getByTestId('ide-project-landing-example-logic-gates').click();
  await expect(page.getByTestId('ide-mode-design')).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('mode-button-verify').click();
  await expect(page.getByTestId('ide-mode-verify')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: /^Compare checks$/ }).click();
  await page.getByRole('button', { name: /^Run$/ }).click();

  await expect(page.getByText('PASS').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('ide-verify-pass-hero')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('ide-vcb-evidence')).toHaveText(/12\/12 match/i, {
    timeout: 30_000,
  });

  await page.getByTestId('mode-button-export').click();
  await expect(page.getByTestId('ide-mode-export')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Export Ready to Build/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Vivado package ready to build/i).first()).toBeVisible({
    timeout: 30_000,
  });

  expect(consoleFailures).toEqual([]);
  expect(circuitStoreEngineWarnings).toEqual([]);
});
