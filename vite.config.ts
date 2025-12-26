import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/sattosat/',
  resolve: {
    // Prevent accidental duplicate Three.js bundles (warns in console)
    dedupe: ['three'],
  },
});
