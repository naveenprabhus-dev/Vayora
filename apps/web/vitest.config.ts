import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@uaqa/contracts': path.resolve(import.meta.dirname, '../../packages/contracts/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: [path.resolve(import.meta.dirname, './tests/unit/setup.ts')],
    include: ['tests/unit/**/*.test.{ts,tsx}'],
  },
});
