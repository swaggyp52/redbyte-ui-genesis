#!/usr/bin/env node

import { runGateSuite } from './gates/gate-manifest.mjs';

runGateSuite('classroom:gate', {
  label: 'classroom:gate',
  stopOnFailure: true,
  summaryBaseName: 'classroom-gate-summary',
}).catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
