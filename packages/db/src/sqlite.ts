/**
 * sqlite.ts — Wrapper cho `node:sqlite` (DatabaseSync).
 *
 * Lý do: `node:sqlite` là builtin MỚI của Node 22+ chưa nằm trong danh sách
 * builtin mà Vite/Vitest nhận diện sẵn, nên `import ... from 'node:sqlite'`
 * bị Vite cố resolve như module thường → lỗi "Failed to load url sqlite".
 * Dùng `createRequire` (node:module — builtin cũ, Vite biết) để require trực
 * tiếp qua runtime Node; hoạt động cả trên Vitest lẫn tsx CLI.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

export { DatabaseSync };