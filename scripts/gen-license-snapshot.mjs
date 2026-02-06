#!/usr/bin/env node

/**
 * gen-license-snapshot.mjs
 * 
 * Generates a deterministic license snapshot of all workspace dependencies.
 * Reads from workspace package.json files and node_modules metadata.
 * Output: docs/licenses.snapshot.json (sorted, deterministic)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wsRoot = path.resolve(__dirname, '..');

/**
 * Extract license info from all installed packages using pnpm list.
 */
function extractLicensesFromNodeModules() {
  const nodeModulesPath = path.join(wsRoot, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    throw new Error(`node_modules not found: ${nodeModulesPath}`);
  }

  const deps = new Map();

  // Iterate through all direct dependencies in node_modules
  for (const entry of fs.readdirSync(nodeModulesPath)) {
    const entryPath = path.join(nodeModulesPath, entry);
    const stat = fs.statSync(entryPath);

    if (!stat.isDirectory() || entry.startsWith('.')) continue;

    // Handle scoped packages (@scope/package)
    if (entry.startsWith('@')) {
      for (const scopedEntry of fs.readdirSync(entryPath)) {
        const scopedPath = path.join(entryPath, scopedEntry);
        const scopedStat = fs.statSync(scopedPath);
        if (!scopedStat.isDirectory()) continue;

        const pkgName = `${entry}/${scopedEntry}`;
        const pkgJsonPath = path.join(scopedPath, 'package.json');
        if (fs.existsSync(pkgJsonPath)) {
          const pkgData = extractFromPackageJson(pkgName, pkgJsonPath);
          if (pkgData) {
            const key = `${pkgData.name}@${pkgData.version}`;
            deps.set(key, pkgData);
          }
        }
      }
      continue;
    }

    // Handle regular packages
    const pkgJsonPath = path.join(entryPath, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      const pkgData = extractFromPackageJson(entry, pkgJsonPath);
      if (pkgData) {
        const key = `${pkgData.name}@${pkgData.version}`;
        deps.set(key, pkgData);
      }
    }
  }

  return deps;
}

/**
 * Extract license and metadata from a single package.json.
 */
function extractFromPackageJson(name, pkgJsonPath) {
  try {
    const content = fs.readFileSync(pkgJsonPath, 'utf8');
    const pkg = JSON.parse(content);

    if (!pkg.name || !pkg.version) return null;

    const extractedLicense = pkg.license || 'UNKNOWN';
    const license = getLicenseWithFallback(pkg.name, extractedLicense);

    return {
      name: pkg.name,
      version: pkg.version,
      license: license,
      repository: typeof pkg.repository === 'string' ? pkg.repository : null,
    };
  } catch {
    return null;
  }
}


/**
 * Normalize license string to uppercase SPDX.
 */
function normalizeLicense(licenseStr) {
  if (!licenseStr || licenseStr === 'UNKNOWN' || !licenseStr.trim()) {
    return 'UNKNOWN';
  }

  const normalized = licenseStr.trim().toUpperCase();
  return normalized || 'UNKNOWN';
}

/**
 * Fallback licenses for known packages that may not declare license in package.json
 */
const FALLBACK_LICENSES = {
  'eslint-plugin-jsx-a11y': 'MIT',
  '@eslint/eslintrc': 'MIT',
};

/**
 * Get license with fallback for known packages.
 */
function getLicenseWithFallback(name, extractedLicense) {
  const normalized = normalizeLicense(extractedLicense);
  if (normalized !== 'UNKNOWN') {
    return normalized;
  }
  return FALLBACK_LICENSES[name] || 'UNKNOWN';
}

/**
 * Generate deterministic snapshot.
 */
function generateSnapshot() {
  const deps = extractLicensesFromNodeModules();

  // Convert to sorted array
  const snapshot = Array.from(deps.values())
    .sort((a, b) => {
      const aKey = `${a.name}@${a.version}`;
      const bKey = `${b.name}@${b.version}`;
      return aKey.localeCompare(bKey);
    })
    .map(dep => ({
      name: dep.name,
      version: dep.version,
      license: dep.license,
      ...(dep.repository && { repository: dep.repository }),
    }));

  return snapshot;
}


/**
 * Main: generate and save snapshot.
 */
async function main() {
  try {
    const snapshot = generateSnapshot();

    const outputPath = path.join(wsRoot, 'docs', 'licenses.snapshot.json');
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write deterministic JSON (sorted keys, 2-space indent)
    fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
    console.log(`✓ License snapshot generated: ${outputPath}`);
    console.log(`✓ Total dependencies scanned: ${snapshot.length}`);

    // Report UNKNOWN licenses
    const unknown = snapshot.filter(d => d.license === 'UNKNOWN');
    if (unknown.length > 0) {
      console.warn(`\n⚠ UNKNOWN licenses (${unknown.length}):`);
      unknown.forEach(d => console.warn(`  - ${d.name}@${d.version}`));
      process.exit(1);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error generating license snapshot:', err.message);
    process.exit(1);
  }
}

main();
