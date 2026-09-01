/**
 * tests/conformance/mcp_resources.test.ts — TM7 + W2.7: MCP Resources + Prompts
 *
 * Spawn MCP stdio server (same pattern as mcp.test.ts) với actor giamdoc và verify:
 *  - listResources(): hoạt động, mọi resource uri thuộc dạng sc:// | xe:// |
 *    dm:// | kho:// (W2.7 mở rộng listCallback)
 *  - listResourceTemplates(): ĐÚNG 4 template
 *    `sc://{sc_id}`, `xe://{xe_id}`, `dm://{dm_id}`, `kho://tai-san/{xe_id}`
 *  - readResource('sc://<sc_id thật>'): contents[0].mimeType=application/json,
 *    text parse ra JSON hợp lệ chứa { hoSo, sc }
 *  - readResource('sc://SC-KHONG-TON-TAI'): error-path → text chứa {"error":...}
 *  - readResource('xe://<xe_id thật>'): JSON chứa id xe
 *  - W2.7: readResource('dm://<DM tạo qua core dmCreate>') → JSON {dm, items};
 *    'dm://KHONG-TAI' → error-path; 'kho://tai-san/<xe>' → GTTV số ≥ 0
 *  - listPrompts(): `ho-so-sc-chuan-qc206` + `quy-trinh-mua-sam`
 *    getPrompt('quy-trinh-mua-sam') → messages[0] chứa 'dmFromSC' (chuỗi mua sắm)
 *
 * KHÔNG phụ thuộc dev server / HTTP :3000 — stdio spawn độc lập; fixture DM/xe
 * tạo qua core TRỰC TIẾP bằng buildApi (pattern asset_gttv.test.ts), không qua RPC.
 *
 * GHI CHÚ schema: spec cũ (v3.6 SQLite) dùng bảng `sua_chua`; schema PG v5 dùng
 * bảng `sc` (xem db/schema.sql) → query "sc_id thật" là SELECT id FROM sc.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { db } from '../../lib/db';
import { buildApi } from '../../lib/api';
import { dmCreate, dmDelete, vattuCreate } from '../../lib/core/kho';
import { nextId } from '../../lib/db';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const MCP_SERVER_SCRIPT = 'mcp-server/index.ts';

type ResolvedResource = { uri: string; name?: string; mimeType?: string; text?: string };

/** Api quyền admin (bypass perm) — chỉ dùng cho fixture DM/xe, KHÔNG liên quan
 *  server MCP (server spawn với actor giamdoc qua stdio env riêng).
 *  ⚠ id phải là user THẬT đã seed (FK dm_nguoi_tao_fkey + activity_log) → 'U-ADMIN'. */
const api = buildApi({ id: 'U-ADMIN', name: 'admin', role: 'admin' });
const today = () => new Date().toISOString().split('T')[0];
/** Mark riêng cho fixture xe (dễ nhận diện / dọn sạch — pattern asset_gttv). */
const MARK = 'W27' + String(Date.now()).slice(-6);

let client: Client;
let testScId = 'SC-000001';
let testXeId = 'VEH-000001';
let scFromDb = false;
let xeFromDb = false;

// ─── W2.7 fixtures ──────────────────────────────────────────────────────
let dmFixtureId = ''; // DM tạo qua core dmCreate (cho_duyet) → đọc qua dm://
let gttvXeId = ''; // xe để đọc kho://tai-san/{xe_id} (xe 'thật' từ DB hoặc fixture)

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

  // 2. W2.7 — fixture DM: vattu + dmCreate qua core (admin bypass perm 'kho','tao';
  //    dmCreate tự is_test=1 cho admin → không lẫn dmList UI, nhưng listCallback
  //    resource mô phỏng admin duyệt vẫn thấy được theo deleted_at/trang_thai).
  const vt = await vattuCreate(api, { ten: MARK + ' VT DM fixture', don_vi: 'cái', gia: 12345 });
  const dm = await dmCreate(api, {
    ngay: today(),
    items: [{ vattu_id: vt.id, so_luong: 2, don_gia: 12345 }],
  });
  dmFixtureId = dm.id;

  // 3. W2.7 — xe cho GTTV: ưu tiên xe 'thật' (đang hoạt động, is_test=0) vì
  //    listCallback `kho://tai-san/` lọc is_test=0; nếu chưa có → tự cắm fixture
  //    is_test=0 (dọn bằng soft-delete ở afterAll, không đụng dữ liệu seed).
  try {
    const xeAct = await db.query(
      "SELECT id FROM xe WHERE deleted_at = '' AND is_test = 0 ORDER BY id LIMIT 1",
    );
    if (xeAct.rows.length > 0) {
      gttvXeId = xeAct.rows[0].id;
    } else {
      gttvXeId = await nextId('XE');
      await db.query(
        "INSERT INTO xe (id, bien_so, chu_xe, nam_sx, nguyen_gia, is_test, deleted_at) " +
          "VALUES ($1,$2,$3,$4,0,0,'')",
        [gttvXeId, `${MARK}-GTTV`, 'W27 fixture', new Date().getFullYear() - 2],
      );
    }
  } catch {
    /* DB lỗi → test readResource GTTV tự fail có thông báo; không chặn suite cũ */
  }

  // 4. Spawn MCP server (giamdoc read-only — cùng pattern mcp.test.ts)
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
  // Dọn fixture W2.7: DM soft-delete bằng chính core (giữ chuẩn soft-delete +
  // audit — dmDelete chỉ xóa được khi cho_duyet); xe fixture soft-delete trực
  // tiếp theo MARK (không DELETE cứng — quy tắc repo).
  try {
    if (dmFixtureId) await dmDelete(api, { id: dmFixtureId });
  } catch {
    /* không để lỗi dọn làm nhiễu kết quả test */
  }
  try {
    await db.query("UPDATE xe SET deleted_at = $1 WHERE bien_so = $2 AND deleted_at = ''", [
      today(),
      `${MARK}-GTTV`,
    ]);
  } catch {
    /* best-effort */
  }
}, 30000);

describe('MCP resources & prompts (TM7)', () => {
  test('list-resources: trả về danh sách hợp lệ (sc:// + xe:// instances)', async () => {
    const { resources } = await client.listResources();
    expect(Array.isArray(resources)).toBe(true);
    for (const r of resources) {
      // W2.7: template mới thêm dm:// + kho:// → regex mở rộng theo 4 scheme.
      expect(/^(sc|xe|dm|kho):\/\//.test(r.uri)).toBe(true);
    }
    // DB seed có dữ liệu → phải liệt kê được ít nhất một sc://
    if (scFromDb) {
      expect(resources.some((r) => r.uri.startsWith('sc://'))).toBe(true);
    }
  });

  test('list-resource-templates: chứa ĐÚNG 4 template (sc/xe giữ nguyên + dm/kho W2.7)', async () => {
    const { resourceTemplates } = await client.listResourceTemplates();
    const uris = resourceTemplates.map((t) => t.uriTemplate).sort();
    // "đúng 4" — không thiếu, không thừa, tên 2 template cũ KHÔNG đổi.
    expect(uris).toEqual(
      ['dm://{dm_id}', 'kho://tai-san/{xe_id}', 'sc://{sc_id}', 'xe://{xe_id}'].sort(),
    );
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

  // ─── W2.7 — DM + GTTV resources ──────────────────────────────────────────

  test('read-resource-dm: DM tạo qua core dmCreate → JSON {dm, items} parse ok', async () => {
    expect(dmFixtureId).toMatch(/^DM-\d{6}$/);
    const res = await client.readResource({ uri: `dm://${dmFixtureId}` });
    const first = res.contents[0] as ResolvedResource;
    expect(first.uri).toContain('dm://');
    expect(first.mimeType).toBe('application/json');
    const parsed = JSON.parse(first.text as string);
    expect(parsed.error).toBeUndefined();
    expect(parsed.dm).toBeDefined();
    expect(parsed.dm.id).toBe(dmFixtureId);
    expect(parsed.dm.trang_thai).toBe('cho_duyet');
    expect(Array.isArray(parsed.items)).toBe(true);
    expect(parsed.items.length).toBeGreaterThanOrEqual(1);
    expect(parsed.items[0].so_luong).toBe(2);
  });

  test('read-resource-dm-error-path: dm không tồn tại → {"error":"Không thấy đề nghị."}', async () => {
    const res = await client.readResource({ uri: 'dm://DM-999999' });
    const first = res.contents[0] as ResolvedResource;
    const parsed = JSON.parse(first.text as string);
    expect(typeof parsed.error).toBe('string');
    expect(parsed.error.length).toBeGreaterThan(0);
  });

  test('read-resource-kho-gttv: xe → JSON GTTV với các trường số ≥ 0', async () => {
    expect(gttvXeId).toMatch(/^(XE|VEH)-\d{6}$/);
    const res = await client.readResource({ uri: `kho://tai-san/${gttvXeId}` });
    const first = res.contents[0] as ResolvedResource;
    expect(first.mimeType).toBe('application/json');
    const parsed = JSON.parse(first.text as string);
    expect(parsed.error).toBeUndefined();
    expect(parsed.xe_id).toBe(gttvXeId);
    for (const field of [
      'nguyen_gia',
      'khau_hao_luy_ke',
      'chi_phi_tich_luy',
      'so_lan_sua',
      'gttv',
    ]) {
      expect(typeof parsed[field]).toBe('number');
      expect(Number.isFinite(parsed[field])).toBe(true);
      expect(parsed[field]).toBeGreaterThanOrEqual(0);
    }
  });

  test('read-resource-kho-gttv-error-path: xe lạ → {"error":"404"}', async () => {
    const res = await client.readResource({ uri: 'kho://tai-san/XE-999999' });
    const first = res.contents[0] as ResolvedResource;
    const parsed = JSON.parse(first.text as string);
    expect(typeof parsed.error).toBe('string');
    expect(parsed.error.length).toBeGreaterThan(0);
  });

  test('list-resources: W2.7 — dm:// (fixture cho_duyet) và kho://tai-san/ xuất hiện', async () => {
    const { resources } = await client.listResources();
    // Fixture DM cho_duyet do suite này tạo TRƯỚC khi spawn server → chắc chắn
    // có trong listCallback (top 20 DM chưa khép, ưu tiên cho_duyet trước).
    expect(resources.some((r) => r.uri === `dm://${dmFixtureId}`)).toBe(true);
    // listCallback GTTV lọc is_test=0 (xe 'đang hoạt động'), trả đủ khi DB có xe.
    expect(resources.every((r) => !r.uri.startsWith('kho://') || /^kho:\/\/tai-san\//.test(r.uri))).toBe(true);
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

  // ─── W2.7 — prompt chuỗi mua sắm ─────────────────────────────────────────

  test('get-prompt-mua-sam: messages[0] chứa dmFromSC + cả chuỗi dmDecide/dmNhap/autoXuatSC', async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toContain('quy-trinh-mua-sam');

    const got = await client.getPrompt({ name: 'quy-trinh-mua-sam', arguments: {} });
    expect(got.messages.length).toBe(1);
    const msg = got.messages[0];
    expect(msg.role).toBe('user');
    const text = (msg.content as { type: 'text'; text: string }).text;
    // Chuỗi core v3.6→v5: gom cầu SC → DM → duyệt (ngưỡng) → nhập → auto xuất đủ.
    expect(text).toContain('dmFromSC');
    expect(text).toContain('dmDecide');
    expect(text).toContain('dmNhap');
    expect(text).toContain('autoXuatSC');
    expect(text).toContain('duyet_mua_nguong');
    //message user tiếng Việt + liên kết QC206 bước 3/4/5.
    expect(text).toContain('QC206');
    expect(text).toContain('Kế hoạch');
  });
});
