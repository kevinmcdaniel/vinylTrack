import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    // next-auth imports `next/server` without an extension; let Vite resolve it.
    server: { deps: { inline: ['next-auth'] } },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      // `server-only` throws when loaded outside a Server Component build.
      // Under vitest there's no RSC boundary to enforce, so stub it out.
      'server-only': path.resolve(import.meta.dirname, './src/tests/serverOnlyStub.ts'),
    },
  },
});
