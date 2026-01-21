#!/usr/bin/env node
/**
 * RedByte OS - Batch Grader (check-grader)
 * Version 1.0.0
 * 
 * Verifies student evidence capsules against a "Golden Trace".
 * 
 * Usage:
 *   node check-grader.js --student ./submission/evidence.json --golden ./master/evidence.json
 */

import fs from 'fs/promises';
import path from 'path';
import { program } from 'commander';
import chalk from 'chalk';
import {
    parseCapsule,
    diffCapsules,
    resolveEventsFromCapsule
} from '@redbyte/rb-fpga-proof-core';

program
    .name('check-grader')
    .description('Verify RedByte evidence capsules against a golden master')
    .requiredOption('-s, --student <path>', 'Path to student evidence.json')
    .requiredOption('-g, --golden <path>', 'Path to golden master evidence.json')
    .option('--json', 'Output report as JSON')
    .option('--strict', 'Fail if metadata differs (default: false)', false);

program.parse();

const options = program.opts();

async function loadCapsule(filePath) {
    try {
        const raw = await fs.readFile(filePath, 'utf-8');
        const capsule = parseCapsule(JSON.parse(raw));

        // Resolve external events if needed
        const { events } = await resolveEventsFromCapsule(capsule, async (ref) => {
            // Resolve relative to the capsule file
            const refPath = path.resolve(path.dirname(filePath), ref);
            return await fs.readFile(refPath, 'utf-8');
        });

        return { capsule, events };
    } catch (error) {
        throw new Error(`Failed to load ${filePath}: ${error.message}`);
    }
}

async function run() {
    try {
        const studentPath = path.resolve(options.student);
        const goldenPath = path.resolve(options.golden);

        if (!options.json) {
            console.log(chalk.bold('RedByte Batch Grader v1.0'));
            console.log(chalk.gray('-------------------------'));
            console.log(`Student: ${chalk.cyan(path.basename(studentPath))}`);
            console.log(`Golden:  ${chalk.cyan(path.basename(goldenPath))}`);
            console.log(chalk.gray('-------------------------'));
        }

        const student = await loadCapsule(studentPath);
        const golden = await loadCapsule(goldenPath);

        // Verify Integrity (TODO: Verify signatures)
        // For now, we trust the files are valid capsules

        // Compare Traces
        const diff = diffCapsules(
            golden.capsule,
            student.capsule,
            golden.events,
            student.events,
            options.strict
        );

        if (options.json) {
            console.log(JSON.stringify(diff, null, 2));
        } else {
            if (diff.exitCode === 0) {
                console.log(chalk.green.bold(' PASS '));
                console.log('Traces match perfectly.');
            } else {
                console.log(chalk.red.bold(' FAIL '));
                console.log(`Reason: ${diff.summary}`);
                if (diff.firstMismatch) {
                    console.log(`Detail: ${diff.firstMismatch.detail}`);
                }
            }
        }

        process.exit(diff.exitCode);

    } catch (error) {
        if (options.json) {
            console.log(JSON.stringify({ error: error.message, exitCode: 2 }));
        } else {
            console.error(chalk.red('FATAL ERROR:'), error.message);
        }
        process.exit(2);
    }
}

run();
