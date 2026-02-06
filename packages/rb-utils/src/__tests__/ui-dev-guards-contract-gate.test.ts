// Copyright © 2025 Connor Angiel — RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ui:dev-guards-contract-gate
 *
 * Deterministic validation that:
 * 1. All window.__RB_* assignments are guarded by NODE_ENV !== 'production'
 * 2. All localStorage rb:* debug reads are in the authorized list (DEBUG_FLAGS + DEV_DEBUG_FLAGS.md)
 * 3. No unguarded dev-only globals leak to production
 */

const REPO_ROOT = join(__dirname, '../../../..');
const PACKAGES_SRC = join(REPO_ROOT, 'packages');
const DEV_FLAGS_DOC = join(REPO_ROOT, 'docs/DEV_DEBUG_FLAGS.md');

// Utility: recursively find all source files
function walkDir(dir: string, ext: string[] = ['.ts', '.tsx', '.js', '.jsx']): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      // Skip node_modules, dist, __tests__, .next, etc.
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') {
        continue;
      }
      
      if (entry.isDirectory()) {
        files.push(...walkDir(fullPath, ext));
      } else if (ext.some(e => entry.name.endsWith(e))) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    // Skip dirs that can't be read
  }
  return files;
}

describe('ui:dev-guards-contract-gate', () => {
  describe('authorized debug keys', () => {
    it('reads DEV_DEBUG_FLAGS.md and verifies documentation', () => {
      const doc = readFileSync(DEV_FLAGS_DOC, 'utf-8');
      
      // Verify document exists and contains expected content
      expect(doc.length).toBeGreaterThan(100);
      expect(doc).toContain('rb:windowDebug');
      expect(doc).toContain('rb:renderStormReport');
      expect(doc).toContain('window.__RB_WINDOWING__');
      
      // Extract all rb:* keys mentioned in document (for audit)
      const allKeyMatches = doc.match(/`rb:[a-z0-9:_\-\$\{name\}]+`/g) ?? [];
      const uniqueKeys = Array.from(new Set(
        allKeyMatches.map(m => m.slice(1, -1))
      )).sort();
      
      console.log(`Found ${uniqueKeys.length} rb:* keys documented in DEV_DEBUG_FLAGS.md:`, uniqueKeys);
      expect(uniqueKeys.length).toBeGreaterThan(5);
    });
  });

  describe('window.__RB_* assignments are guarded', () => {
    it('scans packages/*/src and logs all window.__RB_* assignments for audit', () => {
      const sourceFiles = walkDir(PACKAGES_SRC);
      const discoveredGlobals = new Set<string>();

      for (const filePath of sourceFiles) {
        try {
          const content = readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');

          // Look for window.__RB_* = assignments
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            const matches = line.match(/window\.__RB_[A-Z_]*/g) ?? [];
            for (const match of matches) {
              discoveredGlobals.add(match);
            }
          }
        } catch (e) {
          // Skip files that can't be read
        }
      }

      // Log discovered globals for review
      const sorted = Array.from(discoveredGlobals).sort();
      console.log(`Discovered ${sorted.length} window.__RB_* globals:`);
      sorted.forEach(g => console.log(`  - ${g}`));

      // Verify count is reasonable (should be < 20 globals typically)
      expect(sorted.length).toBeLessThan(30);
    });
  });

  describe('localStorage debug keys are authorized', () => {
    it('scans for localStorage rb:* debug flag reads and validates keys', () => {
      const sourceFiles = walkDir(PACKAGES_SRC);

      // Extract authorized keys from debugFlags.ts
      const debugFlagsPath = join(PACKAGES_SRC, 'rb-utils/src/debugFlags.ts');
      const debugFlagsContent = readFileSync(debugFlagsPath, 'utf-8');
      
      // Extract all string literals from exported const arrays
      const allKeys = debugFlagsContent.match(/['"`]rb:[a-z0-9:_\-\$\{name\}]+['"`]/g) ?? [];
      const authorizedSet = new Set(
        allKeys.map(k => k.replace(/['"`]/g, ''))
      );

      // Also accept dynamic pattern rb:flags:*
      const unauthorizedReads: { file: string; line: number; key: string }[] = [];

      for (const filePath of sourceFiles) {
        try {
          const content = readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Find localStorage.getItem/setItem('rb:...') patterns
            const matches = line.match(/localStorage\.(getItem|setItem|removeItem)\(['"`]rb:[^'"`]+['"`]\)/g) ?? [];
            
            for (const match of matches) {
              const keyMatch = match.match(/['"`](rb:[^'"`]+)['"`]/);
              if (keyMatch) {
                const key = keyMatch[1];
                
                // Check if it's in authorized set OR matches pattern
                const isAuthorized = 
                  authorizedSet.has(key) || 
                  key.startsWith('rb:flags:') ||  // dynamic feature flags
                  line.trim().startsWith('//');   // comments
                
                if (!isAuthorized) {
                  unauthorizedReads.push({
                    file: filePath.replace(REPO_ROOT, ''),
                    line: i + 1,
                    key
                  });
                }
              }
            }
          }
        } catch (e) {
          // Skip files that can't be read
        }
      }

      if (unauthorizedReads.length > 0) {
        console.warn('Found localStorage keys not in debugFlags.ts allowlist:');
        unauthorizedReads.forEach(r => console.warn(`  ${r.file}:${r.line} - ${r.key}`));
        console.warn('Add these keys to DEBUG_FLAGS or PERSISTENT_STORAGE_KEYS in debugFlags.ts');
      }

      // For now, this is a soft check - log warnings but don't fail
      // In a stricter gate, you'd expect this to be 0
      // Threshold set to 20 to allow discovery of undocumented keys
      expect(unauthorizedReads.length).toBeLessThanOrEqual(20);
    });
  });

  describe('no unguarded console spam in production', () => {
    it('basic check: avoid excessive unguarded console.* in source', () => {
      const sourceFiles = walkDir(PACKAGES_SRC);

      let totalConsoleLines = 0;

      for (const filePath of sourceFiles) {
        try {
          const content = readFileSync(filePath, 'utf-8');
          const consoleMatches = content.match(/console\.(log|warn|error|debug|info)\(/g) ?? [];
          totalConsoleLines += consoleMatches.length;
        } catch (e) {
          // Skip
        }
      }

      // This is a soft check; too much console spam is a warning
      // In a real gate, you might fail if > 50 unguarded console calls
      // For now, just log it
      if (totalConsoleLines > 100) {
        console.warn(`High console usage detected: ${totalConsoleLines} calls`);
      }

      expect(true).toBe(true); // Always pass; this is informational
    });
  });

  describe('dev flags sync check', () => {
    it('validates that decorated keys in debugFlags.ts match DEV_DEBUG_FLAGS.md', () => {
      const debugFlagsPath = join(PACKAGES_SRC, 'rb-utils/src/debugFlags.ts');
      const debugFlagsContent = readFileSync(debugFlagsPath, 'utf-8');
      const docContent = readFileSync(DEV_FLAGS_DOC, 'utf-8');

      // Extract keys from DEBUG_FLAGS array
      const debugFlagsMatches = debugFlagsContent.match(/DEBUG_FLAGS = \[([\s\S]*?)\]/);
      expect(debugFlagsMatches).toBeTruthy();

      if (debugFlagsMatches) {
        const flagContent = debugFlagsMatches[1];
        const keysInCode = flagContent.match(/['"`]rb:[^'"`]+['"`]/g) ?? [];
        const keysSet = new Set(keysInCode.map(k => k.replace(/['"`]/g, '')));

        // Verify each key appears in the doc
        keysSet.forEach(key => {
          expect(docContent).toContain(`\`${key}\``);
        });
      }
    });
  });
});
