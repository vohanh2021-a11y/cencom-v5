/**
 * tests/conformance/mcp_resources.test.ts — TM7: MCP Resources + Prompts
 *
 * Spawn MCP stdio server (same pattern as mcp.test.ts) với actor giamdoc và verify:
 *  - listResources(): hoạt động, mọi resource uri thuộc dạng sc:// | xe:// (listCallback)
 *  - listResourceTemplates(): có template `sc://{sc_id}` và `xe://{xe_id}`
 *  - readResource('sc://<sc_id thật>'): contents[0].mimeType=application/json,
 *    text parse ra JSON hợp lệ chứa { hoSo, sc }
 *  - readResource('sc://SC-KHONG-TON-TAI'): error-path → text chứa {"error":...}
 *  - readResource('xe://<xe_id thật>'): JSON chứa id xe
 *  - listPrompts(): có prompt `ho-so-sc-chuan-qc206` + getPrompt trả message text QC206
 *
 * GHI CHÚ schema: spec cũ (v3.6 SQLite) dùng bảng `sua_chua`; schema PG v5 dùng
 * bảng `sc` (xem db/schema.sql) → query "sc_id thật" là SELECT id FROM sc.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { db } from '../../lib/db';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const MCP_SERVER_SCRIPT = 'mcp-server/index.ts';

type ResolvedResource = { uri: string; name?: string; mimeType?: string; text?: string };

let client: Client;
let testScId = 'SC-000001';
let testXeId = 'VEH-000001';
let scFromDb = false;
let xeFromDb = false;

beforeAll(async () => {
  // 1. Lấy id THẬT từ DB đã seed (fallback id mặc định nếu bảng trống)
  try {
    const scRes = await db.query("SELECT id FROM sc WHERE deleted_at = '' ORDER BY id LIMIT 1");
    if (scRes.rows.length > 0) {
      testScId = scRes.rows[0].id;
      scFromDb = true;
    }
  } catch {
    /* giữ fallback SC-000001 */
  }
  try {
    const xeRes = await db.query("SELECT id FROM xe WHERE deleted_at = '' ORDER BY id LIMIT 1");
    if (xeRes.rows.length > 0) {
      testXeId = xeRes.rows[0].id;
      xeFromDb = true;
    }
  } catch {
    /* giữ fallback XE-000001 */
  }

  // 2. Spawn MCP server (giamdoc read-only — cùng pattern mcp.test.ts)
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', MCP_SERVER_SCRIPT],
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      MCP_USER: 'giamdoc',
      MCP_PASS: 'cencom@123',
      MCP_ROLE: 'giamdoc',
      MCP_WRITE_TOOLS: '',
    },
  });

  client = new Client({ name: 'test-resources', version: '1.0.0' });
  await client.connect(transport);
  await new Promise((r) => setTimeout(r, 1000));
}, 90000);

afterAll(async () => {
  if (client) {
    await client.close();
  }
}, 30000);

describe('MCP resources & prompts (TM7)', () => {
  test('list-resources: trả về danh sách hợp lệ (sc:// + xe:// instances)', async () => {
    const { resources } = await client.listResources();
    expect(Array.isArray(resources)).toBe(true);
    for (const r of resources) {
      expect(/^(sc|xe):\/\//.test(r.uri)).toBe(true);
    }
    // DB seed có dữ liệu → phải liệt kê được ít nhất một sc://
    if (scFromDb) {
      expect(resources.some((r) => r.uri.startsWith('sc://'))).toBe(true);
    }
  });

  test('list-resource-templates: chứa sc://{sc_id} và xe://{xe_id}', async () => {
    const { resourceTemplates } = await client.listResourceTemplates();
    const uris = resourceTemplates.map((t) => t.uriTemplate);
    expect(uris).toContain('sc://{sc_id}');
    expect(uris).toContain('xe://{xe_id}');
  });

  test('read-resource-sc: text JSON hợp lệ chứa hoSo + sc', async () => {
    const res = await client.readResource({ uri: `sc://${testScId}` });
    expect(res.contents.length).toBeGreaterThanOrEqual(1);
    const first = res.contents[0] as ResolvedResource;
    expect(first.uri).toContain(`sc://`);
    expect(first.mimeType).toBe('application/json');
    expect(typeof first.text).toBe('string');
    const parsed = JSON.parse(first.text as string);
    expect(typeof parsed).toBe('object');
    if (scFromDb) {
      expect(parsed.hoSo).toBeDefined();
      expect(parsed.sc).toBeDefined();
      expect(parsed.sc.id).toBe(testScId);
      // checkHoSo trả struktur 8 bước QC206
      expect(Array.isArray(parsed.hoSo.steps)).toBe(true);
    } else {
      // Fallback id không tồn tại → hoặc hoSo rỗng hoặc error có chủ đích
      expect(parsed.hoSo !== undefined || parsed.error !== undefined).toBe(true);
    }
  });

  test('read-resource-sc-error-path: sc không tồn tại → {"error":...}', async () => {
    const res = await client.readResource({ uri: 'sc://SC-KHONG-TON-TAI' });
    const first = res.contents[0] as ResolvedResource;
    const parsed = JSON.parse(first.text as string);
    expect(typeof parsed.error).toBe('string');
    expect(parsed.error.length).toBeGreaterThan(0);
  });

  test('read-resource-xe: JSON chứa id xe đúng request', async () => {
    const res = await client.readResource({ uri: `xe://${testXeId}` });
    const first = res.contents[0] as ResolvedResource;
    expect(first.mimeType).toBe('application/json');
    const parsed = JSON.parse(first.text as string);
    if (xeFromDb) {
      expect(parsed.id).toBe(testXeId);
    } else {
      expect(parsed.error !== undefined || parsed === null).toBeTruthy();
    }
  });

  test('list-prompts: chứa ho-so-sc-chuan-qc206 và getPrompt trả text đối chiếu 8 bước', async () => {
    const { prompts } = await client.listPrompts();
    const names = prompts.map((p) => p.name);
    expect(names).toContain('ho-so-sc-chuan-qc206');

    const got = await client.getPrompt({ name: 'ho-so-sc-chuan-qc206', arguments: {} });
    expect(got.messages.length).toBe(1);
    const msg = got.messages[0];
    expect(msg.role).toBe('user');
    expect(msg.content.type).toBe('text');
    const text = (msg.content as { type: 'text'; text: string }).text;
    expect(text).toContain('hoSoCheck');
    expect(text).toContain('QC206');
    expect(text).toContain('Thanh lý');
  });
});
