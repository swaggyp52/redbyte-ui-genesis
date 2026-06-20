#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const checklistPath = path.resolve('docs/product/RED_BYTE_BROWSER_E0_PACKAGING_CHECKLIST.md');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

assert(fs.existsSync(checklistPath), 'Browser E0 packaging checklist is missing');

const text = fs.readFileSync(checklistPath, 'utf8');

const requiredPatterns = [
  [/Browser E0/i, 'names Browser E0 as the proof tier'],
  [/does not prove Vivado|No Vivado/i, 'states Browser E0 does not prove Vivado'],
  [/Basys3/i, 'names the Basys3 hardware boundary'],
  [/E1[\/-]E3|E1.*E2.*E3/s, 'separates E1-E3 proof from browser proof'],
  [/Node\s+20\.19\.0/i, 'records pinned Node 20.19.0 proof'],
  [/final.*SHA|deployed.*SHA/i, 'requires final deployed SHA proof'],
  [/redbyteapps\.dev/i, 'requires custom-domain version endpoint check'],
  [/redbyte-ui-genesis\.pages\.dev/i, 'requires Cloudflare Pages endpoint check'],
  [/Classroom Truth Gates/i, 'requires GitHub Classroom Truth Gates proof'],
  [/Cloudflare Pages/i, 'requires Cloudflare Pages proof'],
  [/commercial|paid|licensed/i, 'keeps commercial packaging separate'],
  [/Do not claim|No hardware claim/i, 'contains explicit no-overclaim language'],
];

const missing = requiredPatterns
  .filter(([pattern]) => !pattern.test(text))
  .map(([, description]) => description);

assert(
  missing.length === 0,
  `Browser E0 packaging checklist is missing required release-boundary clauses: ${missing.join('; ')}`
);

console.log('PASS: Browser E0 packaging readiness checklist is present and bounded.');
