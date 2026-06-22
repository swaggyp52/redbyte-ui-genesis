#!/usr/bin/env node

import { runGateSuite } from './gates/gate-manifest.mjs';

runGateSuite('verify:gates:classroom', {
  label: 'verify:gates:classroom',
  stopOnFailure: false,
  summaryBaseName: 'gate-summary',
}).catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
