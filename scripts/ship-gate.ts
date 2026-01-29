import { execSync, spawn } from 'child_process';
import { platform } from 'os';

// Config
const BRIDGE_PORT = 4242;
const BRIDGE_URL = `http://localhost:${BRIDGE_PORT}`;
const PLAYWRIGHT_TEST = 'tests/e2e/gate-check.spec.ts';
const BRIDGE_START_CMD = 'pnpm --filter @redbyte/rb-bridge-agent dev';
const VERIFY_SCRIPT = 'tools/verify_client.ts';

// Helpers
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function log(step: string, msg: string) {
    console.log(`\x1b[36m[GATE:${step}]\x1b[0m ${msg}`);
}

function error(step: string, msg: string) {
    console.error(`\x1b[31m[GATE:${step}:FAIL]\x1b[0m ${msg}`);
    process.exit(1);
}

// 1. Process Cleanup (Windows Focused)
function killPort(port: number) {
    log('CLEAN', `Checking port ${port}...`);
    try {
        if (process.platform === 'win32') {
            const output = execSync(`netstat -ano | findstr :${port}`).toString();
            const lines = output.trim().split('\n');
            if (lines.length > 0) {
                // Parse PID (last token)
                const tokens = lines[0].trim().split(/\s+/);
                const pid = tokens[tokens.length - 1];
                if (pid && parseInt(pid) > 0) {
                    log('CLEAN', `Killing PID ${pid} on port ${port}...`);
                    execSync(`taskkill /F /PID ${pid}`);
                }
            }
        } else {
            // Linux/Mac implementation omitted for "Windows OS" user constraint, but robust script would have it.
            try {
                execSync(`lsof -ti:${port} | xargs kill -9`);
            } catch (e) { /* ignore if empty */ }
        }
    } catch (e) {
        // Ignore errors (no process found)
    }
}

// 2. Start Bridge
async function startBridge() {
    log('BRIDGE', 'Starting Bridge Agent...');
    const subprocess = spawn('pnpm', ['--filter', '@redbyte/rb-bridge-agent', 'dev'], {
        shell: true,
        stdio: 'pipe',
        detached: false
    });

    // We pipe output to see it in CI/console
    subprocess.stdout.on('data', d => process.stdout.write(`[BRIDGE] ${d}`));
    subprocess.stderr.on('data', d => process.stderr.write(`[BRIDGE] ${d}`));

    // Wait for health
    let attempts = 0;
    while (attempts < 30) {
        try {
            const res = await fetch(`${BRIDGE_URL}/health`);
            if (res.ok) {
                log('BRIDGE', 'Health Check OK');
                return subprocess;
            }
        } catch (e) { /* wait */ }
        await pause(1000);
        attempts++;
        process.stdout.write('.');
    }

    error('BRIDGE', 'Timed out waiting for bridge to start.');
}

// 3. Verification Steps
async function run() {
    console.log('\n\x1b[42m\x1b[30m === STARTING SHIP:GATE SEQUENCE === \x1b[0m\n');

    // A. Clean
    killPort(BRIDGE_PORT);

    // B. Start Bridge
    const bridgeProc = await startBridge();

    try {
        // C. Verify Devices
        log('CHECK', 'Verifying Device List...');
        const devicesRes = await fetch(`${BRIDGE_URL}/devices`);
        if (!devicesRes.ok) throw new Error('Failed to fetch devices');
        const devices = await devicesRes.json();
        log('CHECK', `Found ${devices.length} devices.`);

        // D. Run Truth Sequence
        log('TRUTH', 'Running verify_client.ts...');
        // Ensure ts-node or similar execution. Using 'tsx' as environment standard.
        // Assuming verify_client.ts is in tools/verify_client.ts (verified in previous steps)
        execSync(`npx tsx ${VERIFY_SCRIPT}`, { stdio: 'inherit' });
        log('TRUTH', 'Sequence Passed.');

        // E. Run Playwright
        log('UI', 'Running Headless UI Check...');
        // We assume verify_client might have cleaned up? 
        // No, check verify_client.ts logic... it connects then disconnects (or exits).
        // UI Check expects bridge to be running.

        execSync(`npx playwright test ${PLAYWRIGHT_TEST}`, { stdio: 'inherit' });
        log('UI', 'UI Check Passed.');

        console.log('\n\x1b[42m\x1b[30m === SHIP:GATE PASSED === \x1b[0m\n');

    } catch (e: any) {
        error('FAIL', e.message || 'Unknown error');
    } finally {
        log('CLEAN', 'Stopping Bridge...');
        bridgeProc?.kill();
        // Force kill port again to be sure
        killPort(BRIDGE_PORT);
        process.exit(0);
    }
}

run();
