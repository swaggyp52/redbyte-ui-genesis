import { test, expect } from '@playwright/test';

// Track console messages and errors for React #185 detection
const captureConsoleActivity = (page) => {
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
    });
  });

  page.on('pageerror', (error) => {
    pageErrors.push({
      message: error.message,
      stack: error.stack,
    });
  });

  return { consoleMessages, pageErrors };
};

test.describe('Logic Playground - React error #185 smoke test', () => {
  test('should load Logic Playground without Maximum update depth exceeded error (DEV)', async ({ page }) => {
    const { consoleMessages, pageErrors } = captureConsoleActivity(page);

    // Navigate to localhost:5173 with auto-open Logic Playground
    await page.goto('http://localhost:5173/?openApp=logic-playground', { waitUntil: 'domcontentloaded' });

    // Give React time to render and hit the loop (if present)
    await page.waitForTimeout(2500);

    // Check for the error signature
    const errorFound = consoleMessages.some(
      (msg) =>
        msg.text.includes('react.dev/errors/185') ||
        msg.text.includes('Maximum update depth exceeded') ||
        msg.text.includes('Minified React error #185')
    );

    const boundaryError = consoleMessages.some((msg) =>
      msg.text.includes('ErrorBoundary caught error')
    );

    // Print diagnostics if error found
    if (errorFound || boundaryError || pageErrors.length > 0) {
      console.log('\n=== REACT ERROR #185 DETECTED ===');
      console.log('Recent console messages:');
      consoleMessages.slice(-15).forEach((msg, i) => {
        console.log(`  [${i}] ${msg.type}: ${msg.text.substring(0, 100)}`);
      });
      if (pageErrors.length > 0) {
        console.log('Page errors:');
        pageErrors.forEach((err) => console.log(`  ${err.message}`));
      }
      console.log('================================\n');
    }

    // FAIL if error #185 is present
    expect(errorFound).toBe(false);
    expect(boundaryError).toBe(false);
  });

  test('should load Logic Playground without Maximum update depth exceeded error (PREVIEW)', async ({ page }) => {
    const { consoleMessages, pageErrors } = captureConsoleActivity(page);

    // Navigate to preview build
    await page.goto('http://localhost:4173/?openApp=logic-playground', { waitUntil: 'domcontentloaded' });

    // Give React time to render and hit the loop (if present)
    await page.waitForTimeout(2500);

    // Check for the error signature
    const errorFound = consoleMessages.some(
      (msg) =>
        msg.text.includes('react.dev/errors/185') ||
        msg.text.includes('Maximum update depth exceeded') ||
        msg.text.includes('Minified React error #185')
    );

    const boundaryError = consoleMessages.some((msg) =>
      msg.text.includes('ErrorBoundary caught error')
    );

    // Print diagnostics if error found
    if (errorFound || boundaryError || pageErrors.length > 0) {
      console.log('\n=== REACT ERROR #185 DETECTED (PREVIEW) ===');
      console.log('Recent console messages:');
      consoleMessages.slice(-15).forEach((msg, i) => {
        console.log(`  [${i}] ${msg.type}: ${msg.text.substring(0, 100)}`);
      });
      if (pageErrors.length > 0) {
        console.log('Page errors:');
        pageErrors.forEach((err) => console.log(`  ${err.message}`));
      }
      console.log('================================\n');
    }

    // FAIL if error #185 is present
    expect(errorFound).toBe(false);
    expect(boundaryError).toBe(false);
  });
});

test.describe('redbyte os smoke', () => {
  test('boot to desktop and open terminal', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText(/redbyte os/i)).toBeVisible();

    await page.waitForTimeout(800);
    await expect(page.getByText(/boot/iu).first()).toBeVisible({ timeout: 2000 }).catch(() => {});

    await expect(page.getByRole('button', { name: /terminal/i })).toBeVisible();
    await page.getByRole('button', { name: /terminal/i }).click();

    const terminalWindow = page.getByText(/Genesis Terminal/i);
    await expect(terminalWindow).toBeVisible();

    const input = page.getByRole('textbox').last();
    await input.click();
    await input.fill('help');
    await input.press('Enter');

    await expect(page.getByText(/available commands/i)).toBeVisible();
  });
});
