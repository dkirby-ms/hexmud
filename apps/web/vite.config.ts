import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
  '@hexmud/protocol': path.resolve(__dirname, '../../packages/protocol/src')
    }
  },
  server: {
    port: 5173,
    host: '0.0.0.0'
  }
});
