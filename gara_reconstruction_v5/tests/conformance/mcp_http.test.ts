/**
 * tests/conformance/mcp_http.test.ts — W1.8a: MCP HTTP mode parity with stdio
 * (điểm 3.1+3.4 docs/convergence/00_CAU_TRUC_HE_THONG.md)
 *
 * Spawn server THẬT (`node --import tsx mcp-server/http.ts`, không wrapper
 * cmd.exe → kill sạch process, port 3911 không mồ côi trên Windows) với
 * MCP_TRANSPORT=http + bearer key riêng cho test; connect bằng
 * StreamableHTTPClientTransport (SDK 1.30 — exports wildcard ./* → cjs/esm
 * streamableHttp.js đã kiểm tra tồn tại) rồi verify:
 *  - listTools() === FN_LIST \ OPEN (đúng số lượng, đúng tên — registerAll chung)
 *  - listResources() length >= 1 (seed `xe` bảo đảm; sc có khi DB đã tạo phiếu)
 *    + listResourceTemplates() chứa `sc://{sc_id}` (template luôn đăng ký)
 *  - listPrompts() chứa `ho-so-sc-chuan-qc206`
 *  - callTool('xeList') → không isError (READ path qua HTTP y như stdio)
 *  - KHÔNG bearer → POST /mcp trả 401 (edge auth fail-closed không đổi)
 *
 * Chạy riêng: npx jest tests/conformance/mcp_http.test.ts --runInBand --forceExit
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'path';
import { getRegistry } from '../../lib/rpc';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const PORT = 3911;
const MCP_URL = `http://127.0.0.1:${PORT}/mcp`;
const API_KEY = 'http-test-key-9z';

let proc: ChildProcess;
let client: Client;
let stderrTail = '';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** POST initialize-mẫu KHÔNG bearer — server trả 401 ngay khi đã lắng nghe. */
async function postNoAuth(): Promise<Response> {
  return fetch(MCP_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 0,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'probe', version: '0' },
      },
    }),
  });
}

/** Chờ port listening (mọi HTTP response = OK; conn refused = retry). */
async function waitForListening(deadlineMs = 60_000): Promise<void> {
  const t0 = Date.now();
  for (;;) {
    try {
      const res = await postNoAuth();
      if (res.status === 401) return; // bearer edge hoạt động
      throw new Error(`unexpected early response: HTTP ${res.status}`);
    } catch (err) {
      const cause = (err as { cause?: unknown }).cause;
      const msg = err instanceof Error
        ? `${err.message} ${cause instanceof Error ? cause.message : String(cause ?? '')}`
        : String(err);
      const connectionPending =
        /fetch failed|ECONNREFUSED|ECONNRESET|ECONNABORTED|socket hang up|could not connect|timed? ?out/i.test(msg);
      if (!connectionPending) throw err; // lỗi thật (không phải "chưa listening")
      if (proc && proc.exitCode !== null) {
        throw new Error(
          `MCP http server exited early (code ${proc.exitCode}). stderr:\n${stderrTail}`,
        );
      }
      if (Date.now() - t0 > deadlineMs) {
        throw new Error(
          `MCP http server did not start on :${PORT} within ${deadlineMs}ms. stderr:\n${stderrTail}`,
        );
      }
      await sleep(400);
    }
  }
}

beforeAll(async () => {
  proc = spawn(process.execPath, ['--import', 'tsx', 'mcp-server/http.ts'], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      MCP_TRANSPORT: 'http',
      MCP_HTTP_PORT: String(PORT),
      MCP_API_KEY: API_KEY,
      MCP_USER: 'giamdoc',
      MCP_PASS: 'cencom@123',
      MCP_ROLE: 'giamdoc',
      MCP_WRITE_TOOLS: '',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  proc.stderr?.on('data', (d: Buffer) => {
    stderrTail = (stderrTail + d.toString('utf8')).slice(-8000);
  });

  await waitForListening();

  client = new Client({ name: 'test-http-w18a', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${API_KEY}` } },
  });
  await client.connect(transport);
}, 120_000);

afterAll(async () => {
  try {
    if (client) await client.close(); // DELETE session cleanly (server gỡ transport)
  } catch {
    /* session đã đóng */
  }
  if (proc && proc.exitCode === null) {
    proc.kill('SIGTERM');
    const exited = await Promise.race([
      new Promise<boolean>((r) => proc.once('exit', () => r(true))),
      sleep(6_000).then(() => false),
    ]);
    if (!exited && proc.exitCode === null) proc.kill('SIGKILL');
  }
}, 30_000);

describe('MCP HTTP mode parity (W1.8a)', () => {
  test('http-tools: listTools() === FN_LIST \\ OPEN (count + names)', async () => {
    const { tools } = await client.listTools();
    const reg = getRegistry();
    const expected = reg.FN_LIST.filter((fn) => !reg.OPEN.has(fn)).sort();

    expect(tools.length).toBe(reg.FN_LIST.length - reg.OPEN.size);
    expect(tools.map((t) => t.name).sort()).toEqual(expected);
    // description đúng format gate (registerAll giữ nguyên hành vi index.ts)
    for (const t of tools.slice(0, 3)) {
      expect(t.description).toContain('[vi]');
      expect(t.description).toContain('| mode:');
    }
  });

  test('http-resources: listResources() >= 1 + template sc://{sc_id} (fix 3.1)', async () => {
    const { resources } = await client.listResources();
    expect(Array.isArray(resources)).toBe(true);
    expect(resources.length).toBeGreaterThanOrEqual(1); // seed `xe` luôn có
    for (const r of resources) {
      // W2.7: đăng ký thêm template dm://{dm_id} + kho://tai-san/{xe_id} →
      // listResources (gộp mọi listCallback) hợp lệ với 4 scheme.
      expect(/^(sc|xe|dm|kho):\/\//.test(r.uri)).toBe(true);
    }

    const { resourceTemplates } = await client.listResourceTemplates();
    const uris = resourceTemplates.map((t) => t.uriTemplate);
    expect(uris).toContain('sc://{sc_id}');
    expect(uris).toContain('xe://{xe_id}');
  });

  test('http-prompts: listPrompts() chứa ho-so-sc-chuan-qc206 (fix 3.1)', async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toContain('ho-so-sc-chuan-qc206');
  });

  test('http-callTool-read-allowed: xeList không isError', async () => {
    type McpCallResult = { content?: Array<{ type?: string; text?: string }>; isError?: boolean };
    const result = (await client.callTool({ name: 'xeList', arguments: {} })) as McpCallResult;
    expect(result.isError).not.toBe(true);
    const text = result.content?.[0]?.text;
    expect(typeof text).toBe('string');
    expect(JSON.parse(text ?? 'null')).toBeDefined();
  });

  test('http-auth-401: POST /mcp không bearer → 401 (edge auth không đổi)', async () => {
    const res = await postNoAuth();
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toContain('Bearer');
    const body = (await res.json()) as { error?: { message?: string } };
    expect(body.error?.message).toContain('Unauthorized');
  });
});
