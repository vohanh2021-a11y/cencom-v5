/**
 * search.ts — W4.2 · Tìm kiếm TOÀN CỤC `globalSearch` (command palette / ô search).
 *
 * Port v4 `packages/core/src/search.ts` (globalSearch GĐ-3, 4 bảng sc/xe/dm/vattu)
 * lên schema v5 (`db/schema.sql`: cột ĐỔI TÊN — v4 `phieu_sua/bks` → v5 `sc` JOIN
 * `xe.bien_so`, `de_xuat_sua_chua` → `dm`, `vattu.name` → `vattu.ten`).
 *
 * Siết theo hợp đồng W4.2 (deltas so với v4, CÓ CHỦ ĐÍCH — không đổi hành vi đọc):
 *  1) THAY `upper(...) LIKE upper-term` (v4:23-39) bằng PG `ILIKE` — case-insensitive
 *     chuẩn UTF-8 (tiếng Việt có dấu giữ nguyên, không cần upper()).
 *  2) v4 KHÔNG escape ký tự wildcard → chuỗi `%`/`_` người dùng gõ thành mask
 *     ("%" khớp mọi dòng — DoS-lite + sai kết quả). v5 escape `[%_\\]` bằng
 *     backslash + `ESCAPE '\'` — input `'%;)'` được hiểu NGUYÊN VĂN.
 *  3) q tối thiểu 2 ký tự (palette gõ từng chữ cái — chặn query phủ toàn bảng).
 *  4) limit clamp 1..30 (v4 clamp 1..50 — UI dropdown chỉ hiển thị vài dòng).
 *  5)Envelope tự trả {ok,result}/{ok,error}, KHÔNG throw — quy ước hàm mới W1b+
 *     (tonKho/thanhLyList/dmList — lib/rpc.ts dispatch trả nguyên qua route,
 *     route bọc {ok:true,result:<envelope>} → client unwrap 2 tầng, pattern
 *     app/(app)/kho/page.tsx:1233-1241). v4 throw 'Chưa đăng nhập.' → v5 envelope.
 *
 * Lọc dòng: `deleted_at=''` MỌI bảng (soft-delete v5) + is_test theo pattern
 * scList (lib/core/sc.ts:111-113): role thường chỉ thấy is_test=0; admin/giamdoc
 * thấy cả dữ liệu test (khác vattuList lọc cứng 0 — search là CÔNG CỤ ĐIỀU
 * HƯỚNG, admin cần tra cả bản ghi test để mở lại phiếu). SQL parameterized
 * $n, không nối chuỗi dữ liệu vào text — nhánh is_test là constant server-side.
 *
 * Quyền: fn này CHƯA đăng ký lib/rpc.ts (đợt reg gộp W4 — coordinator). Khi reg,
 * META dự kiến ['sc','xem'] (mọi role đã có sc.xem hoặc superset — tương đương
 * "search.xem mọi role" của v4:3). Core vẫn tự chặn chưa đăng nhập (fail-closed).
 */
import type { Api } from '../types';

export interface GlobalSearchResult {
  /** phiếu SC khớp mã (sc.id) hoặc biển xe (JOIN xe.bien_so). */
  sc: Array<{ ma: string; trang_thai: string; ngay_tao: string; bien_so: string | null; xe_id: string }>;
  /** xe khớp biển số. */
  xe: Array<{ id: string; bien_so: string; chu_xe: string | null }>;
  /** đề nghị mua khớp mã dm.id. */
  dm: Array<{ id: string; sc_id: string | null; trang_thai: string; tong: unknown; ngay_tao: string | null }>;
  /** vật tư khớp tên. */
  vattu: Array<{ id: string; ten: string; don_vi: string | null; ton: unknown; gia: unknown }>;
}

/** Envelope theo quy ước W1b+ (không throw — business error về ok:false). */
export type GlobalSearchEnv =
  | { ok: true; result: GlobalSearchResult }
  | { ok: false; error: string };

const Q_MIN = 2;
const LIMIT_DEFAULT = 10;
const LIMIT_MAX = 30;

/**
 * Escape ký tự đặc biệt của pattern LIKE/ILIKE (v4 thiếu bước này — siết W4.2):
 * `%` (khớp tự do), `_` (khớp 1 ký tự), `\` (kí tự escape mặc định của PG từ 9.1,
 * ta khai báo tường minh ESCAPE '\' nên bản thân nó cũng phải escape).
 * Chỉ escape trong GIÁ TRÍ PARAMETER — text SQL giữ nguyên dạng, không động chạm
 * input người dùng → vẫn parameterized 100%.
 */
export function escapeLike(term: string): string {
  return term.replace(/[%_\\]/g, (c) => '\\' + c);
}

/**
 * Tìm kiếm toàn cục 4 nhóm (SC / xe / đề nghị mua / vật tư).
 * @param api ngữ cảnh gọi (auth để xác định lọc is_test, db pool)
 * @param p     { q: string ≥2 ký tự; limit?: 1..30 (mặc định 10) — clamp im lặng }
 */
export async function globalSearch(api: Api, p: { q?: unknown; limit?: unknown } = {}): Promise<GlobalSearchEnv> {
  const u = api.auth.current();
  if (!u) return { ok: false, error: 'Chưa đăng nhập.' }; // v4:19 throw → envelope v5

  const term = String(p?.q ?? '').trim();
  if (term.length < Q_MIN) return { ok: false, error: 'q tối thiểu 2 ký tự' };

  let limit = Number(p?.limit);
  if (!Number.isFinite(limit) || limit < 1) limit = LIMIT_DEFAULT;
  limit = Math.min(Math.floor(limit), LIMIT_MAX);

  const like = '%' + escapeLike(term) + '%';
  // is_test pattern v5 (scList): admin/giamdoc xem cả dữ liệu test — hằng số
  // server-side, KHÔNG phải input → nhánh text an toàn (liệt kê 2 literal).
  const testBypass = u.role === 'admin' || u.role === 'giamdoc';
  const itSc = testBypass ? '' : ' AND s.is_test = 0';
  const itPlain = testBypass ? '' : ' AND is_test = 0';
  // JOIN xe: BIỂN SỐ của XE test (admin tạo — xe.tao chỉ admin có, nên mọi
  // fixture test là is_test=1) KHÔNG được lọt vào kết quả/điều kiện khớp của
  // role thường, qua phiếu thật gắn xe test. Left-join có điều kiện → dòng sc
  // vẫn thấy theo MÃ phiếu, bien_so trả null (không lộ biển test).
  const joinIsTest = testBypass ? '' : ' AND x.is_test = 0';

  // 4 câu ĐỘC LẬP thật sự (không transaction, không phụ thuộc lẫn nhau) → all.
  // Lỗi DB (mất kết nối) throw → route 400 {ok:false} — đồng nhất tonKho không catch.
  const [scRes, xeRes, dmRes, vtRes] = await Promise.all([
    api.db.query(
      "SELECT s.id AS ma, s.trang_thai, s.ngay_tao, s.xe_id, x.bien_so " +
        "FROM sc s LEFT JOIN xe x ON x.id = s.xe_id" + joinIsTest + " " +
        "WHERE s.deleted_at = ''" + itSc + " " +
        "AND (s.id ILIKE $1 ESCAPE '\\' OR COALESCE(x.bien_so, '') ILIKE $1 ESCAPE '\\') " +
        "ORDER BY s.ngay_tao DESC, s.id DESC LIMIT $2",
      [like, limit]
    ),
    api.db.query(
      "SELECT id, bien_so, chu_xe FROM xe " +
        "WHERE deleted_at = ''" + itPlain + " AND bien_so ILIKE $1 ESCAPE '\\' " +
        "ORDER BY bien_so LIMIT $2",
      [like, limit]
    ),
    api.db.query(
      "SELECT id, sc_id, trang_thai, tong, ngay_tao FROM dm " +
        "WHERE deleted_at = ''" + itPlain + " AND id ILIKE $1 ESCAPE '\\' " +
        "ORDER BY ngay_tao DESC NULLS LAST, id DESC LIMIT $2",
      [like, limit]
    ),
    api.db.query(
      "SELECT id, ten, don_vi, ton, gia FROM vattu " +
        "WHERE deleted_at = ''" + itPlain + " AND ten ILIKE $1 ESCAPE '\\' " +
        "ORDER BY id LIMIT $2",
      [like, limit]
    ),
  ]);

  return {
    ok: true,
    result: {
      sc: scRes.rows.map((r) => ({
        ma: r.ma,
        trang_thai: r.trang_thai,
        ngay_tao: r.ngay_tao,
        bien_so: r.bien_so ?? null,
        xe_id: r.xe_id,
      })),
      xe: xeRes.rows.map((r) => ({ id: r.id, bien_so: r.bien_so, chu_xe: r.chu_xe ?? null })),
      dm: dmRes.rows.map((r) => ({
        id: r.id,
        sc_id: r.sc_id ?? null,
        trang_thai: r.trang_thai,
        tong: r.tong,
        ngay_tao: r.ngay_tao ?? null,
      })),
      vattu: vtRes.rows.map((r) => ({
        id: r.id,
        ten: r.ten,
        don_vi: r.don_vi ?? null,
        ton: r.ton,
        gia: r.gia,
      })),
    },
  };
}
