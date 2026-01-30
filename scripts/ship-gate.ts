import { execSync, spawn, type ChildProcess } from 'child_process';

// Config
const BRIDGE_PORT = 4242;
const BRIDGE_URL = `http://localhost:${BRIDGE_PORT}`;
const VERIFY_SCRIPT = 'tools/verify_client.ts';
const SKIP_HW = process.argv.includes('--skip-hw');

// Helpers
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function log(step: string, msg: string) {
    console.log(`\x1b[36m[GATE:${step}]\x1b[0m ${msg}`);
}

function fail(step: string, msg: string): never {
    console.error(`\x1b[31m[GATE:${step}:FAIL]\x1b[0m ${msg}`);
    process.exit(1);
}

function pass(step: string) {
    console.log(`\x1b[32m[GATE:${step}:PASS]\x1b[0m`);
}

function runStep(step: string, cmd: string) {
    log(step, cmd);
    try {
        execSync(cmd, { stdio: 'inherit' });
        pass(step);
    } catch {
        fail(step, `Command failed: ${cmd}`);
    }
}

// ============================================================================
// PHASE 1: Software Quality Gate (no hardware required)
// ============================================================================

function softwareGate() {
    console.log('\n\x1b[45m\x1b[37m  PHASE 1: SOFTWARE QUALITY GATE  \x1b[0m\n');

    // 1a. TypeCheck — all packages
    runStep('TYPECHECK', 'pnpm -r exec tsc --noEmit');

    // 1b. Audit Tests — core test suite
    runStep('TESTS', 'pnpm test:audit');

    // 1c. Build — full monorepo build
    runStep('BUILD', 'pnpm build');

    // 1d. Zustand selector lint
    runStep('SELECTORS', 'pnpm lint:selectors');

    console.log('\n\x1b[42m\x1b[30m  SOFTWARE GATE PASSED  \x1b[0m\n');
}

// ============================================================================
// PHASE 2: Hardware Integration Gate (requires bridge + device)
// ============================================================================

function killPort(port: number) {
    log('CLEAN', `Checking port ${port}...`);
    try {
        if (process.platform === 'win32') {
            const output = execSync(`netstat -ano | findstr :${port}`).toString();
            const lines = output.trim().split('\n');
            if (lines.length > 0) {
                const tokens = lines[0].trim().split(/\s+/);
                const pid = tokens[tokens.length - 1];
                if (pid && parseInt(pid) > 0) {
                    log('CLEAN', `Killing PID ${pid} on port ${port}...`);
                    execSync(`taskkill /F /PID ${pid}`);
                }
            }
        } else {
            try {
                execSync(`lsof -ti:${port} | xargs kill -9`);
            } catch { /* ignore */ }
        }
    } catch {
        // No process on port — fine
    }
}

async function startBridge(): Promise<ChildProcess> {
    log('BRIDGE', 'Starting Bridge Agent...');
    const subprocess = spawn('pnpm', ['--filter', '@redbyte/rb-bridge-agent', 'dev'], {
        shell: true,
        stdio: 'pipe',
        detached: false
    });

    subprocess.stdout.on('data', d => process.stdout.write(`[BRIDGE] ${d}`));
    subprocess.stderr.on('data', d => process.stderr.write(`[BRIDGE] ${d}`));

    let attempts = 0;
    while (attempts < 30) {
        try {
            const res = await fetch(`${BRIDGE_URL}/health`);
            if (res.ok) {
                pass('BRIDGE');
                return subprocess;
            }
        } catch { /* wait */ }
        await pause(1000);
        attempts++;
        process.stdout.write('.');
    }

    fail('BRIDGE', 'Timed out waiting for bridge to start.');
}

async function hardwareGate() {
    console.log('\n\x1b[45m\x1b[37m  PHASE 2: HARDWARE INTEGRATION GATE  \x1b[0m\n');

    killPort(BRIDGE_PORT);
    const bridgeProc = await startBridge();

    try {
        // Verify device discovery
        log('DEVICES', 'Verifying device list...');
        const devicesRes = await fetch(`${BRIDGE_URL}/devices`);
        if (!devicesRes.ok) throw new Error('Failed to fetch devices');
        const devicesData = await devicesRes.json();
        const devices = devicesData.devices || [];
        log('DEVICES', `Found ${devices.length} device(s).`);
        pass('DEVICES');

        // Run truth sequence
        log('TRUTH', 'Running verify_client.ts...');
        execSync(`npx tsx ${VERIFY_SCRIPT}`, { stdio: 'inherit' });
        pass('TRUTH');

        // Manual gate checklist
        console.log('\n\x1b[33m--- MANUAL VERIFICATION REQUIRED ---\x1b[0m');
        console.log('1. [x] Bridge Health OK');
        console.log('2. [x] Device Discovery (' + devices.length + ' found)');
        console.log('3. [x] Truth Sequence Passed');
        console.log('4. [ ] UI: Hardware Panel shows "Local Bridge Online"');
        console.log('5. [ ] UI: Devices list matches: ' + devices.map((d: any) => d.target).join(', '));
        console.log('6. [ ] UI: Lab 0 auto-adopts connected boards');
        console.log('7. [ ] UI: Physical SW0 toggle reflects on 3D node');
        console.log('8. [ ] UI: Export ZIP opens in Submission Inspector');
        console.log('------------------------------------\n');

        console.log('\x1b[42m\x1b[30m  HARDWARE GATE PASSED  \x1b[0m\n');

    } catch (e: any) {
        fail('HW', e.message || 'Unknown error');
    } finally {
        log('CLEAN', 'Stopping Bridge...');
        bridgeProc?.kill();
        killPort(BRIDGE_PORT);
    }
}

// ============================================================================
// MAIN
// ============================================================================

async function run() {
    console.log('\n\x1b[42m\x1b[30m === REDBYTE OS GENESIS — SHIP:GATE === \x1b[0m\n');

    // Phase 1: Always runs
    softwareGate();

    // Phase 2: Hardware (skip with --skip-hw)
    if (SKIP_HW) {
        console.log('\x1b[33m[GATE:HW] Skipped (--skip-hw flag)\x1b[0m\n');
    } else {
        await hardwareGate();
    }

    console.log('\x1b[42m\x1b[30m === SHIP:GATE SEQUENCE COMPLETE === \x1b[0m\n');
    process.exit(0);
}

run();
