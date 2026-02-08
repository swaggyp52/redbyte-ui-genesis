/**
 * ui-license-audit-gate.test.ts
 *
 * Deterministic gate ensuring all dependencies have valid, known licenses
 * and no forbidden licenses (AGPL, SSPL, GPL-3.0-only) are used.
 *
 * This gate validates:
 * 1. License snapshot file exists and is valid JSON
 * 2. Re-running the snapshot generator produces identical output (no drift)
 * 3. No UNKNOWN licenses detected
 * 4. No forbidden licenses (AGPL-*, SSPL-*, GPL-3.0-only)
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wsRoot = path.resolve(__dirname, '../../../../');
const snapshotPath = path.join(wsRoot, 'docs', 'licenses.snapshot.json');
const generatorScript = path.join(wsRoot, 'scripts', 'gen-license-snapshot.mjs');
describe('ui:license-audit-gate', () => {
    describe('license snapshot file', () => {
        it('license snapshot file exists', () => {
            expect(fs.existsSync(snapshotPath)).toBe(true);
        });
        it('license snapshot is valid JSON', () => {
            const content = fs.readFileSync(snapshotPath, 'utf8');
            const parsed = JSON.parse(content);
            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed.length).toBeGreaterThan(0);
        });
    });
    describe('snapshot determinism', () => {
        it('re-running generator produces identical output', () => {
            // Read current snapshot
            const currentContent = fs.readFileSync(snapshotPath, 'utf8');
            const currentSnapshot = JSON.parse(currentContent);
            // Run generator to produce new snapshot
            try {
                execSync(`node ${generatorScript}`, {
                    cwd: wsRoot,
                    encoding: 'utf8',
                    stdio: 'pipe',
                });
            }
            catch (err) {
                // Generator may fail due to UNKNOWN licenses; capture output
                if (err.stdout)
                    console.log(err.stdout);
                if (err.stderr)
                    console.log(err.stderr);
                // If generator failed, it already logged UNKNOWN licenses
                // We'll validate below
            }
            // Read newly generated snapshot
            const newContent = fs.readFileSync(snapshotPath, 'utf8');
            const newSnapshot = JSON.parse(newContent);
            // Verify deterministic output (same order, same dependencies)
            expect(currentSnapshot.length).toBe(newSnapshot.length);
            expect(JSON.stringify(currentSnapshot, null, 2)).toBe(JSON.stringify(newSnapshot, null, 2));
        });
    });
    describe('license validation', () => {
        it('no UNKNOWN licenses detected', () => {
            const content = fs.readFileSync(snapshotPath, 'utf8');
            const snapshot = JSON.parse(content);
            const unknown = snapshot.filter((dep) => dep.license === 'UNKNOWN');
            if (unknown.length > 0) {
                console.warn('\n⚠ UNKNOWN licenses found:');
                unknown.forEach((dep) => {
                    console.warn(`  - ${dep.name}@${dep.version}: ${dep.license}`);
                });
            }
            expect(unknown.length).toBe(0);
        });
        it('no forbidden licenses detected', () => {
            const content = fs.readFileSync(snapshotPath, 'utf8');
            const snapshot = JSON.parse(content);
            const forbiddenLicenses = [
                /^AGPL-.*/,
                /^SSPL.*/,
                /^GPL-3\.0-ONLY$/,
            ];
            const forbidden = snapshot.filter((dep) => {
                return forbiddenLicenses.some((pattern) => pattern.test(dep.license));
            });
            if (forbidden.length > 0) {
                console.warn('\n🚫 Forbidden licenses found:');
                forbidden.forEach((dep) => {
                    console.warn(`  - ${dep.name}@${dep.version}: ${dep.license}`);
                });
            }
            expect(forbidden.length).toBe(0);
        });
        it('all licenses are normalized (uppercase SPDX)', () => {
            const content = fs.readFileSync(snapshotPath, 'utf8');
            const snapshot = JSON.parse(content);
            // Check that licenses are in expected format (uppercase or UNKNOWN)
            const invalidLicenses = snapshot.filter((dep) => {
                const lic = dep.license;
                // SPDX license should be UPPERCASE or contain hyphens (e.g., BSD-3-Clause, Apache-2.0)
                // UNKNOWN is valid
                if (lic === 'UNKNOWN')
                    return false;
                if (!/^[A-Z0-9\-().+/|]+$/.test(lic))
                    return true; // Invalid chars
                return false;
            });
            if (invalidLicenses.length > 0) {
                console.warn('\n⚠ Non-normalized licenses found:');
                invalidLicenses.forEach((dep) => {
                    console.warn(`  - ${dep.name}@${dep.version}: ${dep.license}`);
                });
            }
            expect(invalidLicenses.length).toBe(0);
        });
    });
    describe('snapshot coverage', () => {
        it('snapshot includes common permissive licenses', () => {
            const content = fs.readFileSync(snapshotPath, 'utf8');
            const snapshot = JSON.parse(content);
            const licenses = new Set(snapshot.map((dep) => dep.license));
            // Expected common licenses (at least some should be present)
            const expectedLicenses = ['MIT', 'APACHE-2.0', 'BSD-3-CLAUSE', 'ISC'];
            const found = expectedLicenses.filter((lic) => licenses.has(lic));
            expect(found.length).toBeGreaterThan(0);
            console.log(`✓ Found permissive licenses: ${found.join(', ')}`);
        });
        it('snapshot is sorted by name@version (deterministic ordering)', () => {
            const content = fs.readFileSync(snapshotPath, 'utf8');
            const snapshot = JSON.parse(content);
            const keys = snapshot.map((dep) => `${dep.name}@${dep.version}`);
            const sorted = [...keys].sort();
            expect(keys).toEqual(sorted);
        });
    });
});
