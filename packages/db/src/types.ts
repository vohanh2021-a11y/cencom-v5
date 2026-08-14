/**
 * types.ts — Interface client DB tối giản để seed/migrator chạy được
 * trên cả pg (production) lẫn PGlite (test) mà không đổi code.
 */
export interface SqlClient {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[] }>;
}