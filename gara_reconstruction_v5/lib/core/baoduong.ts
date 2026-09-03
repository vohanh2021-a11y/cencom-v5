/**
 * baoduong.ts — Lịch bảo dưỡng định kỳ xe (v5).
 * PORT nguyên hành vi từ draft v4 `packages/core/src/baoduong.ts`
 * (branch git `draft/gd4-gd5-v4`, commit 8397979 — NV-23, v4.3 P3).
 *
 * Bảng bao_duong_lich: id, xe_id, hang_muc, ngay_du_kien, ngay_thuc_hien,
 *   trang_thai ('cho'|'xong'|'bo'), deleted_at.
 * (v5 chưa có DDL trong db/schema.sql — xem "ĐIỀU KIỆN TRIỂN KHAI" cuối header.)
 *
 * Bảo mật (theo khuôn v5):
 *  • Đăng nhập + quyền kiểm tra NGAY TRONG LÕI (defense-in-depth, pattern
 *    admin.ts "core gate TRƯỚC dispatch") — phòng khi fn reg vào lib/rpc.ts
 *    với META lỏng/quên siết; dispatch fail-closed 403 nếu thiếu META.
 *  • Validate mọi đầu vào: trim, whitelist trang_thai, regex ngày
 *    YYYY-MM-DD, trần độ dài hang_muc (SIẾT CÓ CHỦ ĐÍCH so v4 — v4 không
 *    giới hạn độ dài; mọi input người dùng đều qua trần này).
 *  • SQL parameterized ($1,$2) — không nối chuỗi.
 *  • Soft-delete deleted_at=''; audit qua logActivity (kênh audit duy nhất v5).
 *  • Envelope {ok,...}, KHÔNG throw cho lỗi nghiệp vụ (quy ước hàm mới W1b+
 *    như tonKho/dmList/baogia asset.ts) → không lộ stack, HTTP vẫn 200.
 *
 * LỆCH v4 draft (chủ đích, ghi nhận):
 *  • Bỏ tenant_id 'c1' — v5 LEAN single-tenant (không bảng nào có cột
 *    tenant_id). Nếu copy nguyên DDL v4 (packages/db/schema.sql:757) sang v5
 *    thì tenant_id có DEFAULT 'c1' → INSERT không nêu cột vẫn hợp lệ.
 *  • api.db.audit(...) → logActivity(db, {...}) (kênh audit v5).
 *  • db.row/run/nextId wrapper v4 → helper pg của lib/db.ts v5.
 *  • Quyền lõi 'xe','tao' (≡ tiền lệ xeCreate rpc.ts:140): draft gate ở
 *    dispatch ['xe','sua'] (rpc-dispatch.ts:106) nhưng MATRIX v5 không role
 *    nào mang xe.sua → cả hai đều admin-only hôm nay; chốt 'tao'.
 *
 * ĐIỀU KIỆN TRIỂN KHAI (coordinator — NGOÀI ranh giới task "chỉ tạo file này"):
 *  1) lib/rpc.ts — thêm:
 *       import * as bd from './core/baoduong';
 *       FN_LIST:  'baoDuongTao', 'baoDuongList',
 *       META:     baoDuongTao: ['xe', 'tao'], baoDuongList: ['xe', 'xem'],
 *       HANDLERS: baoDuongTao: (api, a) => bd.baoDuongTao(api, a),
 *                 baoDuongList: (api, a) => bd.baoDuongList(api, a),
 *  2) db/schema.sql (hoặc script migrate additive) — DDL v5-hợp-khuôn:
 *       CREATE TABLE IF NOT EXISTS bao_duong_lich (
 *         id             VARCHAR(12) PRIMARY KEY,
 *         xe_id          VARCHAR(12) NOT NULL REFERENCES xe(id),
 *         hang_muc       TEXT NOT NULL,
 *         ngay_du_kien   TEXT DEFAULT '',
 *         ngay_thuc_hien TEXT DEFAULT '',
 *         trang_thai     TEXT NOT NULL DEFAULT 'cho'
 *                        CHECK (trang_thai IN ('cho','xong','bo')),
 *         deleted_at     TEXT DEFAULT ''
 *       );
 *       CREATE INDEX IF NOT EXISTS idx_bd_xe ON bao_duong_lich(xe_id)
 *         WHERE deleted_at='';
 *     (INSERT của lõi không nêu tenant → tương thích cả DDL v4 lẫn v5 ở trên.)
 *
 * UI tiêu thụ: app/(app)/nhac-han/page.tsx (port từ draft
 * apps/web/app/(app)/nhac-han/page.tsx + mục lịch bảo dưỡng theo xe).
 */
import type { Api } from '../types';
import { row, run, nextId } from '../db';
import { logActivity } from './activity';
import { createScopedLogger } from '../observability';

const log = createScopedLogger('baoduong');

const TT_BD = ['cho', 'xong', 'bo'];
const HANG_MUC_MAX = 200;

export interface BaoduongArg {
  xe_id: string;
  hang_muc: string;
  ngay_du_kien?: string;
  ngay_thuc_hien?: string;
  trang_thai?: string;
}

export interface BaoduongResult {
  ok: boolean;
  id?: string;
  error?: string;
}

function isDate(v: unknown): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ''));
}

/**
 * Tạo lịch bảo dưỡng cho 1 xe. v4 ≡ hành vi: cần đăng nhập; xe phải tồn tại
 * (soft-delete chặn); trang_thai sai whitelist → mặc định 'cho'; ngày sai
 * định dạng → '' (không chặn, chỉ bỏ — giữ nguyên semantics draft).
 */
export async function baoDuongTao(api: Api, arg: BaoduongArg): Promise<BaoduongResult> {
  const u = api.auth.current();
  if (!u) return { ok: false, error: 'Chưa đăng nhập.' };
  if (!(await api.perm.can(api.db, u.role, 'xe', 'tao'))) {
    return { ok: false, error: 'Không đủ quyền.' };
  }

  const xeId = String(arg?.xe_id ?? '').trim();
  if (!xeId) return { ok: false, error: 'Thiếu xe_id.' };
  const xe = await row<{ id: string }>("SELECT id FROM xe WHERE id=$1 AND deleted_at=$2", [xeId, '']);
  if (!xe) return { ok: false, error: 'Không tìm thấy xe ' + xeId + '.' };

  const hangMuc = String(arg?.hang_muc ?? '').trim();
  if (!hangMuc) return { ok: false, error: 'Thiếu hạng mục bảo dưỡng.' };
  if (hangMuc.length > HANG_MUC_MAX) {
    return { ok: false, error: `Hạng mục bảo dưỡng quá dài (tối đa ${HANG_MUC_MAX} ký tự).` };
  }

  const tt = TT_BD.includes(String(arg?.trang_thai)) ? String(arg?.trang_thai) : 'cho';
  const ngayDuKien = isDate(arg?.ngay_du_kien) ? String(arg?.ngay_du_kien) : '';
  const ngayThucHien = isDate(arg?.ngay_thuc_hien) ? String(arg?.ngay_thuc_hien) : '';

  const id = await nextId('BD');
  await run(
    "INSERT INTO bao_duong_lich (id, xe_id, hang_muc, ngay_du_kien, ngay_thuc_hien, trang_thai, deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [id, xe.id, hangMuc, ngayDuKien, ngayThucHien, tt, '']
  );
  try {
    await logActivity(api.db, {
      actor_id: u.id,
      actor_role: u.role,
      hanh_dong: 'baoduong_tao',
      doi_tuong: 'bao_duong_lich',
      doi_tuong_id: id,
      mo_ta: 'Tạo lịch BD ' + hangMuc,
    });
  } catch (e) {
    log.logError('logActivity baoduong_tao failed', e, { id });
  }
  return { ok: true, id };
}

/**
 * Danh sách lịch bảo dưỡng của 1 xe (mới nhất trước — ORDER BY id DESC ≡ v4).
 * v4 ≡ hành vi: chưa đăng nhập / thiếu xe_id / không đủ quyền → mảng rỗng
 * (fail-closed, không lộ lỗi quyền ở tầng list).
 */
export async function baoDuongList(api: Api, arg: { xe_id: string }): Promise<Record<string, unknown>[]> {
  const u = api.auth.current();
  if (!u) return [];
  if (!(await api.perm.can(api.db, u.role, 'xe', 'xem'))) return [];
  const xeId = String(arg?.xe_id ?? '').trim();
  if (!xeId) return [];
  const r = await api.db.query(
    'SELECT id, xe_id, hang_muc, ngay_du_kien, ngay_thuc_hien, trang_thai FROM bao_duong_lich WHERE xe_id=$1 AND deleted_at=$2 ORDER BY id DESC',
    [xeId, '']
  );
  return r.rows;
}
