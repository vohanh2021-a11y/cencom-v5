/**
 * mcp-server/resources.ts — MCP Resources + Prompts (TM7 / PLAN M2)
 *
 * Đăng ký:
 *   - Resource template `sc://{sc_id}` — hồ sơ SC (8 bước QC206) = checkHoSo + scGet
 *   - Resource template `xe://{xe_id}` — thông tin xe = xeGet
 *   - Resource template `dm://{dm_id}` — đề nghị mua DM (W2.7) = dmDetail
 *   - Resource template `kho://tai-san/{xe_id}` — GTTV tài sản xe (W2.7) = assetXe
 *   - Prompt `ho-so-sc-chuan-qc206` — hướng dẫn đối chiếu 8 bước QC206
 *   - Prompt `quy-trinh-mua-sam` — hướng dẫn chuỗi SC → DM → duyệt → nhập (W2.7)
 *
 * NGUYÊN TẮC:
 *   - KHÔNG tự viết SQL nghiệp vụ — gọi NGUYỆN core handlers (checkHoSo/scGet/xeGet)
 *     để RBAC (perm.can) vẫn là trọng tài cuối cùng, đồng nhất với tools.
 *   - Lỗi (403 / không tồn tại) → return contents dạng {"error":"..."} thay vì
 *     ném trần ra SDK (client nhận JSON đọc được, server không crash).
 *   - listCallback đọc DB qua api.db (pg Pool) với parameterized query; lỗi DB
 *     → trả danh sách rỗng (enumerate không bao giờ làm sập read path).
 *
 * Được gọi từ mcp-server/index.ts TRƯỚC server.connect().
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Api } from '../lib/types';
import { checkHoSo } from '../lib/core/ho_so';
import { scGet } from '../lib/core/sc';
import { xeGet } from '../lib/core/xe';
import { dmDetail } from '../lib/core/kho';
import { assetXe } from '../lib/core/asset';

/** Chữ ký trả về thống nhất cho mọi resource read error. */
function errorContents(uri: URL, err: unknown): {
  contents: Array<{ uri: string; mimeType: string; text: string }>;
} {
  const message = err instanceof Error ? err.message : String(err);
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify({ error: message }),
      },
    ],
  };
}

/** Lấy biến từ URI-template (giá trị có thể là string | string[]). */
function varToString(v: string | string[] | undefined, fallback: string): string {
  if (Array.isArray(v)) return String(v[0] ?? fallback);
  if (typeof v === 'string' && v.length > 0) return v;
  return fallback;
}

/**
 * Đăng ký resource templates `sc://{sc_id}` và `xe://{xe_id}`.
 */
export async function registerResources(server: McpServer, api: Api): Promise<void> {
  // ─── sc://{sc_id} — Hồ sơ sửa chữa SC (8 bước QC206) ──────────────────
  server.resource(
    'sc',
    new ResourceTemplate('sc://{sc_id}', {
      // Liệt kê instance thật (tối đa 20 SC gần nhất) để listResources()
      // trả về resource cụ thể, không chỉ template.
      list: async () => {
        try {
          const r = await api.db.query(
            "SELECT id FROM sc WHERE deleted_at = '' ORDER BY id DESC LIMIT 20",
          );
          return {
            resources: r.rows.map((row: { id: string }) => ({
              uri: `sc://${row.id}`,
              name: `sc://${row.id}`,
              mimeType: 'application/json',
            })),
          };
        } catch {
          return { resources: [] };
        }
      },
    }),
    {
      title: 'Hồ sơ SC',
      description: 'Hồ sơ sửa chữa SC (8 bước QC206)',
    },
    async (uri, variables) => {
      const scId = varToString(variables.sc_id, decodeURIComponent(uri.hostname));
      try {
        // Hai nguồn dữ liệu ĐỘC LẬP nhau → Promise.all là hợp lệ (async quy tắc 3a).
        const [hoSo, sc] = await Promise.all([
          checkHoSo(api, scId), // throw '403' | 'Thiếu sc_id'
          scGet(api, scId), // throw '403' | 'Không tìm thấy phiếu sửa chữa'
        ]);
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify({ hoSo, sc }, null, 2),
            },
          ],
        };
      } catch (err) {
        return errorContents(uri, err);
      }
    },
  );

  // ─── xe://{xe_id} — Thông tin xe đầu kéo ───────────────────────────────
  server.resource(
    'xe',
    new ResourceTemplate('xe://{xe_id}', {
      list: async () => {
        try {
          const r = await api.db.query(
            "SELECT id FROM xe WHERE deleted_at = '' ORDER BY id DESC LIMIT 20",
          );
          return {
            resources: r.rows.map((row: { id: string }) => ({
              uri: `xe://${row.id}`,
              name: `xe://${row.id}`,
              mimeType: 'application/json',
            })),
          };
        } catch {
          return { resources: [] };
        }
      },
    }),
    {
      title: 'Xe',
      description: 'Thông tin xe đầu kéo (XE)',
    },
    async (uri, variables) => {
      const xeId = varToString(variables.xe_id, decodeURIComponent(uri.hostname));
      try {
        const xe = await xeGet(api, xeId); // throw 'Không đủ quyền'
        if (xe == null) {
          return {
            contents: [
              {
                uri: uri.href,
                mimeType: 'application/json',
                text: JSON.stringify({ error: 'Không tìm thấy xe' }),
              },
            ],
          };
        }
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(xe, null, 2),
            },
          ],
        };
      } catch (err) {
        return errorContents(uri, err);
      }
    },
  );

  // ─── dm://{dm_id} — Đề nghị mua DM (W2.7, nợ từ W1.8: chuỗi mua sắm) ─────
  // Đọc qua core dmDetail (envelope {ok,dm,items} / {ok:false,error}) — KHÔNG
  // throw trần: dmDetail tự trả lỗi dạng envelope → map về errorContents để
  // client luôn nhận JSON đọc được (nhất quán hành vi sc://{sc_id}).
  server.resource(
    'dm-ho-so',
    new ResourceTemplate('dm://{dm_id}', {
      // Liệt kê tối đa 20 DM CHƯA KHÉP (còn chờ duyệt hoặc đã duyệt chờ nhập),
      // ưu tiên 'cho_duyet' trước rồi theo ngày tạo mới nhất (đọc qua api.db
      // parameterized — cùng pattern listCallback sc/xe).
      list: async () => {
        try {
          const r = await api.db.query(
            "SELECT id FROM dm WHERE deleted_at = '' AND trang_thai IN ('cho_duyet','da_duyet') " +
              'ORDER BY CASE WHEN trang_thai = $1 THEN 0 ELSE 1 END, ngay_tao DESC NULLS LAST, id DESC LIMIT 20',
            ['cho_duyet'],
          );
          return {
            resources: r.rows.map((row: { id: string }) => ({
              uri: `dm://${row.id}`,
              name: `dm://${row.id}`,
              mimeType: 'application/json',
            })),
          };
        } catch {
          return { resources: [] };
        }
      },
    }),
    {
      title: 'Đề nghị mua',
      description: 'Đề nghị mua DM (dòng, trạng thái, duyệt)',
    },
    async (uri, variables) => {
      // Template 1-segment authority → fallback hostname đúng như sc/xe.
      const dmId = varToString(variables.dm_id, decodeURIComponent(uri.hostname));
      try {
        const res = await dmDetail(api, { id: dmId });
        if (!res.ok) {
          return errorContents(uri, new Error(res.error ?? 'Không thấy đề nghị.'));
        }
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify({ dm: res.dm, items: res.items }, null, 2),
            },
          ],
        };
      } catch (err) {
        return errorContents(uri, err);
      }
    },
  );

  // ─── kho://tai-san/{xe_id} — GTTV tài sản xe (W2.7) ──────────────────────
  // Đọc qua core assetXe (envelope {ok,result} / {ok:false,error:'404'|'500'}).
  // result = {xe_id, bien_so, nguyen_gia, khau_hao_luy_ke, chi_phi_tich_luy,
  //           so_lan_sua, gttv} — port v3.6 asset.js, clamp gttv ≥ 0 (W1.6e).
  server.resource(
    'xe-gttv',
    new ResourceTemplate('kho://tai-san/{xe_id}', {
      // Top 20 xe ĐANG HOẠT ĐỘNG (cùng bộ lọc "xe hoạt động" với assetReport:
      // deleted_at='' AND is_test=0) — name kèm biến_so để client không cần đọc.
      list: async () => {
        try {
          const r = await api.db.query(
            "SELECT id, bien_so FROM xe WHERE deleted_at = '' AND is_test = 0 ORDER BY id DESC LIMIT 20",
          );
          return {
            resources: r.rows.map((row: { id: string; bien_so: string }) => ({
              uri: `kho://tai-san/${row.id}`,
              name: `xe-gttv ${row.bien_so}`,
              mimeType: 'application/json',
            })),
          };
        } catch {
          return { resources: [] };
        }
      },
    }),
    {
      title: 'GTVT xe',
      description: 'GTTV: nguyên giá, khấu hao, chi phí tích lũy, còn lại',
    },
    async (uri, variables) => {
      // Template 2-segment: hostname='tai-san' là hằng số → biến nằm ở PATH.
      // Fallback parse thủ công path sau '/tai-san/' (decode an toàn).
      const Xe_ID_PREFIX = '/tai-san/';
      const pathVar = decodeURIComponent(uri.pathname ?? '');
      const idx = pathVar.indexOf(Xe_ID_PREFIX);
      const fallback = idx >= 0 ? pathVar.slice(idx + Xe_ID_PREFIX.length) : '';
      const xeId = varToString(variables.xe_id, fallback || decodeURIComponent(uri.hostname));
      try {
        // assetXe KHÔNG ném — envelope; map {ok:false} → errorContents.
        const res = await assetXe(api, { id: xeId });
        if (!res.ok) {
          return errorContents(uri, new Error(res.error ?? 'Không tìm thấy xe'));
        }
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: 'application/json',
              text: JSON.stringify(res.result, null, 2),
            },
          ],
        };
      } catch (err) {
        return errorContents(uri, err);
      }
    },
  );
}

/**
 * Đăng ký prompt `ho-so-sc-chuan-qc206` — hướng dẫn kiểm tra hồ sơ chuẩn QC206.
 * Prompt zero-arg: client getPrompt() rồi tự ghép sc_id vào lượt hội thoại.
 */
export async function registerPrompts(server: McpServer): Promise<void> {
  server.prompt(
    'ho-so-sc-chuan-qc206',
    'Hướng dẫn kiểm tra hồ sơ SC chuẩn 8 bước QC206',
    () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text:
              'Hãy gọi tool hoSoCheck với sc_id tương ứng, sau đó đối chiếu 8 bước ' +
              'QC206: (1)Tiếp nhận (2)Chẩn đoán (3)Kế hoạch (4)Kiểm tử (5)Thực hiện ' +
              '(6)Kiểm tra (7)Nghiệm thu (8)Thanh lý. Báo bước nào thiếu.',
          },
        },
      ],
    }),
  );

  // ─── quy-trinh-mua-sam (W2.7, nợ từ W1.8) ───────────────────────────────
  // Chuỗi mua sắm port v3.6 kho.js: dmFromSC → dmDecide → dmNhap, khép bằng
  // autoXuatSC khi đủ cầu. Nằm ở bước 3–4–5 của QC206 (Kế hoạch/Thực hiện).
  // Prompt zero-arg — client tự ghép sc_id vào lượt hội thoại (như QC206).
  server.prompt(
    'quy-trinh-mua-sam',
    'Hướng dẫn quy trình mua sắm vật tư cho SC: dmFromSC → dmDecide (ngưỡng) → dmNhap → autoXuatSC',
    () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text:
              'Bạn là trợ lý quản lý kho — hãy HỎI sếp (người dùng) sc_id cần mua vật tư, ' +
              'rồi thực hiện ĐÚNG chuỗi mua sắm sau (tương ứng các bước 3–4–5 trong ' +
              '8 bước QC206: (1)Tiếp nhận (2)Chẩn đoán (3)Kế hoạch — mua sắm nằm ở đây ' +
              '(4)Kiểm tử (5)Thực hiện (6)Kiểm tra (7)Nghiệm thu (8)Thanh lý):\n' +
              '1. Kiểm tra nhu cầu: gọi tool scGet rồi vattuList/tonKho để xem vật tư ' +
              'còn thiếu (tt = can_mua) của phiếu.\n' +
              '2. BƯỚC 3 (Kế hoạch): gọi dmFromSC với sc_id — hệ thống GOM toàn bộ ' +
              'dòng sc_vattu can_mua theo từng vật tư (SUM số lượng, đơn giá lấy giá ' +
              'đề xuất dòng đầu, fallback giá vật tư) và LẬP ĐỀ NGHỊ MUA DM mới ở ' +
              'trạng thái cho_duyet. Nếu báo "đã có đề nghị mua đang mở" thì đọc dm://' +
              'DM đó để sếp xem, KHÔNG tạo trùng.\n' +
              '3. Trình sếp: đọc resource dm://<dm_id> để báo danh sách dòng, tổng tiền; ' +
              'chờ sếp quyết định.\n' +
              '4. BƯỚC duyệt: gọi dmDecide (id + quyet = "duyet" hoặc "tu_choi"). ' +
              'QUYỀN DUYỆT THEO NGƯỠNG: admin/giamdoc duyệt vô hạn; kế toán chỉ duyệt ' +
              'khi tổng tiền ≤ ngưỡng cấu hình `duyet_mua_nguong` (mặc định 5.000.000đ) — ' +
              'vượt ngưỡng hệ thống trả lỗi "cần Giám đốc". Từ chối PHẢI kèm ly_do.\n' +
              '5. BƯỚC 4–5 (Kiểm tử / Thực hiện): SAU KHI DM đã da_duyet, kiểm kê hàng ' +
              'về rồi gọi dmNhap (dm_id) để nhập toàn bộ dòng DM vào kho — dmNhap chỉ ' +
              'hợp lệ trên đề nghị đã duyệt (gate nghiệp vụ: duyet trước, nhap sau).\n' +
              '6. Khép cầu: gọi autoXuatSC (sc_id) — khi MỌI dòng nhu cầu của SC đã được ' +
              'nhập đủ, hệ thống TỰ sinh một phiếu xuất nhóm trừ tồn và chuyển ' +
              'sc_vattu → da_xuat; chưa đủ thì trả phieu_id = null (chờ đợt nhập sau).\n' +
              '7. Xác nhận: đọc lại resource sc://<sc_id> để đối chiếu 8 bước QC206, ' +
              'báo sếp trạng thái cuối.\n' +
              'LUÔN báo cáo bằng tiếng Việt, không tự ý duyệt thay sếp, không nhập ' +
              'kho khi đề nghị chưa da_duyet.',
          },
        },
      ],
    }),
  );
}
