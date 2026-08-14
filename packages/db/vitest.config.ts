import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    server: {
      deps: {
        // node:sqlite là builtin Node 22+ — Vite/Vitest chưa nhận diện sẵn.
        // External để runtime Node xử lý trực tiếp, tránh lỗi "Failed to load url sqlite".
        external: [/node:sqlite/i, /^node:/],
      },
    },
  },
});