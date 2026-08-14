/**
 * index.ts — Export công khai của @cencom/db (GĐ1: seed, migrator, scrypt, types).
 */
export { seedAll } from './seed.js';
export { migrateSqliteToPg } from './migrator.js';
export { hashPassword, verifyPassword, DEFAULT_PASSWORD } from './scrypt.js';
export type { SqlClient } from './types.js';