#!/usr/bin/env node

/**
 * Test Discovery Guard
 * 
 * Verifies that all packages with expectsTests:true or a __tests__/ directory
 * have at least one test file discovered by Vitest.
 * 
 * Exits with code 1 if discovery fails, prevents silent "no tests run" bugs.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../');
const PACKAGES_DIR = path.join(ROOT, 'packages');

function findTestBearingWorkspaces() {
  const workspaces = [];

  // Scan all packages
  const packages = fs.readdirSync(PACKAGES_DIR).filter(name => {
    const dir = path.join(PACKAGES_DIR, name);
    return fs.statSync(dir).isDirectory();
  });

  for (const pkg of packages) {
    const pkgDir = path.join(PACKAGES_DIR, pkg);
    const packageJsonPath = path.join(pkgDir, 'package.json');
    const hasTestsDir = fs.existsSync(path.join(pkgDir, 'src', '__tests__'));

    // Check package.json for expectsTests flag
    let expectsTests = false;
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      expectsTests = packageJson.redbyte?.expectsTests === true;
    }

    if (expectsTests || hasTestsDir) {
      workspaces.push({
        name: pkg,
        dir: pkgDir,
        expectsTests,
        hasTestsDir,
      });
    }
  }

  return workspaces;
}

function runDiscoveryCheck() {
  console.log('🔍 Test Discovery Guard\n');

  const testWorkspaces = findTestBearingWorkspaces();
  console.log(`Found ${testWorkspaces.length} test-bearing workspace(s):\n`);

  testWorkspaces.forEach(ws => {
    const markers = [];
    if (ws.expectsTests) markers.push('expectsTests=true');
    if (ws.hasTestsDir) markers.push('__tests__/ exists');
    console.log(`  • ${ws.name} (${markers.join(', ')})`);
  });
  console.log();

  let allPassed = true;
  const results = [];

  for (const workspace of testWorkspaces) {
    try {
      // Run vitest list for this workspace to discover tests
      const listOutput = execSync(
        `cd "${workspace.dir}" && vitest list --json 2>/dev/null`,
        { encoding: 'utf8', stdio: 'pipe' }
      );

      let discoveredCount = 0;
      try {
        const json = JSON.parse(listOutput);
        // Count test files discovered
        discoveredCount = (json.testFiles || []).length;
      } catch {
        // If JSON parse fails, try counting files more directly
        const allTestsStr = listOutput;
        discoveredCount = (allTestsStr.match(/\.test\.(ts|tsx)$/gm) || []).length;
      }

      results.push({
        workspace: workspace.name,
        discovered: discoveredCount,
        status: discoveredCount > 0 ? '✓' : '✗',
      });

      if (discoveredCount === 0) {
        allPassed = false;
      }
    } catch (error) {
      // vitest list might not work in all environments
      // Fall back to checking if __tests__ dir exists and has files
      const testsPath = path.join(workspace.dir, 'src', '__tests__');
      if (fs.existsSync(testsPath)) {
        const files = fs.readdirSync(testsPath)
          .filter(f => f.endsWith('.test.ts') || f.endsWith('.test.tsx'));
        
        results.push({
          workspace: workspace.name,
          discovered: files.length,
          status: files.length > 0 ? '✓' : '✗',
        });

        if (files.length === 0) {
          allPassed = false;
        }
      } else {
        results.push({
          workspace: workspace.name,
          discovered: 0,
          status: '✗',
        });
        allPassed = false;
      }
    }
  }

  console.log('Discovery Results:\n');
  results.forEach(r => {
    const icon = r.status === '✓' ? '✓' : '✗';
    const count = r.discovered === 0 ? 'NO TESTS' : `${r.discovered} test(s)`;
    console.log(`  ${icon} ${r.workspace.padEnd(30)} ${count}`);
  });
  console.log();

  if (!allPassed) {
    console.error('❌ Test Discovery Failure\n');
    console.error('One or more test-bearing workspaces have zero discovered tests.\n');
    console.error('Common causes:');
    console.error('  • Test file in wrong path (should be src/__tests__/*.test.ts(x))');
    console.error('  • Vitest include glob does not match');
    console.error('  • Test file extension incorrect\n');
    console.error('Fix discovery before proceeding.\n');
    process.exit(1);
  }

  console.log('✅ All test-bearing workspaces have tests discovered\n');
  process.exit(0);
}

runDiscoveryCheck();
