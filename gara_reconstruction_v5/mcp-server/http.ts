/**
 * mcp-server/http.ts — MCP Server transport: Streamable HTTP (LAN/Onpremise) + stdio fallback
 *
 * TM8 (M2): expose the SAME 32 RPC tools as index.ts over MCP Streamable HTTP so
 * AI hosts on the LAN (opencode / Cursor / Claude Desktop over network) can connect
 * to one shared gara instance without spawning a local stdio process per client.
 *
 * Contract with index.ts (DO NOT fork behaviour):
 *   - Tool name === RPC fn name; description from tool-docs.ts; inputSchema from
 *     lib/contracts.getToolInputSchema(fn); WRITE tools gated by MCP_WRITE_TOOLS.
 *   - NO resources / prompts registered here — those belong to index.ts (other worker).
 *   - Auth (bearer at the HTTP edge) + RBAC/audit are layered exactly like stdio:
 *     HTTP Bearer guards the socket, core `can()` stays the final referee per call.
 *
 * Transport mode:
 *   - MCP_TRANSPORT=http  → Streamable HTTP server on MCP_HTTP_HOST:MCP_HTTP_PORT
 *                           (default 0.0.0.0:3001). Requires Authorization:
 *                           Bearer <MCP_API_KEY> on EVERY request; if MCP_API_KEY is
 *                           unset the server fail-closes with 401 on all traffic.
 *                           Stateful sessions (MCP-Session-Id), JSON response mode.
 *   - otherwise / stdio   → StdioServerTransport, identical to index.ts.
 *
 * Chạy:  MCP_TRANSPORT=http MCP_API_KEY=xxx npx tsx mcp-server/http.ts
 * Docker: see Onpremise/docker-compose.mcp.yml + Onpremise/nginx/mcp.conf
 */

// ─── CRITICAL: env MUST be imported BEFORE anything that touches process.env ───
// lib/db.ts reads process.env.DATABASE_URL at import time.
import './env';

import fs from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer as createHttpServer } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { getRegistry } from '../lib/rpc';
import { buildApi } from '../lib/api';
import { resolveActor, isWriteAllowed, auditMcpCall } from './auth';
import { TOOL_DOCS } from './tool-docs';
import { getToolInputSchema } from '../lib/contracts';

/* ──────────────────────────────────────────────────────────────
 * Constants / small helpers
 * ────────────────────────────────────────────────────────────── */

const MAX_BODY_BYTES = 8 * 1024 * 1024; // 8 MiB cap — block memory-exhaustion DoS
const MCP_ROUTE = '/mcp';

function warn(msg: string): void {
  // stderr only: never corrupt stdio JSON-RPC and keeps stdout clean in http mode
  process.stderr.write(`[mcp-http] ${msg}\n`);
}

/** Extract "Mcp-Session-Id" (lower-cased by Node) → string | undefined */
function sessionIdOf(req: IncomingMessage): string | undefined {
  const v = req.headers['mcp-session-id'];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Edge auth: `Authorization: Bearer <MCP_API_KEY>` must match env MCP_API_KEY.
 * Fail-closed: unset MCP_API_KEY ⇒ every request is 401 (HTTP mode is USELESS
 * without a key — intentionally refuse traffic rather than run open on LAN).
 * Constant-time compare to avoid timing side-channel on the bearer token.
 */
function checkAuth(req: IncomingMessage): boolean {
  const expected = process.env.MCP_API_KEY || '';
  if (!expected) return false;
  const header = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) return false;
  const got = Buffer.from(m[1], 'utf8');
  const want = Buffer.from(expected, 'utf8');
  if (got.length !== want.length) return false;
  return timingSafeEqual(got, want);
}

/** Send a JSON body with explicit status (JSON-RPC-shaped errors included). */
function sendJson(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  res.end(payload);
}

function jsonRpcError(code: number, message: string): Record<string, unknown> {
  return { jsonrpc: '2.0', id: null, error: { code, message } };
}

/** Manually read + JSON-parse the request body (no framework, size-capped). */
function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(text.length > 0 ? text : '{}'));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', (err: Error) => reject(err));
  });
}

/* ──────────────────────────────────────────────────────────────
 * Server factory — EXACT same 32-tool registration as index.ts §5.
 * A fresh McpServer instance per HTTP session (SDK requirement: one
 * Protocol state per connected transport), stdio uses a single one.
 * ────────────────────────────────────────────────────────────── */

type ToolName = string;

function createServerInstance(opts: {
  version: string;
  toolNames: ToolName[];
  actor: Awaited<ReturnType<typeof resolveActor>>;
  api: ReturnType<typeof buildApi>;
}): McpServer {
  const server = new McpServer({ name: 'cencom-gara-v5', version: opts.version });

  const reg = getRegistry();
  const { actor, api } = opts; // resolved + built ONCE in main(), shared by all sessions

  for (const fn of opts.toolNames) {
    const doc = TOOL_DOCS[fn];
    const meta = reg.META[fn];
    const perm = meta ? meta.join('.') : 'UNKNOWN';
    const mode = doc.mode;

    const description =
      `[vi] ${doc.descVi} | [en] ${doc.descEn} | perm: ${perm} | mode: ${mode}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = async (args: Record<string, unknown>): Promise<any> => {
      // WRITE guard: check MCP_WRITE_TOOLS allowlist BEFORE calling handler
      if (doc.mode === 'WRITE' && !isWriteAllowed(fn)) {
        await auditMcpCall(fn, actor, false);
        return {
          content: [{ type: 'text' as const, text: `403 write tool disabled: ${fn}` }],
          isError: true,
        };
      }

      try {
        // Call core handler directly — RBAC is enforced inside handlers
        const result = await reg.HANDLERS[fn](api, args || {});
        await auditMcpCall(fn, actor, true);
        return {
          content: [
            // Guard: JSON.stringify(undefined) returns undefined (not string),
            // which fails SDK's CallToolResultSchema validation.
            { type: 'text' as const, text: JSON.stringify(result ?? null, null, 2) },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        await auditMcpCall(fn, actor, false);
        return {
          content: [{ type: 'text' as const, text: `ERROR: ${message}` }],
          isError: true,
        };
      }
    };

    // Register with cast to bypass SDK generic depth limit (same as index.ts)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (server.registerTool as any)(
      fn,
      { title: doc.title, description, inputSchema: getToolInputSchema(fn) },
      handler,
    );
  }

  return server;
}

/* ──────────────────────────────────────────────────────────────
 * HTTP mode — Streamable HTTP with stateful session map
 * (official SDK pattern: new server+transport on initialize,
 *  route later requests by Mcp-Session-Id)
 * ────────────────────────────────────────────────────────────── */

interface ServerCtx {
  version: string;
  toolNames: ToolName[];
  actor: Awaited<ReturnType<typeof resolveActor>>;
  api: ReturnType<typeof buildApi>;
}

async function runHttpMode(ctx: ServerCtx): Promise<void> {
  const port = Number(process.env.MCP_HTTP_PORT || 3001);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`MCP_HTTP_PORT invalid: '${process.env.MCP_HTTP_PORT}'`);
  }
  const host = process.env.MCP_HTTP_HOST || '0.0.0.0';

  const transports = new Map<string, StreamableHTTPServerTransport>();

  const handleInitialize = async (
    req: IncomingMessage,
    res: ServerResponse,
    body: unknown,
  ): Promise<void> => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      // JSON responses instead of SSE: spec-legal, trivially proxyable through
      // nginx, and lets non-SDK clients (curl, probes) read replies directly.
      enableJsonResponse: true,
      onsessioninitialized: (sessionId: string) => {
        transports.set(sessionId, transport);
      },
    });
    transport.onclose = () => {
      const sid = transport.sessionId;
      if (sid && transports.get(sid) === transport) {
        transports.delete(sid);
      }
    };
    transport.onerror = (err: Error) => {
      warn(`transport error: ${err.message}`);
    };

    const server = createServerInstance(ctx);
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  };

  const handleSessionRequest = async (
    req: IncomingMessage,
    res: ServerResponse,
    body?: unknown,
  ): Promise<void> => {
    const sessionId = sessionIdOf(req);
    if (!sessionId) {
      sendJson(res, 400, jsonRpcError(-32000, 'Bad Request: missing Mcp-Session-Id header'));
      return;
    }
    const transport = transports.get(sessionId);
    if (!transport) {
      sendJson(res, 404, jsonRpcError(-32001, 'Not Found: unknown session (initialize first?)'));
      return;
    }
    await transport.handleRequest(req, res, body);
  };

  const route = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname !== MCP_ROUTE) {
      sendJson(res, 404, jsonRpcError(-32000, `Not Found: only ${MCP_ROUTE} is served`));
      return;
    }

    // ── Edge auth BEFORE touching the MCP state machine ──
    if (!checkAuth(req)) {
      const ip = req.socket.remoteAddress || '?';
      const reason = process.env.MCP_API_KEY ? 'bad/missing bearer' : 'MCP_API_KEY not configured';
      warn(`401 ${req.method} ${url.pathname} from ${ip} (${reason})`);
      sendJson(
        res,
        401,
        jsonRpcError(-32001, 'Unauthorized: valid Authorization Bearer token required'),
        { 'WWW-Authenticate': 'Bearer realm="cencom-mcp"' },
      );
      return;
    }

    switch (req.method) {
      case 'POST': {
        const body = await readJsonBody(req);
        if (isInitializeRequest(body)) {
          await handleInitialize(req, res, body);
        } else {
          await handleSessionRequest(req, res, body);
        }
        return;
      }
      case 'GET':
      case 'DELETE': {
        // GET → SSE stream / health of session; DELETE → terminate session.
        await handleSessionRequest(req, res);
        return;
      }
      default: {
        sendJson(res, 405, jsonRpcError(-32000, `Method Not Allowed: ${req.method}`), {
          Allow: 'POST, GET, DELETE',
        });
      }
    }
  };

  const httpServer = createHttpServer((req, res) => {
    // async boundary: every handler failure must still answer the socket
    route(req, res).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      warn(`request failed: ${msg}`);
      if (!res.headersSent) {
        const status = /invalid JSON|payload too large/.test(msg) ? 400 : 500;
        sendJson(res, status, jsonRpcError(-32603, `Internal error: ${msg}`));
      } else {
        res.destroy();
      }
    });
  });

  // Long-lived SSE GETs are normal in Streamable HTTP — do not let Node's
  // 5s keep-alive timeout cut idle proxy connections (nginx uses 3600s).
  httpServer.keepAliveTimeout = 65_000;
  httpServer.headersTimeout = 70_000;

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, host, () => resolve());
  });

  const keyState = process.env.MCP_API_KEY ? 'bearer auth ON' : 'NO MCP_API_KEY — ALL TRAFFIC 401';
  warn(`MCP http mode on :${port} (${MCP_ROUTE}, ${keyState}, ${ctx.toolNames.length} tools)`);
  // Banner required by TM8 spec, exact-ish phrasing:
  process.stderr.write(`MCP http mode on :${port} (endpoint ${MCP_ROUTE})\n`);

  // Graceful shutdown: close sessions then stop listening.
  const shutdown = (sig: string) => {
    warn(`signal ${sig} — closing ${transports.size} session(s)`);
    for (const t of transports.values()) {
      void t.close().catch((e: unknown) => warn(`transport close error: ${e}`));
    }
    httpServer.close(() => process.exit(0));
    // Hard exit if sockets refuse to drain
    setTimeout(() => process.exit(0), 3_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

/* ──────────────────────────────────────────────────────────────
 * Main
 * ────────────────────────────────────────────────────────────── */

async function main(): Promise<void> {
  // ─── 1. Version ─────────────────────────────────────────────
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'),
  ) as { version: string };
  const VERSION: string = pkg.version;

  // ─── 2. Auth + Registry (fail fast before binding a port) ───
  const actor = await resolveActor();
  const api = buildApi(actor);

  // ─── 3. Tool list: FN_LIST \ OPEN, docs-complete (same gate as index.ts) ───
  const reg = getRegistry();
  const toolNames = reg.FN_LIST.filter((fn: string) => !reg.OPEN.has(fn));
  for (const fn of toolNames) {
    if (!TOOL_DOCS[fn]) {
      throw new Error(
        `[MCP BOOT] Missing TOOL_DOCS entry for "${fn}". ` +
          `Add description to mcp-server/tool-docs.ts before starting.`,
      );
    }
  }

  // ─── 4. Transport selection ─────────────────────────────────
  const transportKind = (process.env.MCP_TRANSPORT || 'stdio').toLowerCase();
  const ctx: ServerCtx = { version: VERSION, toolNames, actor, api };

  if (transportKind === 'http') {
    await runHttpMode(ctx);
    return; // keep process alive via the HTTP server
  }

  // stdio fallback — identical to index.ts behaviour
  const server = createServerInstance(ctx);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  warn(
    `MCP cencom-gara-v5 v${VERSION} ready, stdio mode (${toolNames.length} tools, ` +
      `actor=${actor.name} role=${actor.role} write=${process.env.MCP_WRITE_TOOLS || ''})`,
  );
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  warn(`FATAL: ${msg}`);
  console.error('MCP fatal:', msg);
  process.exit(1);
});

// Final safety net per global AGENTS.md chuan 3a: never let an async error
// vanish silently on a long-running server process.
process.on('unhandledRejection', (reason: unknown) => {
  const msg = reason instanceof Error ? reason.stack || reason.message : String(reason);
  warn(`unhandledRejection: ${msg}`);
});
