import { defineConfig } from 'vite';
import { resolve } from 'path';
import { builtinModules } from 'module';
export default defineConfig({
    // The .ts modules are the source of truth and the .js siblings beside them are stale mirrors
    // (verilog-generator.js still reports every D flip-flop Q output as "has no driver"). Vitest
    // already resolves .ts first; the library build must too, or the package ships the mirrors.
    resolve: {
        extensions: ['.ts', '.mts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
    },
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'RbFpgaToolchain',
            fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
        },
        // Target Node.js environment
        ssr: true,
        rollupOptions: {
            // Externalize all Node.js built-ins
            external: [
                ...builtinModules,
                ...builtinModules.map((m) => `node:${m}`),
            ],
            output: [
                { format: 'es', entryFileNames: '[name].js' },
                { format: 'cjs', entryFileNames: '[name].cjs' },
            ],
        },
    },
});
