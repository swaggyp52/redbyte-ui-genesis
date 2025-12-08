const fs = require('fs');
const path = require('path');

// Package configurations
const packageConfigs = {
  // UI packages with potential side effects
  'rb-shell': { sideEffects: ['*.css'], hasCSS: true },
  'rb-theme': { sideEffects: false, hasCSS: false },
  'rb-primitives': { sideEffects: false, hasCSS: false },
  'rb-icons': { sideEffects: false, hasCSS: false },
  'rb-windowing': { sideEffects: false, hasCSS: false },

  // Logic packages (pure, no side effects)
  'rb-logic-core': { sideEffects: false, hasCSS: false },
  'rb-logic-adapter': { sideEffects: false, hasCSS: false },
  'rb-logic-view': { sideEffects: false, hasCSS: false },
  'rb-logic-3d': { sideEffects: false, hasCSS: false },

  // Utility packages
  'rb-utils': { sideEffects: false, hasCSS: false },
  'rb-tokens': { sideEffects: false, hasCSS: false },

  // Apps (not published to npm)
  'rb-apps': { sideEffects: false, hasCSS: false },
};

function updatePackage(packageDir, config) {
  const pkgPath = path.join(packageDir, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    console.log(`⚠️  Skipping ${packageDir} - package.json not found`);
    return;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const packageName = path.basename(packageDir);

  console.log(`\n📦 Updating ${pkg.name || packageName}...`);

  // 1. Add publishConfig
  if (!pkg.private) {
    pkg.publishConfig = {
      access: 'public',
    };
    console.log('  ✅ Added publishConfig');
  }

  // 2. Add sideEffects
  if (config.sideEffects === false) {
    pkg.sideEffects = false;
    console.log('  ✅ Set sideEffects: false');
  } else if (Array.isArray(config.sideEffects)) {
    pkg.sideEffects = config.sideEffects;
    console.log(`  ✅ Set sideEffects: ${JSON.stringify(config.sideEffects)}`);
  }

  // 3. Fix exports map
  if (pkg.exports) {
    // Ensure correct order: types first, then import/require
    const currentExports = pkg.exports['.'];

    if (currentExports) {
      const newExports = {};

      // Types should be first
      if (currentExports.types) {
        newExports.types = currentExports.types;
      }

      // Then import
      if (currentExports.import) {
        newExports.import = currentExports.import;
      }

      // Then require (if it exists)
      if (currentExports.require) {
        newExports.require = currentExports.require;
      }

      pkg.exports['.'] = newExports;
      console.log('  ✅ Fixed exports map ordering');
    }
  } else {
    // Create exports map if missing
    const mainFile = pkg.module || pkg.main || './dist/index.js';
    const typesFile = pkg.types || './dist/index.d.ts';

    pkg.exports = {
      '.': {
        types: typesFile,
        import: mainFile,
      },
    };
    console.log('  ✅ Created exports map');
  }

  // 4. Add files field if missing
  if (!pkg.files) {
    pkg.files = ['dist'];
    console.log('  ✅ Added files field');
  }

  // Write updated package.json
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`  💾 Saved ${pkgPath}`);
}

// Main execution
const packagesDir = path.join(process.cwd(), 'packages');
const packages = fs.readdirSync(packagesDir).filter(dir => {
  const stat = fs.statSync(path.join(packagesDir, dir));
  return stat.isDirectory();
});

console.log('🚀 Starting package.json updates for npm publish readiness\n');

packages.forEach(pkg => {
  const config = packageConfigs[pkg];

  if (config) {
    updatePackage(path.join(packagesDir, pkg), config);
  } else {
    console.log(`\n⚠️  No config for ${pkg} - skipping`);
  }
});

console.log('\n\n✨ Package updates complete!');
