/**
 * lib/core/asset.ts — W1.6e: Quyết toán TS — Khấu hao + Chi phí tích luỹ + GTTV (LOGIC-ONLY).
 *
 * Port NGUYÊN công thức từ v3.6 `server/asset.js`:
 *   - khauHaoNam()  (dòng 21):  config('khau_hao_nam', 10), guard Math.max(1, Number(v) || 10)
 *   - khauHao(xe)   (dòng 23):  nguyen<=0 → 0;
 *                               soNam  = max(0, nowYear - (Number(nam_sx) || nowYear))
 *                                      (nam_sx NULL/0/tương-lai → 0 năm)
 *                               gioiHan= min(soNam, khauHaoNam)
 *                               khauHao= Math.round((nguyen / khauHaoNam) * gioiHan)
 *   - chiTichLuy()  (dòng 32):  SUM(tong) + COUNT(*) của hồ sơ quyết toán.
 *       ↔ v5 không còn bảng lich_sua; SC tự mang trạng thái 'da_quyet' (schema.sql CHECK),
 *         nên chi phí tích luỹ = SUM(sc.tong) WHERE trang_thai='da_quyet' AND deleted_at=''.
 *   - gttv: v3.6 assetXe dòng 139 `nguyen - kh + tich`; spec W1.6e siết clamp:
 *           GTTV = max(0, nguyen_gia − khau_hao_luy_ke) + chi_phi_tich_luy.
 *
 * Khác biệt hiệu suất so với v3.6 (assetReport dòng 154 map từng xe → N+1 query):
 *   v5 gom về MỘT query JOIN `xe ⟕ sc(da_quyet)` + GROUP BY — aggregate đẩy xuống PG,
 *   đúng 1 round-trip, KHÔNG N+1 (Chuẩn 3b — CSDL).
 *
 * Hợp đồng handler RPC (ký hiệu `(_api, args)` như HANDLERS trong lib/rpc.ts):
 *   - KHÔNG throw trả lỗi thô: {ok:false, error:'404'} (không tìm thấy / id thiếu-sai),
 *     {ok:false, error:'500'} (lỗi hệ thống, đã log). {ok:true, result:...} khi thành công.
 *   - Quyền (asset.xem) do tầng dispatch kiểm tra khi W1.6f khai báo META/FN_LIST
 *     trong lib/rpc.ts (file này cố ý KHÔNG sửa rpc.ts — phiêu worker khác).
 *   - Read-only: không ghi, không cần logActivity (v3.6 asset.js cũng không audit 2 fn đọc).
 */
import type { Api } from '../types';
import { q, row } from '../db';
import { createScopedLogger } from '../observability';

const log = createScopedLogger('asset');

/** Dòng gốc từ assetReport query (pg NUMERIC → string; ep số trong Number()). */
interface RowAgg {
  id: string;
  bien_so: string;
  nguyen_gia: unknown;
  nam_sx: unknown;
  chi_phi: unknown;
  so_lan: unknown;
}

/** Một dòng xe kèm tổng hợp quyết toán (đã ép kiểu từ pg NUMERIC-string). */
interface AssetItem {
  xe_id: string;
  bien_so: string;
  nguyen_gia: number;
  khau_hao_luy_ke: number;
  chi_phi_tich_luy: number;
  so_lan_sua: number;
  gttv: number;
}

/**
 * v3.6 asset.js:21 — số năm khấu hao từ bảng config, key `khau_hao_nam`.
 * Key KHÔNG tồn tại / giá trị rác (NaN, rỗng, 0) → fallback 10; guard max(1,·) chống chia 0.
 */
export async function getKhauHaoNam(): Promise<number> {
  try {
    const r = await row<{ value: string | null }>(
      'SELECT value FROM config WHERE key=$1',
      ['khau_hao_nam']
    );
    // v3.6 db.configGet('khau_hao_nam', 10): thiếu dòng → mặc định 10
    const n = r ? Number(r.value) : 10;
    return Math.max(1, n || 10);
  } catch (e: unknown) {
    // Lỗi hạ tầng đọc config không được làm sập báo cáo — fallback mặc định + WARN truy vết
    log.logWarn('getKhauHaoNam: doc config that bai → fallback 10', { err: String(e) });
    return 10;
  }
}

/**
 * v3.6 asset.js:23 khauHao() — port nguyên, tách thành hàm THUẦN (nhận giá trị đã đọc)
 * để assetReport dùng lại trên aggregate trả về từ PG (không chạm DB).
 * Làm tròn Math.round như v3.6 (không ceil/floor).
 */
export function tinhKhauHao(nguyenGia: unknown, namSx: unknown, khauHaoNam: number): number {
  const nguyen = Number(nguyenGia) || 0;
  if (nguyen <= 0) return 0;
  const now = new Date().getFullYear();
  const soNam = Math.max(0, now - (Number(namSx) || now)); // NULL/0/tương lai → 0
  const gioiHan = Math.min(soNam, khauHaoNam);
  return Math.round((nguyen / khauHaoNam) * gioiHan);
}

/** Ghép 1 dòng xe + aggregate chi phí → AssetItem (gttv clamp theo spec W1.6e). */
function tinhAsset(
  xe: { id: string; bien_so: string; nguyen_gia: unknown; nam_sx: unknown },
  tich: { chi_phi: unknown; so_lan: unknown },
  khauHaoNam: number
): AssetItem {
  const nguyen = Number(xe.nguyen_gia) || 0;
  const khauHaoLuyKe = tinhKhauHao(nguyen, xe.nam_sx, khauHaoNam);
  const chiPhi = Number(tich.chi_phi) || 0;
  return {
    xe_id: xe.id,
    bien_so: xe.bien_so,
    nguyen_gia: nguyen,
    khau_hao_luy_ke: khauHaoLuyKe,
    chi_phi_tich_luy: chiPhi,
    so_lan_sua: Number(tich.so_lan) || 0,
    gttv: Math.max(0, nguyen - khauHaoLuyKe) + chiPhi,
  };
}

/**
 * assetXe(_api, {id}) — lý lịch tài sản 1 xe theo id.
 * v3.6 tra theo bks; v5 schema xe PK id + sc.xe_id FK → tra theo id (spec W1.6e).
 * CHỈ tính SC đã quyết toán: trang_thai='da_quyet' AND deleted_at='' (soft-delete loại khỏi tổng).
 * KHÔNG throw: id thiếu/sai kiểu → '404'; xe không tồn tại/đã xoá → '404'; lỗi DB → '500'.
 */
export async function assetXe(_api: Api, args: any): Promise<any> {
  const id = typeof args?.id === 'string' ? args.id.trim() : '';
  if (!id) return { ok: false, error: '404' };
  try {
    const khn = await getKhauHaoNam();
    const xe = await row<{ id: string; bien_so: string; nguyen_gia: unknown; nam_sx: unknown }>(
      'SELECT id, bien_so, nguyen_gia, nam_sx FROM xe WHERE id=$1 AND deleted_at=$2',
      [id, '']
    );
    if (!xe) return { ok: false, error: '404' };
    const tich = await row<{ chi_phi: unknown; so_lan: unknown }>(
      "SELECT COALESCE(SUM(tong),0) AS chi_phi, COUNT(*)::int AS so_lan FROM sc WHERE xe_id=$1 AND trang_thai=$2 AND deleted_at=$3",
      [id, 'da_quyet', '']
    );
    return { ok: true, result: tinhAsset(xe, tich ?? { chi_phi: 0, so_lan: 0 }, khn) };
  } catch (e: unknown) {
    log.logError('assetXe failed', e, { id });
    return { ok: false, error: '500' };
  }
}

/**
 * assetReport(_api, args) — báo cáo quyết toán toàn dàn xe đang hoạt động
 * (xanh theo spec: xe.deleted_at='' AND is_test=0 — dữ liệu test admin không lẫn vào sổ sách).
 *
 * Chống N+1 (điểm yếu của v3.6 assetReport dòng 154–167, map từng xe → query từng lượt):
 *   MỘT query JOIN (xe LEFT JOIN sc ON da_quyet) + GROUP BY — PG aggregate 1 lần,
 *   1 round-trip duy nhất cho toàn bộ phần tử. Chi phí/count đã nằm sẵn trong dòng group.
 *
 * Sắp xếp: gttv GIẢM dần (tie-break bien_so để ổn định thứ tự giữa các lần chạy).
 * Tổng hợp: { tong_gttv, tong_nguyen_gia, tong_chi_phi, dem_xe } cộng từ items (js-only,
 * không query thứ hai — các cột NUMERIC đã ép Number() trong tinhAsset).
 */
export async function assetReport(_api: Api, _args?: any): Promise<any> {
  try {
    const khn = await getKhauHaoNam();
    // Nguồn dòng: pg trả NUMERIC dạng string → Number() qua tinhAsset (không assumes kiểu số)
    const r = await q(
      'SELECT x.id, x.bien_so, x.nguyen_gia, x.nam_sx, ' +
        "COALESCE(SUM(s.tong),0) AS chi_phi, COUNT(s.id)::int AS so_lan " +
        "FROM xe x LEFT JOIN sc s ON s.xe_id = x.id AND s.trang_thai = $1 AND s.deleted_at = $2 " +
        'WHERE x.deleted_at = $3 AND x.is_test = 0 ' +
        'GROUP BY x.id, x.bien_so, x.nguyen_gia, x.nam_sx',
      ['da_quyet', '', '']
    );
    const items: AssetItem[] = (r.rows as RowAgg[]).map((x) => tinhAsset(x, x, khn));
    items.sort(
      (a, b) => b.gttv - a.gttv || String(a.bien_so).localeCompare(String(b.bien_so), 'vi')
    );
    const tong = {
      tong_gttv: items.reduce((s, i) => s + i.gttv, 0),
      tong_nguyen_gia: items.reduce((s, i) => s + i.nguyen_gia, 0),
      tong_chi_phi: items.reduce((s, i) => s + i.chi_phi_tich_luy, 0),
      dem_xe: items.length,
    };
    return { ok: true, result: { items, tong } };
  } catch (e: unknown) {
    log.logError('assetReport failed', e, {});
    return { ok: false, error: '500' };
  }
}
