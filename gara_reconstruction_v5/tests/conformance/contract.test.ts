/**
 * tests/conformance/contract.test.ts — Zod contract validation tests (TM6c)
 *
 * Verifies:
 *  1. zod-unit: ZodRawShape in RPC_SCHEMAS enforces required fields correctly
 *  2. mcp-integration-bad-arg: MCP server rejects bad args via Zod validation
 *  3. schema-present: every RPC key has a getToolInputSchema returning valid Zod
 */
import { RPC_SCHEMAS, getToolInputSchema } from '../../lib/contracts';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

/* ──────────────────────────────────────────────────────────────
 * 1. zod-unit — Pure Zod validation on RPC_SCHEMAS shapes
 * ────────────────────────────────────────────────────────────── */
describe('zod-unit: RPC_SCHEMAS validates required fields', () => {
  test('scCreate: missing xe_id → fail; with xe_id+ngay → pass', () => {
    const shape = RPC_SCHEMAS['scCreate'];
    expect(shape).toBeDefined();

    // xe_id is required → missing should fail
    const bad = z.object(shape).passthrough().safeParse({ mo_ta: 'x' });
    expect(bad.success).toBe(false);

    // xe_id + ngay (both required) → should pass
    const good = z.object(shape).passthrough().safeParse({ xe_id: 'XE-000001', ngay: '2026-08-31' });
    expect(good.success).toBe(true);
  });

  test('nhapKho: missing vattu_id/so_luong → fail; complete → pass', () => {
    const shape = RPC_SCHEMAS['nhapKho'];
    expect(shape).toBeDefined();

    // Missing required vattu_id, so_luong, ngay
    const bad = z.object(shape).passthrough().safeParse({ vattu_id: 'VT-1' });
    expect(bad.success).toBe(false);

    // All required fields present
    const good = z.object(shape).passthrough().safeParse({
      vattu_id: 'VT-000001',
      so_luong: 10,
      ngay: '2026-08-31',
    });
    expect(good.success).toBe(true);
  });

  test('vattuCreate: missing ten → fail; with ten → pass', () => {
    const shape = RPC_SCHEMAS['vattuCreate'];
    expect(shape).toBeDefined();

    // ten is required
    const bad = z.object(shape).passthrough().safeParse({ ma: 'VTX-1' });
    expect(bad.success).toBe(false);

    // ten provided
    const good = z.object(shape).passthrough().safeParse({ ten: 'Banh lao' });
    expect(good.success).toBe(true);
  });
});

// zod is available via the project's zod dependency
import { z } from 'zod';

/* ──────────────────────────────────────────────────────────────
 * 2. mcp-integration-bad-arg — MCP server rejects bad args
 * ────────────────────────────────────────────────────────────── */
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const MCP_SERVER_SCRIPT = 'mcp-server/index.ts';

type McpCallResult = { content?: Array<{ type?: string; text?: string }>; isError?: boolean };

describe('mcp-integration-bad-arg: MCP rejects invalid Zod input', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    // Spawn MCP server with giamdoc + scCreate in WRITE allowlist
    // so the WRITE guard passes and the Zod validation is the gatekeeper
    transport = new StdioClientTransport({
      command: 'npx',
      args: ['tsx', MCP_SERVER_SCRIPT],
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        MCP_USER: 'giamdoc',
        MCP_PASS: 'cencom@123',
        MCP_ROLE: 'giamdoc',
        MCP_WRITE_TOOLS: 'scCreate',
      },
    });

    client = new Client({ name: 'test-contract', version: '1.0.0' });
    await client.connect(transport);
    // Give server time to fully initialize
    await new Promise((r) => setTimeout(r, 1000));
  }, 60000);

  afterAll(async () => {
    if (client) {
      await client.close();
    }
  }, 30000);

  test('scCreate with bad args (missing xe_id) → isError + error mentions validation', async () => {
    const result = (await client.callTool({
      name: 'scCreate',
      arguments: { mo_ta: 'x' },  // missing xe_id (required) and ngay (required)
    })) as McpCallResult;

    expect(result.isError).toBe(true);
    const text = result.content?.[0]?.text ?? '';
    // The error should mention the missing required field(s)
    // MCP SDK Zod validation typically says something about required/xe_id
    expect(text.toLowerCase()).toMatch(/xe_id|required|invalid|validation/i);
  });
});

/* ──────────────────────────────────────────────────────────────
 * 3. schema-present — Every RPC key has getToolInputSchema()
 * ────────────────────────────────────────────────────────────── */
describe('schema-present: getToolInputSchema covers all RPC_SCHEMAS keys', () => {
  const schemaKeys = Object.keys(RPC_SCHEMAS);

  test(`RPC_SCHEMAS has ${schemaKeys.length} entries`, () => {
    expect(schemaKeys.length).toBeGreaterThan(0);
  });

  for (const fn of schemaKeys) {
    test(`getToolInputSchema('${fn}') returns Zod schema with safeParse`, () => {
      const schema = getToolInputSchema(fn);
      expect(schema).toBeDefined();
      expect(typeof schema.safeParse).toBe('function');
    });
  }
});
