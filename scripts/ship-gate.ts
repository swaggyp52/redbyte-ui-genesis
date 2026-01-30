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
        const devicesData = await devicesRes.json();
        const devices = devicesData.devices || [];
        log('CHECK', `Found ${devices.length} devices.`);

        // D. Run Truth Sequence
        log('TRUTH', 'Running verify_client.ts...');
        // Ensure ts-node or similar execution. Using 'tsx' as environment standard.
        // Assuming verify_client.ts is in tools/verify_client.ts (verified in previous steps)
        execSync(`npx tsx ${VERIFY_SCRIPT}`, { stdio: 'inherit' });
        log('TRUTH', 'Sequence Passed.');

        // E. Manual Gate Checklist
        log('MANUAL', 'Printing Quality Gate Checklist...');

        console.log('\n\x1b[33m--- MANUAL VERIFICATION REQUIRED ---\x1b[0m');
        console.log('1. [ ] Bridge Health OK (Verified ✅)');
        console.log('2. [ ] Device Discovery (Verified ✅ - Found ' + devices.length + ' devices)');
        console.log('3. [ ] Truth Sequence (Verified ✅)');
        console.log('4. [ ] UI: Hardware Panel shows "Local Bridge Online"');
        console.log('5. [ ] UI: Devices list matches: ' + devices.map((d: any) => d.target).join(', '));
        console.log('6. [ ] UI: Lab 0 -> Basys 3 auto-spawns at non-zero offset if multiple exist');
        console.log('7. [ ] UI: Physical SW0 toggle reflects on 3D node instantly');
        console.log('8. [ ] UI: Dragging Gizmo updates node position and persists');
        console.log('------------------------------------\n');

        console.log('\n\x1b[42m\x1b[30m === SHIP:GATE PRE-FLIGHT PASSED === \x1b[0m');
        console.log('Perform manual UI checks 4-8 to approve the release.\n');

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
