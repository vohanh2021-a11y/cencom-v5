/**
 * lib/api.ts — Shared Api factory for WEB + MCP
 *
 * buildApi(actor) returns Api{db, auth:{current()}, perm} exactly
 * as app/api/rpc/route.ts used to build inline.
 *
 * Used by: route.ts (web), mcp-server/index.ts (MCP stdio).
 */
import { db } from './db';
import { can } from './perm';
import type { Api, Actor } from './types';

/**
 * Build the Api context object consumed by every RPC handler.
 * @param actor  Current user (null if unauthenticated — only for OPEN fns).
 */
export function buildApi(actor: Actor | null): Api {
  return {
    db,
    auth: { current: () => actor },
    perm: { can: (d: any, r: string, m: string, f: string) => can(d, r, m, f) },
  };
}
