import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    hookTimeout: 30000,
    testTimeout: 30000,
    server: {
      deps: {
        // node:sqlite là builtin Node 22+ — Vite/Vitest chưa nhận diện sẵn.
        external: [/node:sqlite/i, /^node:/],
      },
    },
  },
});
