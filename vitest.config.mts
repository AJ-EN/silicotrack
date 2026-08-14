import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    /**
     * Load .env into the test process.
     *
     * The third argument is an empty prefix, so DATABASE_URL comes through —
     * Vite would otherwise only expose VITE_-prefixed vars. Uses Vite's own
     * loader rather than dotenv, which is only a transitive dependency here.
     *
     * Only `ingest.test.ts` needs this; the other 206 tests are pure. Without
     * it those database tests skip silently and the idempotence regression
     * guard stops guarding anything.
     */
    env: loadEnv(mode, process.cwd(), ''),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}));
