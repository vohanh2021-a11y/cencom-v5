/**
 * init.ts — Các hàm khởi động ứng dụng (GĐ-1.1) — PORT từ draft v4
 * `packages/core/src/init.ts` (commit 8397979) sang v5 `lib/core/`.
 * Được gọi lúc load (public, mọi user đăng nhập) để cung cấp dữ liệu
 * chọn/trạng thái. Self-contained theo đúng tinh thần v3.6/v4.
 *
 * Delta v4 → v5 (thích ứng schema/nguồn quyền — nghiệp vụ giữ nguyên):
 *  1) `InitApi` tự định nghĩa → dùng `Api` chuẩn v5 (lib/types.ts).
 *     Kéo theo: user trả về là Actor {id,name,role} — v5 KHÔNG có
 *     phone/phong_ban trên session (khác v4).
 *  2) `permsOfRole(db, role)` đọc bảng `phan_quyen` → v5 KHÔNG có bảng này;
 *     nguồn sự thật là MATRIX tĩnh (lib/perm.ts) — chính là bản seed mà v4
 *     đổ vào phan_quyen, nên nội dung tương đương. Triển khai bằng helper nội
 *     bộ permsForRole() đọc MATRIX, giữ nguyên ngữ nghĩa admin = wildcard +
 *     expand đủ MODULES×FEATURES cho UI check `perms[m].includes(f)`.
 *  3) MODULES/FEATURES chưa được export từ lib/perm.ts → tạm định nghĩa tại
 *     chỗ (port nguyên từ draft v4 perm.ts). TODO(reg): nâng lên lib/perm.ts
 *     khi coordinator hợp nhất, rồi import lại.
 *  4) `vehiclesOptions`: schema v5 không có cột `bks/hang/dong` mà dùng
 *     `bien_so/chu_xe` (db/schema.sql:15-23) → giữ KEY output `bks` (contract
 *     client) map từ `bien_so`; label = bien_so + ' — ' + chu_xe.
 *     is_test KHÔNG lọc theo bản gốc v4 — xem Production Check.
 *  5) `phongbanList`: v5 schema CHƯA có bảng `phong_ban` (chỉ có trong draft
 *     v4 / v3.6) → trả [] để giữ contract client, revive khi có migration.
 *
 * REG: module CHƯA đăng ký ở lib/rpc.ts (phiên này không sửa rpc.ts).
 * rpc.ts:289-295 hiện inline sẵn currentUser/appInfo — khi hợp nhất, switching
 * sang các hàm dưới đây phải giữ envelope {ok,result} do dispatch quyết định
 * (core chỉ trả data thuần, không throw luồng nghiệp vụ).
 */
import type { Api } from '../types';
import { ROLES, MATRIX } from '../perm';

/** Whitelist module/feature — port nguyên từ draft v4 perm.ts (delta 3). */
const MODULES = ['sc', 'kho', 'mua', 'asset', 'xe', 'report', 'help', 'chat', 'de_xuat', 'xuong', 'gd2', 'search', 'ke_toan', 'all', 'baogia', 'hoso', 'dashboard'] as const;
const FEATURES = ['xem', 'tao', 'sua', 'duy', 'quyet', 'xuat', 'xoa', 'kehoach'] as const;

/** User hiện tại (từ session). */
export async function currentUser(api: Api): Promise<unknown> {
  return api.auth.current();
}

/** Thông tin ứng dụng (tên/phên bản). */
export async function appInfo(_api: Api): Promise<{ name: string; version: string; org: string }> {
  return { name: 'cencomOS', version: process.env['npm_package_version'] || '5.0.0', org: 'Cencom' };
}

/**
 * Quyền của một vai, tính từ MATRIX tĩnh (delta 2). Admin: wildcard 'all'
 * + expand đủ từng module→features cho UI cũ (pattern v4 perm.ts).
 */
function permsForRole(role: string): Record<string, string[]> {
  const r = String(role).toLowerCase();
  if (r === 'admin') {
    const full: Record<string, string[]> = { all: ['all'] };
    for (const m of MODULES) {
      if (m === 'all') continue;
      full[m] = [...FEATURES];
    }
    return full;
  }
  const src = MATRIX[r];
  if (!src) return {};
  const out: Record<string, string[]> = {};
  for (const [m, feats] of Object.entries(src)) out[m] = [...feats];
  return out;
}

/** Quyền của vai hiện tại. */
export async function myPerms(api: Api): Promise<{ role: string; perms: Record<string, string[]> }> {
  const u = api.auth.current();
  return { role: u ? u.role : '', perms: u ? permsForRole(u.role) : {} };
}

/** Danh sách xe (cho form chọn BKS). */
export async function vehiclesOptions(api: Api): Promise<Array<{ id: string; bks: string; label: string }>> {
  const res = await api.db.query(
    "SELECT id, bien_so, chu_xe FROM xe WHERE deleted_at='' ORDER BY bien_so"
  );
  const rows = res.rows as Array<{ id: string; bien_so: string; chu_xe: string | null }>;
  return rows.map((r) => ({ id: r.id, bks: r.bien_so, label: r.bien_so + (r.chu_xe ? ' — ' + r.chu_xe : '') }));
}

/** Danh sách phòng ban — placeholder rỗng tới khi v5 có bảng phong_ban (delta 5). */
export async function phongbanList(_api: Api): Promise<Array<{ id: string; code: string; name: string }>> {
  return [];
}

/** Nhóm checklist mặc định (hiện trả rỗng — bổ sung từ config khi có). */
export async function checklistGroups(_api: Api): Promise<unknown[]> {
  return [];
}

/** Gộp dữ liệu khởi động form để giảm round-trip. */
export async function formInitData(api: Api): Promise<Record<string, unknown>> {
  const [vehicles, phongbans, roles, perms] = await Promise.all([
    vehiclesOptions(api),
    phongbanList(api),
    Promise.resolve(ROLES),
    myPerms(api),
  ]);
  return {
    vehicles,
    phongbans,
    roles,
    modules: MODULES,
    features: FEATURES,
    perms,
  };
}
