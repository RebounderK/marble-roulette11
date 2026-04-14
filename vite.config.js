import { defineConfig } from 'vite';

export default defineConfig({
    base: './', // Ensures assets are loaded correctly on GitHub Pages (relative paths)
    build: {
        outDir: 'dist',
    }
});
