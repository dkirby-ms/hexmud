import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      '**/tests/**/*.{test,spec}.{ts,tsx}',
      '**/__tests__/**/*.{test,spec}.{ts,tsx}'
    ],
    coverage: {
      enabled: false,
      provider: 'v8',
      reportsDirectory: './coverage',
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80
      }
    }
  }
});
