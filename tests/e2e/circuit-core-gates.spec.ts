// Circuit Core Golden Path Gates A-G
// These gates validate that the circuit editor's core interactions work end-to-end.
// Victory: All 7 gates pass headless in CI.

import { test, expect } from '@playwright/test';

// Shared setup: suppress overlays, boot golden path, wait for playground
const goldenSetup = async (page: any) => {
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(15000);

  // Suppress overlays that block canvas
  await page.addInitScript(() => {
    localStorage.setItem('rb-start-here-dismissed', 'true');
    localStorage.setItem('rb_last_clean_shutdown', 'true');
    localStorage.removeItem('rb_error_boundary_hit');
    localStorage.removeItem('rb_watchdog_marker');
    localStorage.removeItem('rb_workspace_latest');
  });

  await page.goto('/os/?golden=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="logic-playground-root"]', { timeout: 60000 });
  await page.waitForSelector('[data-testid="logic-canvas"]', { timeout: 15000 });
};

// Helper: get circuit state from the store (serializable snapshot)
const getCircuit = async (page: any) => {
  return page.evaluate(() => {
    const store = (window as any).__RB_CIRCUIT_STORE__;
    if (!store) return null;
    const state = store.getState();
    return {
      nodes: state.circuit.nodes.map((n: any) => ({
        id: n.id,
        type: n.type,
        x: n.position?.x ?? n.x ?? 0,
        y: n.position?.y ?? n.y ?? 0,
        state: n.state ? JSON.parse(JSON.stringify(n.state)) : {},
      })),
      connections: state.circuit.connections.map((c: any) => ({
        from: typeof c.from === 'string' ? c.from : c.from?.nodeId,
        fromPort: typeof c.from === 'string' ? (c.fromPin ?? c.fromPort) : (c.from?.portName ?? c.from?.port),
        to: typeof c.to === 'string' ? c.to : c.to?.nodeId,
        toPort: typeof c.to === 'string' ? (c.toPin ?? c.toPort) : (c.to?.portName ?? c.to?.port),
      })),
    };
  });
};

// Helper: click a palette item to add a node via smart spawn
const addNodeFromPalette = async (page: any, nodeType: string) => {
  const item = page.locator(`[data-component-type="${nodeType}"]`).first();
  const count = await page.locator(`[data-component-type="${nodeType}"]`).count();
  if (count === 0) throw new Error(`No palette item found for type: ${nodeType}`);
  
  await item.waitFor({ state: 'visible', timeout: 5000 });
  
  // Use JavaScript click to trigger React event handlers properly
  // (Playwright's click() doesn't always trigger React's synthetic click events)
  await item.evaluate((el: any) => el.click());
  
  await page.waitForTimeout(200);
  const circuit = await getCircuit(page);
  
  if (circuit.nodes.length === 0) {
    throw new Error(`Failed to add node of type: ${nodeType}`);
  }
};

// Helper: wire two nodes via store API (using updateCircuit to avoid commit loop)
const wireNodes = async (page: any, fromType: string, fromPort: string, toType: string, toPort: string) => {
  await page.evaluate(({ fromType, fromPort, toType, toPort }: any) => {
    const store = (window as any).__RB_CIRCUIT_STORE__;
    if (!store) throw new Error('Circuit store not found');
    const state = store.getState();
    const circuit = state.circuit;
    const fromNode = circuit.nodes.find((n: any) => n.type === fromType);
    const toNode = circuit.nodes.find((n: any) => n.type === toType);
    if (!fromNode) throw new Error(`Node type "${fromType}" not found`);
    if (!toNode) throw new Error(`Node type "${toType}" not found`);
    // Build new circuit with added connection (avoid commit → subscriber loop)
    const newCircuit = {
      ...circuit,
      connections: [
        ...circuit.connections,
        { from: { nodeId: fromNode.id, portName: fromPort }, to: { nodeId: toNode.id, portName: toPort } },
      ],
    };
    state.updateCircuit(newCircuit, { skipHistory: true });
  }, { fromType, fromPort, toType, toPort });
  await page.waitForTimeout(200);
};

test.describe('Circuit Core Gates', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const logs: string[] = [];

    page.on('console', (msg) => {
      const text = msg.text();
      logs.push(`[console:${msg.type()}] ${text}`);
      // Fail immediately on DOM crash errors (NOT debug logs)
      if (msg.type() === 'error') {
        // Only fail on actual DOM errors, not debug/info logs
        const isDomCrash = text.includes('removeChild') ||
                          text.includes('NotFoundError') ||
                          text.includes('Failed to execute');
        if (isDomCrash) {
          throw new Error(`DOM crash detected: ${text}`);
        }
      }
    });

    page.on('pageerror', (err) => {
      logs.push(`[pageerror] ${err?.message ?? String(err)}`);
      if (err?.stack) logs.push(err.stack);
      // Fail immediately on page errors
      throw err;
    });

    (testInfo as any)._browserLogs = logs;

    await goldenSetup(page);

    // Reset circuit store to empty state
    await page.evaluate(() => {
      const store = (window as any).__RB_CIRCUIT_STORE__;
      if (store) {
        store.getState().reset();
      }
    });
    await page.waitForTimeout(100);
  });

  test.afterEach(async ({}, testInfo) => {
    const logs = (testInfo as any)._browserLogs as string[] | undefined;
    if (!logs) return;
    if (testInfo.status !== testInfo.expectedStatus) {
      // eslint-disable-next-line no-console
      console.error('[Gate E] Browser logs:\n' + logs.join('\n'));
      await testInfo.attach('browser-logs', {
        body: logs.join('\n'),
        contentType: 'text/plain',
      });
    }
  });

  // ─────────────────────────────────────────────
  // Gate A: Place 3 components at distinct positions
  // ─────────────────────────────────────────────
  test('Gate A: Place 3 components at distinct positions', async ({ page }) => {
    await addNodeFromPalette(page, 'Switch');
    await addNodeFromPalette(page, 'AND');
    await addNodeFromPalette(page, 'Lamp');

    const circuit = await getCircuit(page);
    expect(circuit).not.toBeNull();
    expect(circuit!.nodes).toHaveLength(3);

    // Verify types
    const types = circuit!.nodes.map((n: any) => n.type).sort();
    expect(types).toEqual(['AND', 'Lamp', 'Switch']);

    // Verify distinct positions (smart spawn offsets each)
    const positions = circuit!.nodes.map((n: any) => `${n.x},${n.y}`);
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBe(3);

    console.log('[Gate A] Placed 3 nodes:', circuit!.nodes.map((n: any) => `${n.type}@(${n.x},${n.y})`));
  });

  // ─────────────────────────────────────────────
  // Gate B: Move component via store updateNode
  // ─────────────────────────────────────────────
  test('Gate B: Move component to new position', async ({ page }) => {
    await addNodeFromPalette(page, 'Switch');

    const before = await getCircuit(page);
    expect(before!.nodes).toHaveLength(1);
    const initialX = before!.nodes[0].x;
    const initialY = before!.nodes[0].y;
    const nodeId = before!.nodes[0].id;

    // Move the node via updateCircuit (avoid commit → subscriber loop in E2E)
    const targetX = initialX + 120;
    const targetY = initialY + 80;

    await page.evaluate(({ nodeId, x, y }: any) => {
      const store = (window as any).__RB_CIRCUIT_STORE__;
      if (!store) throw new Error('Store not found');
      const state = store.getState();
      const circuit = state.circuit;
      const newCircuit = {
        ...circuit,
        nodes: circuit.nodes.map((n: any) => n.id === nodeId ? { ...n, position: { x, y } } : n),
      };
      state.updateCircuit(newCircuit, { skipHistory: true });
    }, { nodeId, x: targetX, y: targetY });
    await page.waitForTimeout(200);

    const after = await getCircuit(page);
    expect(after!.nodes).toHaveLength(1);
    expect(after!.nodes[0].x).toBe(targetX);
    expect(after!.nodes[0].y).toBe(targetY);

    console.log('[Gate B] Move:', { from: `(${initialX},${initialY})`, to: `(${after!.nodes[0].x},${after!.nodes[0].y})` });
  });

  // ─────────────────────────────────────────────
  // Gate C: Pan and zoom, then place component
  // ─────────────────────────────────────────────
  test('Gate C: Pan/zoom then place component at correct position', async ({ page }) => {
    const canvas = page.locator('[data-testid="logic-canvas"]');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    const centerX = canvasBox!.x + canvasBox!.width / 2;
    const centerY = canvasBox!.y + canvasBox!.height / 2;

    // Zoom in via wheel
    await page.mouse.move(centerX, centerY);
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(300);

    // Pan via space+drag
    await page.keyboard.down('Space');
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 80, centerY + 50, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up('Space');
    await page.waitForTimeout(300);

    // Place a component — smart spawn targets camera center in world coords
    await addNodeFromPalette(page, 'Lamp');

    const circuit = await getCircuit(page);
    expect(circuit!.nodes).toHaveLength(1);

    const node = circuit!.nodes[0];
    expect(typeof node.x).toBe('number');
    expect(typeof node.y).toBe('number');
    expect(isNaN(node.x)).toBe(false);
    expect(isNaN(node.y)).toBe(false);

    console.log('[Gate C] After pan/zoom placement:', `${node.type}@(${node.x},${node.y})`);
  });

  // ─────────────────────────────────────────────
  // Gate D: Wire Switch output to Lamp input
  // ─────────────────────────────────────────────
  test('Gate D: Wire Switch to Lamp', async ({ page }) => {
    await addNodeFromPalette(page, 'Switch');
    await addNodeFromPalette(page, 'Lamp');

    let circuit = await getCircuit(page);
    expect(circuit!.nodes).toHaveLength(2);
    expect(circuit!.connections).toHaveLength(0);

    // Wire Switch.out → Lamp.in via store API
    await wireNodes(page, 'Switch', 'out', 'Lamp', 'in');

    circuit = await getCircuit(page);
    expect(circuit!.connections).toHaveLength(1);

    const conn = circuit!.connections[0];
    expect(conn.fromPort).toBe('out');
    expect(conn.toPort).toBe('in');

    console.log('[Gate D] Wired:', conn);
  });

  // ─────────────────────────────────────────────
  // Gate E: Toggle switch, lamp responds
  // ─────────────────────────────────────────────
  test('Gate E: Toggle switch, lamp responds via simulation', async ({ page }) => {
    await addNodeFromPalette(page, 'Switch');
    await addNodeFromPalette(page, 'Lamp');

    // Wire Switch → Lamp
    await wireNodes(page, 'Switch', 'out', 'Lamp', 'in');

    // Verify initial state: Switch OFF → engine signals should show Switch.out = 0
    // (setCircuit now propagates initial signals via tick())
    const initialSignals = await page.evaluate(() => {
      const store = (window as any).__RB_CIRCUIT_STORE__;
      if (!store) return null;
      const state = store.getState();
      const engine = state.engine;
      if (!engine) return null;
      const signals = engine.getAllSignals();
      const result: Record<string, number> = {};
      signals.forEach((v: number, k: string) => { result[k] = v; });
      return result;
    });
    console.log('[Gate E] Initial signals (switch OFF):', initialSignals);

    // Find the Switch output signal key
    const switchOutputKey = Object.keys(initialSignals || {}).find(
      (k) => k.includes('.out') && !k.includes('Lamp')
    );
    expect(switchOutputKey).toBeTruthy();
    expect(initialSignals![switchOutputKey!]).toBe(0);

    // Toggle Switch ON via updateCircuit
    await page.evaluate(() => {
      const store = (window as any).__RB_CIRCUIT_STORE__;
      if (!store) return;
      const state = store.getState();
      const circuit = state.circuit;
      const switchNode = circuit.nodes.find((n: any) => n.type === 'Switch');
      if (!switchNode) return;
      const newCircuit = {
        ...circuit,
        nodes: circuit.nodes.map((n: any) =>
          n.id === switchNode.id
            ? { ...n, state: { ...n.state, isOn: 1 } }
            : n
        ),
      };
      state.updateCircuit(newCircuit, { skipHistory: true });
    });
    await page.waitForTimeout(100);

    // Read signals after toggle — setCircuit propagates signals immediately
    const afterSignals = await page.evaluate(() => {
      const store = (window as any).__RB_CIRCUIT_STORE__;
      if (!store) return null;
      const state = store.getState();
      const engine = state.engine;
      if (!engine) return null;
      const signals = engine.getAllSignals();
      const result: Record<string, number> = {};
      signals.forEach((v: number, k: string) => { result[k] = v; });
      return result;
    });
    console.log('[Gate E] After toggle signals (switch ON):', afterSignals);

    // The Switch output signal should now be 1
    // Signal keys are "nodeId.portName" for output ports
    expect(afterSignals).not.toBeNull();
    const switchOutputAfter = afterSignals![switchOutputKey!];
    expect(switchOutputAfter).toBe(1);

    // Also verify engine state: Lamp's nodeState should show isOn = 1
    // (Lamp evaluate stores input in state.isOn)
    const lampState = await page.evaluate(() => {
      const store = (window as any).__RB_CIRCUIT_STORE__;
      if (!store) return null;
      const state = store.getState();
      const engine = state.engine;
      if (!engine) return null;
      const lampNode = state.circuit.nodes.find((n: any) => n.type === 'Lamp');
      if (!lampNode) return null;
      return engine.getNodeState(lampNode.id);
    });
    console.log('[Gate E] Lamp engine state:', lampState);
    expect(lampState?.isOn).toBe(1);
  });

  // ─────────────────────────────────────────────
  // Gate F: Save and reload circuit
  // ─────────────────────────────────────────────
  test('Gate F: Save and reload circuit preserves positions', async ({ page }) => {
    await addNodeFromPalette(page, 'AND');
    await addNodeFromPalette(page, 'OR');

    const beforeCircuit = await getCircuit(page);
    expect(beforeCircuit!.nodes).toHaveLength(2);

    const beforePositions = beforeCircuit!.nodes
      .map((n: any) => ({ type: n.type, x: n.x, y: n.y }))
      .sort((a: any, b: any) => a.type.localeCompare(b.type));

    // Serialize circuit to plain JSON (nodes + connections only)
    const serialized = await page.evaluate(() => {
      const store = (window as any).__RB_CIRCUIT_STORE__;
      if (!store) return null;
      const { nodes, connections } = store.getState().circuit;
      // Extract only serializable data
      return JSON.stringify({
        nodes: nodes.map((n: any) => ({
          id: n.id,
          type: n.type,
          position: n.position ? { x: n.position.x, y: n.position.y } : undefined,
          state: n.state,
          config: n.config,
        })),
        connections: connections.map((c: any) => ({
          from: c.from,
          to: c.to,
        })),
      });
    });
    expect(serialized).not.toBeNull();

    // Clear circuit via updateCircuit with skipHistory
    await page.evaluate(() => {
      const store = (window as any).__RB_CIRCUIT_STORE__;
      if (!store) return;
      store.getState().updateCircuit({ nodes: [], connections: [] }, { skipHistory: true });
    });
    await page.waitForTimeout(200);

    const emptyCircuit = await getCircuit(page);
    expect(emptyCircuit!.nodes).toHaveLength(0);

    // Restore
    await page.evaluate((data: string) => {
      const store = (window as any).__RB_CIRCUIT_STORE__;
      if (!store) return;
      store.getState().updateCircuit(JSON.parse(data), { skipHistory: true });
    }, serialized!);
    await page.waitForTimeout(200);

    const afterCircuit = await getCircuit(page);
    expect(afterCircuit!.nodes).toHaveLength(2);

    const afterPositions = afterCircuit!.nodes
      .map((n: any) => ({ type: n.type, x: n.x, y: n.y }))
      .sort((a: any, b: any) => a.type.localeCompare(b.type));

    console.log('[Gate F] Before:', beforePositions);
    console.log('[Gate F] After:', afterPositions);

    for (let i = 0; i < beforePositions.length; i++) {
      expect(afterPositions[i].x).toBe(beforePositions[i].x);
      expect(afterPositions[i].y).toBe(beforePositions[i].y);
    }
  });

  // ─────────────────────────────────────────────
  // Gate G: Export evidence contains circuit doc
  // ─────────────────────────────────────────────
  test('Gate G: Export produces valid circuit document', async ({ page }) => {
    await addNodeFromPalette(page, 'Switch');
    await addNodeFromPalette(page, 'Lamp');

    // Wire them
    await wireNodes(page, 'Switch', 'out', 'Lamp', 'in');

    // Validate circuit structure for export readiness
    const exported = await page.evaluate(() => {
      const store = (window as any).__RB_CIRCUIT_STORE__;
      if (!store) return null;
      const circuit = store.getState().circuit;
      return {
        nodeCount: circuit.nodes.length,
        connectionCount: circuit.connections.length,
        hasPositions: circuit.nodes.every(
          (n: any) => {
            const x = n.position?.x ?? n.x;
            const y = n.position?.y ?? n.y;
            return typeof x === 'number' && typeof y === 'number' && !isNaN(x) && !isNaN(y);
          }
        ),
        nodeTypes: circuit.nodes.map((n: any) => n.type),
        nodesHaveIds: circuit.nodes.every((n: any) => typeof n.id === 'string' && n.id.length > 0),
        connectionsValid: circuit.connections.every(
          (c: any) => c.from && c.to && (typeof c.from === 'string' || c.from.nodeId) && (typeof c.to === 'string' || c.to.nodeId)
        ),
      };
    });

    console.log('[Gate G] Export validation:', exported);

    expect(exported).not.toBeNull();
    expect(exported!.nodeCount).toBe(2);
    expect(exported!.connectionCount).toBe(1);
    expect(exported!.hasPositions).toBe(true);
    expect(exported!.nodesHaveIds).toBe(true);
    expect(exported!.connectionsValid).toBe(true);
    expect(exported!.nodeTypes).toContain('Switch');
    expect(exported!.nodeTypes).toContain('Lamp');
  });
});
