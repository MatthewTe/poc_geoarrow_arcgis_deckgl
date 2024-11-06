import wasm from 'vite-plugin-wasm';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [wasm()],
  optimizeDeps: {
    include: ['@geoarrow/geoarrow-wasm'],
  },
  build: {
    target: 'esnext', // Ensure ES module syntax
    rollupOptions: {
      output: {
        format: 'es', // Use ES modules for better WASM compatibility
      },
    },
  },
});
