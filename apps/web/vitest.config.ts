import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true
  },
  resolve: {
    alias: {
      '@hexmud/protocol': new URL('../../packages/protocol/src/index.ts', import.meta.url).pathname
    }
  }
});
