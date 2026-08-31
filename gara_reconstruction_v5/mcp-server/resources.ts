/**
 * mcp-server/resources.ts — MCP Resources + Prompts (TM7 / PLAN M2)
 *
 * Đăng ký:
 *   - Resource template `sc://{sc_id}` — hồ sơ SC (8 bước QC206) = checkHoSo + scGet
 *   - Resource template `xe://{xe_id}` — thông tin xe = xeGet
 *   - Prompt `ho-so-sc-chuan-qc206` — hướng dẫn đối chiếu 8 bước QC206
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
}
