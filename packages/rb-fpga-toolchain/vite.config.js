import { defineConfig } from 'vite';
import { resolve } from 'path';
import { builtinModules } from 'module';
export default defineConfig({
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
