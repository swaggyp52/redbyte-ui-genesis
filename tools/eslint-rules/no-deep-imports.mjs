/**
 * no-deep-imports.mjs
 *
 * ESLint plugin rule: prevents deep imports within the @redbyte namespace.
 * All cross-package imports must use the canonical @redbyte/package-name entrypoint.
 *
 * RATIONALE: Filesystem imports like `import { foo } from '../../../../packages/rb-utils/src/foo'`
 * are fragile and break when package boundaries change. Force all cross-package imports
 * through package.json `exports`, which are guaranteed stable.
 *
 * EXAMPLES:
 *   ❌ BAD:  import { foo } from '@redbyte/rb-utils/src/foo'
 *   ❌ BAD:  import { foo } from '../../../../packages/rb-utils/src/foo'
 *   ✅ OK:   import { foo } from '@redbyte/rb-utils'
 *
 * This rule is enabled in packages/rb-apps and tools/
 */

export default {
    meta: {
        type: 'problem',
        docs: {
            description: 'Prevent deep imports within @redbyte packages',
            category: 'module-boundary',
            recommended: true,
        },
        messages: {
            deepImportSrc: 'Deep import from /src/ is forbidden. Use the package entrypoint instead.',
            deepImportFilesystem: 'Deep import using relative path is forbidden. Use thepublished @redbyte/package-name instead.',
        },
    },
    create(context) {
        return {
            ImportDeclaration(node) {
                const source = node.source.value;

                // Check for @redbyte/*/src/ imports
                if (source.includes('@redbyte/') && source.includes('/src/')) {
                    context.report({
                        node,
                        messageId: 'deepImportSrc',
                        fix(fixer) {
                            // Suggest converting '@redbyte/rb-utils/src/foo' to '@redbyte/rb-utils'
                            const match = source.match(/(@redbyte\/[^/]+)\//);
                            if (match) {
                                return fixer.replaceText(node.source, `'${match[1]}'`);
                            }
                            return null;
                        },
                    });
                }

                // Check for relative imports traversing packages/
                if (source.includes('packages/') && source.includes('/src/')) {
                    context.report({
                        node,
                        messageId: 'deepImportFilesystem',
                    });
                }
            },
        };
    },
};
