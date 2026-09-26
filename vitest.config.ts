import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Kept separate from vite.config.ts so the production build is never affected
// by test-only configuration.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.tsx'],
    setupFiles: ['./tests/setup.ts'],
  },
});
