#!/usr/bin/env node

/**
 * check-no-deep-imports.mjs
 *
 * CI/pre-commit gate: scans codebase for forbidden deep imports using Node.js file I/O.
 * This is a backup to ESLint rules, catching issues in misconfigured IDEs.
 *
 * Exit codes:
 *   0 = No deep imports found (pass)
 *   1 = Deep imports detected (fail)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

console.log('🔍 Scanning for forbidden deep imports...\n');

const violations = [];

// Patterns to check
const patterns = [
    {
        regex: /@redbyte\/[^/]+\/src\//,
        desc: '@redbyte/.../src/ imports (use package entrypoint instead)',
    },
    {
        regex: /packages\/[^/]+\/src\//,
        desc: 'packages/**/src/ relative imports (use published @redbyte/package)',
    },
];

// Directories to scan
// Only packages/ and tools/ enforce the no-deep-imports discipline.
// Apps are specialized builds (playground is the unified/product build, manual-site is marketing)
// and use relative path imports directly from package source as needed.
const scanDirs = [
    'packages/rb-apps/src',
    'packages/rb-fpga-toolchain/src',
    'packages/rb-logic-core/src',
    'packages/rb-logic-3d/src',
    'packages/rb-primitives/src',
    'packages/rb-shell/src',
    'packages/rb-utils/src',
    'tools/eslint-rules',
];

// File extensions to check
const extensions = ['.ts', '.tsx', '.js', '.jsx'];

function walkDir(dir) {
    const files = [];
    if (!fs.existsSync(dir)) return files;

    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') {
                continue; // Skip hidden and node_modules
            }
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...walkDir(fullPath));
            } else if (extensions.some(ext => entry.name.endsWith(ext))) {
                files.push(fullPath);
            }
        }
    } catch (err) {
        // Ignore permission errors
    }

    return files;
}

// Scan all files
const files = [];
for (const dir of scanDirs) {
    const fullPath = path.join(ROOT, dir);
    files.push(...walkDir(fullPath));
}

console.log(`Scanning ${files.length} source files...\n`);

for (const { regex, desc } of patterns) {
    console.log(`📋 Checking: ${desc}`);
    let count = 0;

    for (const file of files) {
        try {
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Skip comments
                if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
                    continue;
                }
                // Check for import/require statements only
                if ((line.includes('import') || line.includes('require')) && regex.test(line)) {
                    violations.push({
                        file: path.relative(ROOT, file),
                        line: i + 1,
                        code: line.trim(),
                    });
                    count++;
                }
            }
        } catch (err) {
            // Ignore read errors
        }
    }

    if (count > 0) {
        console.log(`  ❌ Found ${count} violation(s):\n`);
        // Show first 10
        const toShow = violations.filter(v => violations.indexOf(v) < 10);
        for (const v of toShow) {
            console.log(`     ${v.file}:${v.line}`);
            console.log(`       ${v.code.substring(0, 80)}...\n`);
        }
        if (count > 10) {
            console.log(`     ... and ${count - 10} more\n`);
        }
    } else {
        console.log(`  ✅ None found\n`);
    }
}

console.log('═'.repeat(50) + '\n');

if (violations.length > 0) {
    console.log(`❌ FAIL: ${violations.length} deep import(s) detected. Fix before committing.\n`);
    console.log('How to fix:');
    console.log('  1. Replace @redbyte/rb-utils/src/foo → @redbyte/rb-utils');
    console.log('  2. Replace ../../../../packages/rb-utils/src/foo → @redbyte/rb-utils');
    console.log('  3. Verify the package exports the symbol in its package.json "exports"\n');
    process.exit(1);
} else {
    console.log('✅ PASS: No deep imports detected.\n');
    process.exit(0);
}
