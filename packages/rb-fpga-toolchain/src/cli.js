#!/usr/bin/env node
/**
 * rb-lab CLI
 * Toolchain orchestrator for packing and verifying lab bundles.
 */

import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { parseArgs } from 'node:util';

const VERSION = '1.0.0';

// Simple args parsing since we just need subcommands
const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
    console.log(`rb-lab v${VERSION}`);
    console.log('Usage: rb-lab <command> [options]');
    console.log('');
    console.log('Commands:');
    console.log('  pack     Pack current directory into a lab archive');
    console.log('  verify   Verify integrity of a lab project');
}

if (!command) {
    printHelp();
    process.exit(0);
}

if (command === 'pack') {
    // pack logic
    console.log(`[rb-lab] Packing lab...`);
    const manifestPath = path.resolve('lab.json');
    if (!fs.existsSync(manifestPath)) {
        console.error('[FAIL] lab.json not found in current directory.');
        process.exit(1);
    }

    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        console.log(`[OK] Found lab: ${manifest.title} (${manifest.lab_id})`);
        console.log(`[OK] Manifest is valid JSON.`);
    } catch (e) {
        console.error(`[FAIL] Invalid lab.json: ${e.message}`);
        process.exit(1);
    }

} else if (command === 'verify') {
    // verify logic
    console.log('[rb-lab] Verifying project structure...');
    const manifestPath = path.resolve('lab.json');
    if (!fs.existsSync(manifestPath)) {
        console.error('[FAIL] lab.json missing.');
        process.exit(1);
    }
    console.log('[OK] Project structure verify pass (stub).');

} else {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
}
