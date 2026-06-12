#!/usr/bin/env node

/**
 * Named general-lab workflow gate.
 *
 * The canonical proof lives in ide-blank-canvas-product-proof.mjs. Keeping this
 * as a thin entry point gives product docs and CI a course-neutral gate name
 * without duplicating the browser workflow.
 */

await import('./ide-blank-canvas-product-proof.mjs');
