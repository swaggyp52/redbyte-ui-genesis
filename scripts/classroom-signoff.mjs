#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ALLOW_DIRTY = process.argv.includes('--allow-dirty');
const REQUIRE_BASYS3 = process.argv.includes('--require-basys3');
const COMMAND_TIMEOUT_MS = 10 * 60 * 1000;
const GIT_CHECK_TIMEOUT_MS = 30 * 1000;

const REQUIRED_SCRIPT_KEYS = [
  'repo:status',
  'ide:gate:student-loop-contract',
  'ide:gate:verify-summary-contract',
  'ide:gate:export-ready-contract',
  'hw:dryrun-program-flow-gate',
  'ide:gate:import-actionable-targets-contract',
  'ide:gate:import-renders-schematic',
];

const CHECKS = [
  {
    section: 'Repo Health',
    // Precondition: dist/ artifacts must already be built before running signoff.
    // --skip-build skips the build step inside repo:status so the chain completes
    // in a reasonable time. Artifact existence is still verified by repo:status step 5.
    name: 'Repository status chain',
    command: 'pnpm -s repo:status --skip-build',
  },
  {
    section: 'Student Loop',
    name: 'Student loop contract',
    command: 'pnpm -s ide:gate:student-loop-contract',
  },
  {
    section: 'Student Loop',
    name: 'Verify summary contract',
    command: 'pnpm -s ide:gate:verify-summary-contract',
  },
  {
    section: 'Handoff Surfaces',
    name: 'Export ready contract',
    command: 'pnpm -s ide:gate:export-ready-contract',
  },
  {
    section: 'Handoff Surfaces',
    name: 'Program flow dryrun gate',
    command: 'pnpm -s hw:dryrun-program-flow-gate',
  },
  {
    section: 'Import Onboarding',
    name: 'Import actionable targets contract',
    command: 'pnpm -s ide:gate:import-actionable-targets-contract',
  },
  {
    section: 'Import Onboarding',
    name: 'Import renders schematic contract',
    command: 'pnpm -s ide:gate:import-renders-schematic',
  },
];

function nowMs() {
  return Date.now();
}

function elapsedMs(startMs) {
  return nowMs() - startMs;
}

function runCommand(command) {
  const startedAt = nowMs();
  try {
    execSync(command, {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: COMMAND_TIMEOUT_MS,
    });
    return {
      pass: true,
      elapsed: elapsedMs(startedAt),
      details: '',
    };
  } catch (error) {
    if (error?.code === 'ETIMEDOUT' || error?.killed) {
      return {
        pass: false,
        elapsed: elapsedMs(startedAt),
        details: `Command timed out after ${COMMAND_TIMEOUT_MS}ms:\n${command}`,
      };
    }

    const stdout = typeof error?.stdout === 'string' ? error.stdout.trim() : '';
    const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
    const status = typeof error?.status === 'number' ? `exit=${error.status}` : '';
    const details = [status, stdout, stderr].filter(Boolean).join('\n');

    return {
      pass: false,
      elapsed: elapsedMs(startedAt),
      details,
    };
  }
}

function checkGitWorkingTree() {
  const startedAt = nowMs();
  try {
    const output = execSync('git status --short', {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: GIT_CHECK_TIMEOUT_MS,
    }).trim();

    if (output.length === 0) {
      return {
        pass: true,
        elapsed: elapsedMs(startedAt),
        details: '',
        bypassed: false,
      };
    }

    if (ALLOW_DIRTY) {
      return {
        pass: true,
        elapsed: elapsedMs(startedAt),
        details: `ALLOW_DIRTY override active. Current changes:\n${output}`,
        bypassed: true,
      };
    }

    return {
      pass: false,
      elapsed: elapsedMs(startedAt),
      details: `Working tree is not clean:\n${output}`,
      bypassed: false,
    };
  } catch (error) {
    if (error?.code === 'ETIMEDOUT' || error?.killed) {
      return {
        pass: false,
        elapsed: elapsedMs(startedAt),
        details: `Timed out while checking working tree after ${GIT_CHECK_TIMEOUT_MS}ms.`,
      };
    }

    const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
    return {
      pass: false,
      elapsed: elapsedMs(startedAt),
      details: stderr || 'Unable to evaluate git working tree state.',
    };
  }
}

function checkNoConflictMarkers() {
  const startedAt = nowMs();
  try {
    const filesRaw = execSync('git ls-files', {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: GIT_CHECK_TIMEOUT_MS,
    });

    const files = filesRaw
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    const conflicts = [];
    for (const relativePath of files) {
      const absolutePath = path.join(ROOT, relativePath);
      let content;
      try {
        content = fs.readFileSync(absolutePath, 'utf8');
      } catch {
        continue;
      }

      const lines = content.split(/\r?\n/);
      let startLine = null;
      let hasDivider = false;

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (line.startsWith('<<<<<<< ')) {
          startLine = index + 1;
          hasDivider = false;
          continue;
        }

        if (startLine !== null && line === '=======') {
          hasDivider = true;
          continue;
        }

        if (startLine !== null && line.startsWith('>>>>>>> ')) {
          if (hasDivider) {
            conflicts.push(`${relativePath}:${startLine}`);
          }
          startLine = null;
          hasDivider = false;
        }
      }

      if (startLine !== null) {
        conflicts.push(`${relativePath}:${startLine}`);
      }
    }

    if (conflicts.length === 0) {
      return {
        pass: true,
        elapsed: elapsedMs(startedAt),
        details: '',
      };
    }

    return {
      pass: false,
      elapsed: elapsedMs(startedAt),
      details: `Conflict markers detected:\n${conflicts.join('\n')}`,
    };
  } catch (error) {
    if (error?.code === 'ETIMEDOUT' || error?.killed) {
      return {
        pass: false,
        elapsed: elapsedMs(startedAt),
        details: `Timed out while scanning conflict markers after ${GIT_CHECK_TIMEOUT_MS}ms.`,
      };
    }

    const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
    return {
      pass: false,
      elapsed: elapsedMs(startedAt),
      details: stderr || 'Unable to scan for conflict markers.',
    };
  }
}

function checkRequiredScripts() {
  const startedAt = nowMs();
  try {
    const packageJsonPath = path.join(ROOT, 'package.json');
    const packageJsonRaw = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonRaw);
    const scripts = packageJson?.scripts ?? {};

    const missing = REQUIRED_SCRIPT_KEYS.filter((key) => typeof scripts[key] !== 'string');
    const noOps = REQUIRED_SCRIPT_KEYS.filter((key) => {
      const scriptBody = scripts[key];
      if (typeof scriptBody !== 'string') {
        return false;
      }

      const trimmed = scriptBody.trim();
      return /^echo\s+.*(gate removed|deleted|stub|placeholder)/i.test(trimmed);
    });

    if (missing.length === 0 && noOps.length === 0) {
      return {
        pass: true,
        elapsed: elapsedMs(startedAt),
        details: '',
      };
    }

    const problems = [];
    if (missing.length > 0) {
      problems.push(`Missing required scripts: ${missing.join(', ')}`);
    }
    if (noOps.length > 0) {
      problems.push(`Required scripts mapped to no-op echoes: ${noOps.join(', ')}`);
    }

    return {
      pass: false,
      elapsed: elapsedMs(startedAt),
      details: problems.join('\n'),
    };
  } catch (error) {
    return {
      pass: false,
      elapsed: elapsedMs(startedAt),
      details: error instanceof Error ? error.message : 'Unable to validate script wiring.',
    };
  }
}

function checkIsGitRepo() {
  try {
    execSync('git rev-parse --git-dir', {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

function printCheckResult(result) {
  const status = result.pass ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${result.section} :: ${result.name} (${result.elapsed}ms)`);
  if (result.details) {
    const detailBlock = result.details
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n');
    console.log(detailBlock);
  }
}

function main() {
  console.log('Classroom Release Sign-Off');
  console.log('===========================');

  if (!checkIsGitRepo()) {
    console.log('FINAL VERDICT: NOT_READY');
    console.log('Reason: run classroom sign-off from within a git repository.');
    process.exit(1);
  }

  if (ALLOW_DIRTY) {
    console.log('NOTE: --allow-dirty enabled. Clean-tree check will be reported but not blocking.');
  }
  if (REQUIRE_BASYS3) {
    console.log('NOTE: --require-basys3 enabled. Live hardware readiness is blocking.');
  }

  const results = [];

  results.push({
    section: 'Release Hygiene',
    name: 'Required signoff scripts are wired and non-stubbed',
    ...checkRequiredScripts(),
  });

  results.push({
    section: 'Release Hygiene',
    name: 'No merge conflict markers in tracked files',
    ...checkNoConflictMarkers(),
  });

  results.push({
    section: 'Release Hygiene',
    name: 'Working tree clean',
    ...checkGitWorkingTree(),
  });

  for (const check of CHECKS) {
    const commandResult = runCommand(check.command);
    results.push({
      section: check.section,
      name: check.name,
      ...commandResult,
    });
  }

  if (REQUIRE_BASYS3) {
    const hardwareResult = runCommand('pnpm -s classroom:hw:check -- --strict');
    results.push({
      section: 'Classroom Hardware',
      name: 'Basys3 live readiness check',
      ...hardwareResult,
    });
  }

  console.log('');
  for (const result of results) {
    printCheckResult(result);
  }

  const failed = results.filter((result) => !result.pass);
  const passed = results.length - failed.length;
  const workingTreeResult = results.find((result) => result.name === 'Working tree clean');
  const degradedBypassMode = Boolean(workingTreeResult?.bypassed);

  console.log('');
  console.log(`Summary: ${passed}/${results.length} checks passed`);
  if (ALLOW_DIRTY && !degradedBypassMode) {
    console.log('NOTE: --allow-dirty was set, but no dirty-tree bypass was used in this run.');
  }

  if (failed.length === 0) {
    if (degradedBypassMode) {
      console.log('FINAL VERDICT: DEV_BYPASS_ONLY');
      console.log('CLASSROOM_READY: NO (allow-dirty bypass mode)');
      process.exit(0);
    }
    console.log('FINAL VERDICT: CLASSROOM_READY');
    process.exit(0);
  }

  console.log('FINAL VERDICT: NOT_READY');
  process.exit(1);
}

main();
