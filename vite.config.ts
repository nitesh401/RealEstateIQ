/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' makes every asset URL relative, so the build works under any
// GitHub Pages sub-path (https://user.github.io/<repo>/) without edits.
// Navigation is state-based (no client-side path routing), so no 404.html tricks are needed.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 900 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
