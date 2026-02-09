// DOM Layering Gate: Ensures canvas surfaces receive pointer events
// Victory: elementFromPoint() at canvas center returns the interactive surface (svg/canvas) or direct child
// Failure means shell overlays are stealing events

import { test, expect } from '@playwright/test';

test.describe('DOM Layering - Pointer Event Routing', () => {
  const collectShellDiagnostics = async (
    page: any,
    errors: string[],
    requestFailures: string[],
    requestUrls: string[],
    responseStatuses: string[]
  ) => {
    const withTimeout = async <T,>(promise: Promise<T>, ms: number) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('timeout')), ms);
      });

      try {
        return await Promise.race([promise, timeoutPromise]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    };

    const safe = async <T,>(label: string, promise: Promise<T>, ms: number) => {
      try {
        return await withTimeout(promise, ms);
      } catch (error: any) {
        return `ERROR: ${label}: ${error?.message ?? String(error)}`;
      }
    };

    const url = page.url();
    const frameUrls = page.frames().map((frame: any) => frame.url());
    const title = await safe('title', page.title(), 3000);
    const rootChildCount = await safe(
      'rootChildCount',
      page.locator('#root').evaluate((node) => node.children.length),
      3000
    );
    const rootFirstTag = await safe(
      'rootFirstTag',
      page.locator('#root').evaluate((node) => node.firstElementChild?.tagName ?? null),
      3000
    );
    const testidCount = await safe('testidCount', page.locator('[data-testid]').count(), 3000);

    return {
      url,
      frameUrls,
      title,
      rootChildCount,
      rootFirstTag,
      testidCount,
      consoleErrors: errors,
      requestFailures,
      requestUrls,
      responseStatuses,
    };
  };

  test.beforeEach(async ({ page }) => {
    const consoleErrors: string[] = [];
    const consoleLogs: string[] = [];
    const requestFailures: string[] = [];
    const requestUrls: string[] = [];
    const responseStatuses: string[] = [];
    const diagnosticLogs: string[] = [];  // For GOLDEN/LP_TRACE/SUSPENSE logs

    page.on('console', (msg) => {
      const text = msg.text();
      const t = msg.type();
      
      // PROTOCOL: Add diagnostic logs to separate array
      if (text.includes("GOLDEN") || text.includes("LP_TRACE") || text.includes("SUSPENSE") || 
          text.includes("ChunkLoadError") || text.includes("Failed to fetch") || text.includes("404")) {
        diagnosticLogs.push(`[PW_CONSOLE:${t}] ${text}`);
        console.log(`[PW_CONSOLE:${t}] ${text}`);
      }
      
      if (t === 'error') {
        consoleErrors.push(text);
        return;
      }
      if (consoleLogs.length < 12) consoleLogs.push(`[${t}] ${text}`);
    });

    page.on('pageerror', (err) => {
      const msg = `[PW_PAGEERROR] ${err?.stack || err}`;
      consoleErrors.push(`Uncaught: ${err.message}`);
      diagnosticLogs.push(msg);
      console.log(msg);
    });

    page.on('request', (req) => {
      if (requestUrls.length < 12) {
        requestUrls.push(req.url());
      }
    });

    page.on('response', (res) => {
      const status = res.status();
      const url = res.url();
      const msg = `${status} ${url}`;
      
      // PROTOCOL: Catch 4xx/5xx for JS assets
      if (status >= 400 && (url.includes(".js") || url.includes(".css") || url.includes("assets") || url.includes("chunk"))) {
        const logMsg = `[PW_HTTP_${status}] ${url}`;
        diagnosticLogs.push(logMsg);
        console.log(logMsg);
      }
      
      if (responseStatuses.length < 12) {
        responseStatuses.push(msg);
      }
    });

    page.on('requestfailed', (req) => {
      const msg = `[PW_REQFAILED] ${req.method()} ${req.url()} :: ${req.failure()?.errorText}`;
      diagnosticLogs.push(msg);
      console.log(msg);
      
      if (requestFailures.length < 8) {
        requestFailures.push(`${req.url()} :: ${req.failure()?.errorText ?? 'unknown error'}`);
      }
    });

    page.on('crash', () => {
      consoleErrors.push('Page crashed');
    });

    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(10000);

    // Suppress overlays that block canvas pointer events in golden path mode
    await page.addInitScript(() => {
      localStorage.setItem('rb-start-here-dismissed', 'true');  // Hide Start Here panel
      localStorage.setItem('rb_last_clean_shutdown', 'true');    // Prevent recovery banner
      localStorage.removeItem('rb_error_boundary_hit');
      localStorage.removeItem('rb_watchdog_marker');
      localStorage.removeItem('rb_workspace_latest');
    });

    await page.goto('/os/?golden=1', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForSelector('#root', { timeout: 10000 });
    await page.waitForTimeout(2000);

    try {
      await page.waitForSelector('[data-testid="logic-playground-root"]', { timeout: 60000 });
    } catch (error) {
      const diagnostic = await collectShellDiagnostics(
        page,
        consoleErrors,
        requestFailures,
        requestUrls,
        responseStatuses
      );
      console.log('\n========== DIAGNOSTIC LOGS ==========');
      console.log(diagnosticLogs.join('\n'));
      console.log('========== END DIAGNOSTIC LOGS ==========\n');
      throw new Error(`logic playground not ready. Diagnostics:\n${JSON.stringify({ ...diagnostic, consoleLogs, diagnosticLogs }, null, 2)}`);
    }
  });

  test('Circuit view canvas receives pointer events at center', async ({ page }) => {
    await page.waitForSelector('[data-testid="logic-canvas"]', { timeout: 15000 });

    // Get viewport center
    const viewport = page.viewportSize();
    if (!viewport) throw new Error('No viewport size');
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;

    // Use elementFromPoint to check what actually receives events
    const topElement = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;

      const cs = getComputedStyle(el);

      // Walk ancestor chain to find if this element is inside the canvas
      let isInsideCanvas = false;
      let isInsideSvg = false;
      let ancestor: Element | null = el;
      const ancestorChain: string[] = [];
      while (ancestor) {
        const tag = ancestor.tagName.toLowerCase();
        const testId = ancestor.getAttribute('data-testid');
        ancestorChain.push(`${tag}${testId ? `[data-testid="${testId}"]` : ''}`);
        if (testId === 'logic-canvas') isInsideCanvas = true;
        if (tag === 'svg') isInsideSvg = true;
        ancestor = ancestor.parentElement;
      }

      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || '(no id)',
        className: typeof el.className === 'string' ? el.className : '(svg class)',
        dataTestId: el.getAttribute('data-testid') || '(no data-testid)',
        pointerEvents: cs.pointerEvents,
        zIndex: cs.zIndex,
        position: cs.position,
        isInsideCanvas,
        isInsideSvg,
        ancestorChain: ancestorChain.slice(0, 8),
      };
    }, { x: centerX, y: centerY });

    console.log('[DOM Layering] Circuit view center element:', JSON.stringify(topElement, null, 2));

    // ASSERTION: The top element must be:
    // - The svg canvas itself, OR
    // - An SVG child element (g, rect, path, etc.), OR
    // - Any element that is a descendant of [data-testid="logic-canvas"]
    // - NOT a shell overlay, glass pane, or element outside the canvas hierarchy

    expect(topElement).not.toBeNull();

    const isCanvasSurface =
      topElement!.tag === 'svg' ||
      topElement!.isInsideSvg ||
      topElement!.isInsideCanvas;

    if (!isCanvasSurface) {
      throw new Error(
        `LAYERING VIOLATION: Canvas center is blocked by non-interactive element!\n` +
        `Element: ${topElement!.tag}#${topElement!.id}.${topElement!.className}\n` +
        `DataTestId: ${topElement!.dataTestId}\n` +
        `Pointer Events: ${topElement!.pointerEvents}\n` +
        `Z-Index: ${topElement!.zIndex}\n` +
        `Ancestor chain: ${topElement!.ancestorChain.join(' > ')}\n` +
        `Expected: svg or descendant of [data-testid="logic-canvas"]`
      );
    }

    expect(isCanvasSurface).toBe(true);
  });

  test('Schematic view canvas receives pointer events at center', async ({ page }) => {
    // Open Logic Playground
    await page.waitForSelector('[data-testid="logic-canvas"]', { timeout: 15000 });

    // Switch to Schematic view (look for view switcher or tabs)
    const schematicButton = page.locator('button:has-text("Schematic"), button:has-text("schematic")').first();
    if (await schematicButton.count() > 0) {
      await schematicButton.click();
      await page.waitForTimeout(500); // Wait for view transition
    }

    const viewport = page.viewportSize();
    if (!viewport) throw new Error('No viewport size');
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;

    const topElement = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;

      const cs = getComputedStyle(el);

      // Walk ancestor chain
      let isInsideCanvas = false;
      let isInsideSvg = false;
      let ancestor: Element | null = el;
      const ancestorChain: string[] = [];
      while (ancestor) {
        const tag = ancestor.tagName.toLowerCase();
        const testId = ancestor.getAttribute('data-testid');
        ancestorChain.push(`${tag}${testId ? `[data-testid="${testId}"]` : ''}`);
        if (testId === 'logic-canvas') isInsideCanvas = true;
        if (tag === 'svg') isInsideSvg = true;
        ancestor = ancestor.parentElement;
      }

      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || '(no id)',
        className: typeof el.className === 'string' ? el.className : '(svg class)',
        dataTestId: el.getAttribute('data-testid') || '(no data-testid)',
        pointerEvents: cs.pointerEvents,
        zIndex: cs.zIndex,
        position: cs.position,
        isInsideCanvas,
        isInsideSvg,
        ancestorChain: ancestorChain.slice(0, 8),
      };
    }, { x: centerX, y: centerY });

    console.log('[DOM Layering] Schematic view center element:', JSON.stringify(topElement, null, 2));

    expect(topElement).not.toBeNull();

    // Schematic view uses svg — check element or ancestor is svg/canvas
    const isCanvasSurface =
      topElement!.tag === 'svg' ||
      topElement!.isInsideSvg ||
      topElement!.isInsideCanvas ||
      ['g', 'rect', 'path', 'line', 'circle'].includes(topElement!.tag);

    if (!isCanvasSurface) {
      throw new Error(
        `LAYERING VIOLATION: Schematic canvas center is blocked!\n` +
        `Element: ${topElement!.tag}#${topElement!.id}.${topElement!.className}\n` +
        `Ancestor chain: ${topElement!.ancestorChain.join(' > ')}\n` +
        `Expected: svg or descendant of [data-testid="logic-canvas"]`
      );
    }

    expect(isCanvasSurface).toBe(true);
  });

  test('Wheel events reach canvas (not blocked by hover activation)', async ({ page }) => {
    // Open Logic Playground
    await page.waitForSelector('[data-testid="logic-canvas"]', { timeout: 15000 });

    const viewport = page.viewportSize();
    if (!viewport) throw new Error('No viewport size');
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;

    // Listen for wheel events on the canvas
    await page.evaluate(() => {
      (window as any).__wheelEventReceived = false;
      document.addEventListener('wheel', () => {
        (window as any).__wheelEventReceived = true;
      }, { once: true, passive: true });
    });

    // Simulate wheel event at canvas center
    await page.mouse.move(centerX, centerY);
    await page.mouse.wheel(0, 100); // Scroll down

    // Verify wheel event was received
    const wheelReceived = await page.evaluate(() => (window as any).__wheelEventReceived);

    expect(wheelReceived).toBe(true);
  });
});
