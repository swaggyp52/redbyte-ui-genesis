// Copyright Â© 2025 Connor Angiel â€” RedByte OS Genesis
// Use without permission prohibited.
// Licensed under the RedByte Proprietary License (RPL-1.0). See LICENSE.
// 3D facade module used for code-splitting.
// Importing from `@redbyte/rb-logic-3d` directly can cause Rollup to merge the 3D
// package into unrelated chunks. Keeping a dedicated wrapper lets the app bundle
// load 3D only when the user enables it.
if (import.meta.env.DEV) {
    console.log('[lazy] Loading @redbyte/rb-logic-3d chunk (Logic3DScene)');
}
export { Logic3DScene } from '@redbyte/rb-logic-3d';
