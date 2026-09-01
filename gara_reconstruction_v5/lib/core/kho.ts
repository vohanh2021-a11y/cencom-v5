import type { PoolClient } from 'pg';
import type { Api } from '../types';
import { row, run, nextId, withTransaction } from '../db';
import { logActivity } from './activity';
import { createScopedLogger } from '../observability';
import { invalidateDashCache } from './xuong'; // W3.2-wire: ghi xong luồng kho/DM → lạnh dashboard xưởng

const log = createScopedLogger('kho');

// ═════════════════════════════════════════════════════════════════════
// W1c — KHO HƯ HỎNG CÁCH LY / THANH LÝ / AUTO (port v3.6 kho.js)
// v3.6 dùng cột phân loại riêng ở header (phieu_nhap.loai_nhap,
// phieu_xuat.loai_xuat). v5 KHÔNG mở rộng CHECK `loai` ('nhap'|'xuat') vì
// đó là contract sẵn có (phieuList, rpc của worker-c) → nhánh hư hỏng được
// nhận diện bằng MARKER `ly_do` duy nhất dưới đây, do CORE ghi buộc ở mọi
// phiếu nhập cu_hong (kể cả manual nhapKho) → autoXuatSC loại trừ chính xác.
// ═════════════════════════════════════════════════════════════════════
export const THU_HOI_MARKER = 'Thu hồi nội bộ';
/** Giá trị ly_do kích hoạt ghi bảng thanh lý khi XUẤT (chốt plan W1c). */
const LY_DO_THANH_LY = 'Thanh lý';

/** Số nguyên dương (khác requirePositiveNumber: chặn BOTH vụn thập phân) —
 *  dùng cho mọi nhánh cộng/trừ ton_cu_hong + thanh_ly sinh từ sc_vattu, vì cột
 *  ton_cu_hong là INTEGER (PG sẽ LÀM TRÒN THẦM LẶNG nếu truyền 2.5 → lệch số). */
function requirePositiveInt(v: any, label: string): number {
  const n = Number(v);
  if (!v || !Number.isInteger(n) || n <= 0) throw new Error(label + ' phải là số nguyên dương');
  return n;
}

/** Số dương hợp lệ (number hoặc numeric string) — chặn NaN/Infinity/âm/0/rỗng */
function requirePositiveNumber(v: any, label: string): number {
  const n = Number(v);
  if (!v || !Number.isFinite(n) || n <= 0) throw new Error('Thiếu ' + label);
  return n;
}

/** Số hợp lệ khi có cung cấp (field optional) — chặn NaN/Infinity */
function optionalNumber(v: any, label: string): void {
  if (v !== undefined && v !== null && v !== '' && !Number.isFinite(Number(v))) {
    throw new Error(label + ' không hợp lệ');
  }
}

/** Chuỗi khi có cung cấp (field optional) — chặn object/array/type-confusion injection */
function optionalStr(v: any, label: string): void {
  if (v !== undefined && v !== null && v !== '' && typeof v !== 'string') {
    throw new Error(label + ' không hợp lệ');
  }
}

/**
 * Ghi audit activity_log BẰNG CLIENT CỦA TRANSACTION đang mở.
 * logActivity() chuẩn dùng pool (connection khác) → nếu gọi trong withTransaction sẽ:
 *   (1) không nằm trong tx (rollback vẫn lọt dòng audit "ma"), và
 *   (2) cần thêm connection khi 10 tx đang giữ kín pool → deadlock.
 * Vì vậy ghi qua `client` với đúng bộ cột/giá trị như logActivity; tx lỗi → audit
 * cùng rollback (nhất quán ghi + log theo Chuan 3b/Chuan 1).
 */
async function auditTx(
  client: PoolClient,
  p: Parameters<typeof logActivity>[1]
): Promise<void> {
  await client.query(
    'INSERT INTO activity_log (actor_id,actor_role,hanh_dong,doi_tuong,doi_tuong_id,sc_id,mo_ta,is_test) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [p.actor_id ?? null, p.actor_role ?? null, p.hanh_dong, p.doi_tuong ?? null, p.doi_tuong_id ?? null, p.sc_id ?? null, p.mo_ta ?? null, p.is_test ?? 0]
  );
}

export async function vattuList(api: Api): Promise<any[]> {
  const u = api.auth.current();
  const role = u?.role;
  const r = await api.db.query(
    "SELECT * FROM vattu WHERE deleted_at='' AND is_test=0 ORDER BY ten"
  );
  return r.rows;
}

export async function vattuGet(api: Api, id: string): Promise<any | null> {
  const u = api.auth.current();
  const role = u?.role;
  // Nhất quán với vattuList: không trả về vật tư đã soft-delete
  return row('SELECT * FROM vattu WHERE id=$1 AND deleted_at=$2', [id, '']) ?? null;
}

export async function vattuCreate(
  api: Api,
  p: { ten: string; don_vi?: string; gia?: number; ton_min?: number }
): Promise<{ id: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'kho', 'tao'))) throw new Error('403');
  if (typeof p?.ten !== 'string' || !p.ten.trim()) throw new Error('Thiếu ten');
  optionalStr(p?.don_vi, 'don_vi');
  const isTest = role === 'admin' ? 1 : 0;
  const id = await nextId('VT');
  await run(
    'INSERT INTO vattu (id,ten,don_vi,gia,ton,ton_min,is_test) VALUES ($1,$2,$3,$4,0,$5,$6)',
    [id, p.ten, p.don_vi ?? null, p.gia ?? null, p.ton_min ?? null, isTest]
  );
  try {
    await logActivity(api.db, { actor_id: u?.id, actor_role: role, hanh_dong: 'vattu_tao', doi_tuong: 'vattu', doi_tuong_id: id, is_test: isTest });
  } catch (e) {
    log.logError('logActivity vattu_tao failed', e, { id });
  }
  return { id };
}

/**
 * Nhập kho — W1c mở rộng tham số OPTIONAL (tương thích lùi 100% hợp đồng cũ
 * {vattu_id, so_luong, don_gia?, ngay, ly_do?}):
 *  - `loai='cu_hong'`: nhập VT cũ/hỏng thu hồi → cộng `ton_cu_hong` (INTEGER,
 *    chặn so_luong thập phân), KHÔNG đụng `ton`/`gia`, KHÔNG ghi lịch sử giá,
 *    `ly_do` bị core ghi buộc = THU_HOI_MARKER (nhánh nhận diện phiếu thu hồi —
 *    autoXuatSC trừ khỏi công thức đếm nhập; equivalent v3.6 header.loai_nhap).
 *  - `sc_id` (nhập thường): link nhu cầu SC → chuyển sc_vattu can_mua→da_mua
 *    (v3.6 dòng 383). Phiếu lưu sc_id để đếm 'đã nhập theo SC' (ref_sc ↔ sc_id).
 *  - `ncc`: dòng quản lý NCC (v3.6 phieu_nhap.nha_cc).
 */
export async function nhapKho(
  api: Api,
  p: {
    vattu_id: string; so_luong: number; don_gia?: number; ngay: string; ly_do?: string;
    ncc?: string; sc_id?: string; loai?: string;
  }
): Promise<{ id: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'kho', 'tao'))) throw new Error('403');
  if (typeof p?.vattu_id !== 'string' || !p.vattu_id.trim()) throw new Error('Thiếu vattu_id');
  const soLuong = requirePositiveNumber(p?.so_luong, 'so_luong');
  optionalNumber(p?.don_gia, 'don_gia');
  optionalStr(p?.ly_do, 'ly_do');
  optionalStr(p?.ncc, 'ncc');
  optionalStr(p?.sc_id, 'sc_id');
  //whitelist `loai`: giá trị lạ (kể cả 'Cu Hong' sai hoa / typo) → CHỐI ngay,
  //không âm thầm phân loại lại thành nhập thường (đảo kho would corrupt `ton`).
  if (p?.loai !== undefined && p?.loai !== null && p?.loai !== '' && p.loai !== 'nhap' && p.loai !== 'cu_hong') {
    throw new Error('loai không hợp lệ (nhap|cu_hong)');
  }
  const isCuHong = p?.loai === 'cu_hong';
  if (isCuHong) requirePositiveInt(soLuong, 'so_luong (cu_hong)');
  if (typeof p?.ngay !== 'string' || !p.ngay.trim()) throw new Error('Thiếu ngay');
  const scId = typeof p?.sc_id === 'string' && p.sc_id.trim() ? p.sc_id.trim() : null;
  const lyDo = isCuHong ? THU_HOI_MARKER : (p.ly_do ?? null);
  //Counter chạy connection riêng TRƯỚC khi mở tx — nextId tự BEGIN, không được
  //gọi lồng trong withTransaction (giữ 1 connection/tx, chống hết pool khi 10 tx song song)
  const id = await nextId('NX');
  //W0.1: phiếu nhập + tăng ton + cập nhật gia (khi có don_gia, COALESCE giữ giá cũ
  //nếu null — hành vi như v3.6) + audit → TẤT CẢ 1 tx, ROLLBACK toàn bộ nếu lỗi giữa chừng.
  //W1c: ton_cu_hong đã có cột (db/schema.sql) → nhánh kho hỏng đi vào CÙNG tx này.
  await withTransaction(async (client) => {
    //W1a: phiếu 1 dòng → phieu_id tự tham chiếu (id dòng đầu = chính nó);
    //dòng cũ legacy phieu_id='' vẫn suy eff=id nên tương thích lùi.
    //id cấp RIÊNG cho phieu_id ($8): dùng lại $1 cho 2 cột khác kiểu
    //(VARCHAR(12) vs TEXT) làm PG "inconsistent types deduced".
    await client.query(
      "INSERT INTO nhap_xuat (id,vattu_id,loai,so_luong,don_gia,ngay,ly_do,nguoi,sc_id,ncc,phieu_id) VALUES ($1,$2,'nhap',$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        id, p.vattu_id, soLuong, isCuHong ? null : (p.don_gia ?? null), p.ngay,
        lyDo, u?.id ?? null, scId, p.ncc ?? null, id,
      ]
    );
    if (isCuHong) {
      //Kho hỏng CÁCH LY (v3.6 dòng 374–377): chỉ cộng ton_cu_hong; ton/gia giữ nguyên;
      //không mốc lịch sử giá (giá VT hỏng không phải giá thị trường). $2::integer
      //chặt kiểu — so_luong đã được requirePositiveInt chặn từ cửa vào.
      await client.query(
        'UPDATE vattu SET ton_cu_hong = ton_cu_hong + $2::integer WHERE id = $1',
        [p.vattu_id, soLuong]
      );
    } else {
      await client.query(
        'UPDATE vattu SET ton = ton + $2, gia = COALESCE($3::numeric, gia) WHERE id = $1',
        [p.vattu_id, soLuong, p.don_gia ?? null]
      );
      //W1b: chốt đơn giá > 0 → ghi mốc lịch sử giá CÙNG TX phiếu nhập (port v3.6
      //phNhapCreate→ghiGiaLichSu dòng 380). ngay lấy theo phiếu (args.ngay), KHÔNG
      //phải today() như v3.6 — nhập kho cho phiếu ngày quá khứ thì mốc giá cũng phải
      //thuộc đúng ngày đó. don_gia thiếu/0 → ghiGiaLichSu tự skip (hành vi v3.6).
      await ghiGiaLichSu(client, {
        vattu_id: p.vattu_id, gia: p.don_gia, loai: 'nhap',
        phieu_id: id, ngay: p.ngay, created_by: u?.id ?? '', is_test: role === 'admin' ? 1 : 0,
      });
      if (scId) {
        //v3.6 dòng 383: nhập thường gắn SC → sc_vattu can_mua→da_mua. Chỉ bước
        //'can_mua' (không kéo ngược dòng đã da_xuat/da_huy về da_mua).
        await client.query(
          "UPDATE sc_vattu SET tt = 'da_mua' WHERE sc_id = $1 AND vattu_id = $2 AND tt = 'can_mua' AND deleted_at = ''",
          [scId, p.vattu_id]
        );
      }
    }
    await auditTx(client, { actor_id: u?.id, actor_role: role, hanh_dong: 'kho_nhap', doi_tuong: 'nhap_xuat', doi_tuong_id: id, sc_id: scId ?? undefined, mo_ta: isCuHong ? 'Nhập kho VT cũ/hỏng (thu hồi) ' + id : undefined, is_test: role === 'admin' ? 1 : 0 });
  });
  invalidateDashCache(); // W3.2-wire (post-commit): nhập kho → ton/nhap_xuat → KPI dash đổi
  return { id };
}

/**
 * Xuất kho — W1c mở rộng tham số OPTIONAL (giữ hợp đồng cũ):
 *  - `loai_xuat='cu_hong'`: xuất/thanh lý từ KHO HƯ HỎNG — guard trừ NGUYÊN TỬ trên
 *    `ton_cu_hong` (row-guard như W0 làm với `ton`), `ton` không đổi,
 *    don_gia phiếu = NULL (v3.6 ghi dgia 0 — kho hỏng không định giá tồn).
 *    v3.6 dòng 428–451 (phXuatCreate loai_xuat='cu_hong').
 *  - `ly_do='Thanh lý'`: ghi thêm 1 dòng bảng `thanh_ly` (v3.6 phieu_nhap_thanhly;
 *    kích hoạt ở CẢ nhánh thường lẫn cu_hong — nhớt/sơn thanh lý là thập phân nên
 *    cột NUMERIC, không chặn số nguyên ở đây). `gia_thanh_ly` optional (đồng).
 *  - `sc_id` + xuất THƯỜNG: đáp ứng nhu cầu SC → sc_vattu (can_mua|da_mua)→da_xuat
 *    (v3.6 dòng 448). Xuất cu_hong KHÔNG đánh dấu da_xuat (hàng hỏng không phải
 *    hàng thay thế — khác v3.6: v3.6 mark cả loai_xuat cu_hong → autoXuatSC mất
 *    cầu một cách sai; v5 sửa có chủ đích, ghi chú W1c).
 *  - `ngay`: cũ không truyền → NULL như hành vi W0.
 */
export async function xuatKho(
  api: Api,
  p: {
    vattu_id: string; so_luong: number; sc_id?: string; ly_do?: string;
    ngay?: string; gia_thanh_ly?: number; loai_xuat?: string;
  }
): Promise<{ id: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'kho', 'xuat'))) throw new Error('403');
  if (typeof p?.vattu_id !== 'string' || !p.vattu_id.trim()) throw new Error('Thiếu vattu_id');
  const soLuong = requirePositiveNumber(p?.so_luong, 'so_luong');
  optionalStr(p?.ly_do, 'ly_do');
  optionalStr(p?.sc_id, 'sc_id');
  optionalStr(p?.ngay, 'ngay');
  optionalNumber(p?.gia_thanh_ly, 'gia_thanh_ly');
  //whitelist — cùng quy tắc nhapKho: chặn giá trị lạ đổi nhầm sang kho thường.
  if (p?.loai_xuat !== undefined && p?.loai_xuat !== null && p?.loai_xuat !== '' && p.loai_xuat !== 'dung' && p.loai_xuat !== 'cu_hong') {
    throw new Error('loai_xuat không hợp lệ (dung|cu_hong)');
  }
  const isCuHong = p?.loai_xuat === 'cu_hong';
  if (isCuHong) requirePositiveInt(soLuong, 'so_luong (cu_hong)');
  const scId = typeof p?.sc_id === 'string' && p.sc_id.trim() ? p.sc_id.trim() : null;
  const isLoaiTru = typeof p?.ly_do === 'string' && p.ly_do.trim() === LY_DO_THANH_LY;
  //Counter chạy TRƯỚC tx (quy tắc pool W0). Rollback chỉ để lệch số đếm LN —
  //cùng loại hành vi đã chấp nhận với id phiếu NX.
  const id = await nextId('NX');
  const lnId = isLoaiTru ? await nextId('LN') : '';
  //W0.1: bỏ hoàn toàn check-then-act (`SELECT ton` rồi trừ) vốn TOCTOU — 2 lệnh
  //song song cùng đọc ton và cùng trừ (lost update/âm tồn). Phép trừ giờ là
  //row-guard ATOMIC: UPDATE chỉ khớp dòng khi ton còn đủ; ở READ COMMITTED, câu
  //UPDATE đi sau chờ lock của tx trước rồi ĐÁNH GIÁ LẠI điều kiện `ton >= $2`
  //trên giá trị mới nhất đã commit → không bao giờ trừ quá tồn.
  //W1c: nhánh cu_hong áp DỤNG ĐÚNG cơ chế guard đó trên cột ton_cu_hong.
  await withTransaction(async (client) => {
    if (isCuHong) {
      const updHH = await client.query(
        'UPDATE vattu SET ton_cu_hong = ton_cu_hong - $2::integer WHERE id = $1 AND ton_cu_hong >= $2 RETURNING ton_cu_hong',
        [p.vattu_id, soLuong]
      );
      if (updHH.rowCount === 0) {
        //Thiếu tồn hỏng (hoặc vattu không tồn tại) → đọc giá trị hiện hành CHỈ để
        //soạn thông báo; NÉM → withTransaction ROLLBACK toàn bộ (không phiếu, không
        //thanh_ly, không audit).
        const cur = await client.query('SELECT ton_cu_hong FROM vattu WHERE id = $1', [p.vattu_id]);
        const conLai = Number(cur.rows[0]?.ton_cu_hong ?? 0);
        throw new Error(`Không đủ tồn hư hỏng (ton_cu_hong: ${conLai})`);
      }
    } else {
      const upd = await client.query(
        'UPDATE vattu SET ton = ton - $2 WHERE id = $1 AND ton >= $2 RETURNING ton',
        [p.vattu_id, soLuong]
      );
      if (upd.rowCount === 0) {
        //Không đủ tồn (hoặc vattu không tồn tại) → đọc ton hiện hành CHỈ để soạn thông báo,
        //rồi NÉM → withTransaction ROLLBACK: không phiếu xuất, không trừ ton, không audit.
        const cur = await client.query('SELECT ton FROM vattu WHERE id = $1', [p.vattu_id]);
        const tonHienHanh = cur.rows[0]?.ton ?? 0;
        throw new Error(`Thiếu tồn kho (ton: ${tonHienHanh})`);
      }
      if (scId) {
        //Xuất thường gắn SC = hàng thay thế đã lắp → đáp ứng cầu (v3.6 dòng 448).
        //Chỉ kéo dòng còn cầu (can_mua/da_mua); NOT touch da_xuat/da_huy.
        await client.query(
          "UPDATE sc_vattu SET tt = 'da_xuat' WHERE sc_id = $1 AND vattu_id = $2 AND tt IN ('can_mua','da_mua') AND deleted_at = ''",
          [scId, p.vattu_id]
        );
      }
    }
    //W1a: xuất đơn dòng → phieu_id tự tham chiếu (nhóm 1 dòng; id tách $7, lý do như nhapKho)
    await client.query(
      "INSERT INTO nhap_xuat (id,vattu_id,loai,so_luong,ngay,sc_id,ly_do,nguoi,phieu_id) VALUES ($1,$2,'xuat',$3,$4,$5,$6,$7,$8)",
      [id, p.vattu_id, soLuong, p.ngay?.trim() || null, scId, p.ly_do ?? null, u?.id ?? null, id]
    );
    if (isLoaiTru) {
      //Dòng thanh lý (v3.6 phieu_nhap_thanhly) — cùng tx với phiếu xuất: phiếu rollback
      //thì không để lại dòng thanh lý "ma". so_luong NUMERIC giữ nguyên thập phân
      //của xuất thường (lít/dung dịch).
      await client.query(
        'INSERT INTO thanh_ly (id,sc_id,vattu_id,so_luong,gia_thanh_ly,ly_do,ngay,is_test) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [
          lnId, scId, p.vattu_id, soLuong,
          Number(p.gia_thanh_ly ?? 0), LY_DO_THANH_LY,
          p.ngay?.trim() || todayStr(), role === 'admin' ? 1 : 0,
        ]
      );
    }
    await auditTx(client, { actor_id: u?.id, actor_role: role, hanh_dong: 'kho_xuat', doi_tuong: 'nhap_xuat', doi_tuong_id: id, sc_id: scId ?? undefined, mo_ta: isCuHong ? 'Xuất kho hư hỏng ' + (isLoaiTru ? '(thanh ly) ' : '') + id : undefined, is_test: role === 'admin' ? 1 : 0 });
    //W1c: autoXuatSC/autoGenCuHong là HÀM CORE ĐỘC LẬP (cuối file) — không gọi inline
    //từ đây để hành vi W1a/W1b giữ nguyên bitwise; hook gọi nằm ở lớp RPC/W3 (TODO đó).
  });
  invalidateDashCache(); // W3.2-wire (post-commit): xuất kho → ton/nhap_xuat → KPI dash đổi
  return { id };
}

export async function dmCreate(
  api: Api,
  p: { sc_id?: string; items: { vattu_id: string; so_luong: number; don_gia?: number }[]; ngay: string }
): Promise<{ id: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'kho', 'tao'))) throw new Error('403');
  if (!Array.isArray(p?.items) || p.items.length === 0) throw new Error('Thiếu items');
  if (typeof p?.ngay !== 'string' || !p.ngay.trim()) throw new Error('Thiếu ngay');
  // Validate từng item TRƯỚC khi ghi DB (tránh dm "mồ côi" khi item giữa danh sách lỗi)
  for (const it of p.items) {
    if (typeof it?.vattu_id !== 'string' || !it.vattu_id.trim()) throw new Error('items: thiếu vattu_id');
    requirePositiveNumber(it?.so_luong, 'items: so_luong');
    optionalNumber(it?.don_gia, 'items: don_gia');
  }
  const isTest = role === 'admin' ? 1 : 0;
  const id = await nextId('DM');
  const tong = p.items.reduce((s, it) => s + it.so_luong * (it.don_gia ?? 0), 0);
  await run(
    "INSERT INTO dm (id,sc_id,trang_thai,nguoi_tao,ngay_tao,tong,is_test) VALUES ($1,$2,'cho_duyet',$3,$4,$5,$6)",
    [id, p.sc_id ?? null, u?.id ?? null, p.ngay, tong, isTest]
  );
  for (const it of p.items) {
    const ctId = await nextId('DMCT');
    await run(
      'INSERT INTO dm_chitiet (id,dm_id,vattu_id,so_luong,don_gia) VALUES ($1,$2,$3,$4,$5)',
      [ctId, id, it.vattu_id, it.so_luong, it.don_gia ?? null]
    );
  }
  try {
    await logActivity(api.db, { actor_id: u?.id, actor_role: role, hanh_dong: 'dm_tao', doi_tuong: 'dm', doi_tuong_id: id, sc_id: p.sc_id, is_test: isTest });
  } catch (e) {
    log.logError('logActivity dm_tao failed', e, { id, sc_id: p.sc_id });
  }
  invalidateDashCache(); // W3.2-wire: DM gắn sc_id → cột dash ứng viên (chủ động)
  return { id };
}

/**
 * Nhập tồn kho theo đề nghị mua (W2c — siết guard theo v3.6).
 * v3.6 đối chiếu: kho.js phNhapCreate dòng 341–343 —
 *   `if (!dm || dm.trang_thai !== 'da_duyet') return {ok:false, error:'Đề nghị mua chưa duyệt.'}`
 * Nghĩa là phiếu nhập lập TỪ DM chỉ được khi DM đã Giám đốc/kế-toán-duyệt;
 * DM `cho_duyet`/`tu_choi`/không tồn tại → chặn. V5 giữ NGUYÊN hành vi đó,
 * diễn đạt lại theo hợp đồng W2c: 'Chỉ nhập khi đề nghị đã duyệt.' — điều
 * kiện `!== 'da_duyet'` cũng chặn luôn DM đã `da_nhap` (chống nhập lặp
 * cộng ton hai lần — v3.6 vốn cùng nhánh chặn). Trả envelope {ok:false,
 * error} (HTTP 200, pattern dmDelete/dmDecide W2a-W2b) thay vì throw: đây
 * là lỗi NGHIỆP VỤ sau gate quyền, không phải lỗi input.
 */
export async function dmNhap(
  api: Api,
  p: { dm_id: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'kho', 'tao'))) throw new Error('403');
  if (typeof p?.dm_id !== 'string' || !p.dm_id.trim()) throw new Error('Thiếu dm_id');
  //W0.1: TOÀN BỘ vòng items + đổi trạng thái DM + audit trong 1 tx.
  //Lỗi giữa vòng (vd vattu_id gãy FK) → ROLLBACK: không "nhập nửa DM" (ton đã tăng
  //một phần trong khi dm vẫn 'cho_duyet'). SELECT ... FOR UPDATE khóa dòng dm →
  //2 lệnh dmNhap song song trên CÙNG dm tuần tự hóa, không cộng ton chồng chéo
  //trước khi tx thứ nhất commit. Realtime: trigger pg_notify trên vattu/dm chỉ
  //phát tín hiệu sau COMMIT (hành vi PostgreSQL) → subscriber không thấy dữ liệu ma.
  const isTest = role === 'admin' ? 1 : 0;
  //W1a: nhập DM = lập PHIẾU NHẬP 2 tầng — MỌI dòng dm_chitiet trở thành một
  //dòng nhap_xuat (loai='nhap') Chung MỘT phieu_id = id dòng đầu nhóm.
  //nextId chạy connection riêng → phải lấy đủ id TRƯỚC khi mở tx (cùng quy tắc W0:
  //counter không được gọi lồng trong withTransaction, chống hết pool).
  //W2c: id lấy thừa cho DM chưa được duyệt chỉ để lại HỔ counter (không ghi dòng
  //nào) — đúng như v3.6: nextId('PXN') chạy TRƯỚC guard trong phNhapCreate.
  const preRows = await api.db.query(
    'SELECT vattu_id, so_luong, don_gia FROM dm_chitiet WHERE dm_id = $1 AND deleted_at = $2 ORDER BY id',
    [p.dm_id, '']
  );
  const ids: string[] = [];
  for (let i = 0; i < preRows.rows.length; i++) ids.push(await nextId('NX'));
  const phieuId = ids[0] ?? '';
  return await withTransaction(async (client): Promise<{ ok: true } | { ok: false; error: string }> => {
    //W2c: ĐỌC + KHÓA một mạch (gom 2 SELECT cũ làm MỘT — lock vẫn lấy TRƯỚC
    //mọi suy biến). Guard trạng thái đặt TRƯỚC khi cộng ton/update: DM chưa
    //duyệt không được phép chạm vào vattu.ton. DM xóa-mềm còn 'cho_duyet' cũng
    //rơi vào nhánh chặn này → luôn bị từ chối (chặt hơn v3.6, đúng chiều).
    const dmInfo = (await client.query(
      'SELECT trang_thai,ngay_tao,sc_id FROM dm WHERE id = $1 FOR UPDATE',
      [p.dm_id]
    )).rows[0];
    if (!dmInfo || dmInfo.trang_thai !== 'da_duyet') {
      return { ok: false, error: 'Chỉ nhập khi đề nghị đã duyệt.' };
    }
    const rows = (await client.query(
      "SELECT vattu_id,so_luong,don_gia FROM dm_chitiet WHERE dm_id=$1 AND deleted_at='' ORDER BY id",
      [p.dm_id]
    )).rows;
    if (rows.length > ids.length) throw new Error('DM thay đổi đồng thời, thử lại');
    for (let i = 0; i < rows.length; i++) {
      const d = rows[i];
      //Nhập = tăng tồn → không cần WHERE-guard (không thể sinh tồn âm từ phép cộng)
      await client.query('UPDATE vattu SET ton = ton + $2 WHERE id = $1', [d.vattu_id, d.so_luong]);
      await client.query(
        "INSERT INTO nhap_xuat (id,vattu_id,loai,so_luong,don_gia,ngay,ly_do,nguoi,sc_id,phieu_id,is_test) VALUES ($1,$2,'nhap',$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          ids[i], d.vattu_id, d.so_luong, d.don_gia ?? null,
          dmInfo?.ngay_tao ?? null, 'Nhập DM ' + p.dm_id, u?.id ?? null,
          dmInfo?.sc_id ?? null, phieuId, isTest,
        ]
      );
      //W1b: cột THỰC của dm_chitiet là `don_gia` (không có don_gia_tuong_uc — đã tra
      //schema). Giá > 0 → ghi mốc loai='dm', ngay = ngay tạo DM (cùng giá trị ghi
      //vào nhap_xuat ở trên) — fallback today() nếu dòng dm thiếu ngay_tao (NOT NULL
      //của bảng lịch sử; dmCreate vốn validate ngay nhưng giữ defense-in-depth).
      await ghiGiaLichSu(client, {
        vattu_id: d.vattu_id, gia: d.don_gia, loai: 'dm',
        phieu_id: phieuId, ngay: dmInfo?.ngay_tao || todayStr(), created_by: u?.id ?? '', is_test: isTest,
      });
    }
    await client.query("UPDATE dm SET trang_thai='da_nhap' WHERE id=$1", [p.dm_id]);
    await auditTx(client, { actor_id: u?.id, actor_role: role, hanh_dong: 'dm_nhap', doi_tuong: 'dm', doi_tuong_id: p.dm_id, sc_id: dmInfo?.sc_id ?? null, is_test: isTest });
    invalidateDashCache(); // W3.2-wire (end-of-tx): dmNhap đổi ton → KPI dash đổi
    return { ok: true };
  });
}

// ═════════════════════════════════════════════════════════════════════
// W1a — PHIẾU NHẬP/XUẤT 2 TẦNG (kiểu v3.6 phieu_nhap + phieu_nh_ct,
// nhưng TỐI GIỂU: không lập bảng header riêng; effective group id =
// COALESCE(NULLIF(phieu_id,''), id) — dòng đơn cũ (phieu_id='') tự thành
// nhóm 1 dòng → tương thích lùi tuyệt đối với dữ liệu W0 và cũ hơn.)
// ═════════════════════════════════════════════════════════════════════

/** Biểu thức SQL xác định nhóm phiếu — dùng chung SELECT/WHERE/GROUP BY. */
const EFF_GROUP_SQL = (alias = '') =>
  `COALESCE(NULLIF(${alias}phieu_id, ''), ${alias}id)`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function phieuList(
  api: Api,
  p: { loai?: string; sc_id?: string; from?: string; to?: string; limit?: number; offset?: number }
): Promise<{ ok: true; result: any[]; total: number }> {
  //Quy tắc dispatch: META ['kho','xem'] đã check ở lớp RPC — hàm không check lại.
  optionalStr(p?.loai, 'loai');
  optionalStr(p?.sc_id, 'sc_id');
  optionalStr(p?.from, 'from');
  optionalStr(p?.to, 'to');
  if (p?.loai && p.loai !== 'nhap' && p.loai !== 'xuat') {
    // whitelist — chặn mọi giá trị lạ chui vào tham số query
    throw new Error('loai không hợp lệ (nhap|xuat)');
  }
  if (p?.from && !DATE_RE.test(p.from)) throw new Error('from phải dạng YYYY-MM-DD');
  if (p?.to && !DATE_RE.test(p.to)) throw new Error('to phải dạng YYYY-MM-DD');
  if (p?.limit !== undefined) {
    if (!Number.isInteger(Number(p.limit)) || Number(p.limit) < 1 || Number(p.limit) > 200) {
      throw new Error('limit phải là số nguyên 1..200');
    }
  }
  if (p?.offset !== undefined) {
    if (!Number.isInteger(Number(p.offset)) || Number(p.offset) < 0) {
      throw new Error('offset phải là số nguyên >= 0');
    }
  }
  const limit = p?.limit === undefined ? 50 : Number(p.limit);
  const offset = p?.offset === undefined ? 0 : Number(p.offset);

  const where: string[] = [`nx.deleted_at = ''`];
  const params: any[] = [];
  if (p?.loai) where.push(`nx.loai = $${params.push(p.loai)}`);
  if (p?.sc_id) where.push(`nx.sc_id = $${params.push(p.sc_id)}`);
  if (p?.from) where.push(`nx.ngay >= $${params.push(p.from)}`);
  if (p?.to) where.push(`nx.ngay <= $${params.push(p.to)}`);
  const whereSql = where.join(' AND ');
  const eff = EFF_GROUP_SQL('nx.');

  // GROUP BY eff + loai: một phiếu chỉ mang 1 loại, thêm loai vào GROUP BY
  // để thỏa quy tắc aggregate của PG mà KHÔNG tách nhóm (hành vi như chốt).
  // params cho WHERE lọc (CHƯA gồm LIMIT/OFFSET) — totalSql dùng đúng số placeholder này
  const filterParams = params.slice();
  const dataSql =
    `SELECT ${eff} AS id, nx.loai AS loai, MIN(nx.ngay) AS ngay, MAX(nx.ncc) AS ncc, ` +
    `MAX(nx.ly_do) AS ly_do, MAX(nx.sc_id) AS sc_id, COUNT(*)::int AS so_dong, ` +
    `COALESCE(SUM(nx.so_luong * COALESCE(nx.don_gia, 0)), 0)::float8 AS tong_tien ` +
    `FROM nhap_xuat nx WHERE ${whereSql} ` +
    `GROUP BY ${eff}, nx.loai ` +
    `ORDER BY MIN(nx.ngay) DESC NULLS LAST, id DESC ` +
    `LIMIT $${params.push(limit)} OFFSET $${params.push(offset)}`;
  const totalSql =
    `SELECT COUNT(*)::int AS total FROM (SELECT 1 FROM nhap_xuat nx WHERE ${whereSql} ` +
    `GROUP BY ${eff}, nx.loai) t`;

  const [dataRes, totalRes] = await Promise.all([
    api.db.query(dataSql, params),
    api.db.query(totalSql, filterParams),
  ]);
  return { ok: true, result: dataRes.rows, total: totalRes.rows[0].total };
}

export async function phieuGet(
  api: Api,
  p: { id: string }
): Promise<{ ok: true; result: { header: any; lines: any[]; so_dong: number; tong_tien: number } }> {
  if (typeof p?.id !== 'string' || !p.id.trim()) throw new Error('Thiếu id');
  const r = await api.db.query(
    `SELECT nx.id, ${EFF_GROUP_SQL('nx.')} AS phieu, nx.loai, nx.vattu_id, nx.so_luong, nx.don_gia, ` +
      `nx.ngay, nx.ncc, nx.ly_do, nx.sc_id, nx.nguoi, v.ten, v.don_vi ` +
      `FROM nhap_xuat nx JOIN vattu v ON v.id = nx.vattu_id ` +
      `WHERE nx.deleted_at = '' AND ${EFF_GROUP_SQL('nx.')} = $1 ` +
      `ORDER BY nx.id`,
    [p.id]
  );
  if (r.rows.length === 0) {
    //Route map 401/403/Unknown-fn còn lại 400 — mã nghiệp vụ '404' đưa vào message
    //để client nhận diện (không đổi contract HTTP của /api/rpc ngoài danh sách file).
    throw new Error('404: không tìm thấy phiếu');
  }
  const num = (v: any) => (v === null || v === undefined ? null : Number(v));
  let tongTien = 0;
  const lines = r.rows.map((ln: any) => {
    const soLuong = num(ln.so_luong);
    const donGia = num(ln.don_gia);
    const thanh = (soLuong ?? 0) * (donGia ?? 0);
    tongTien += thanh;
    return {
      id: ln.id,
      vattu_id: ln.vattu_id,
      ten: ln.ten,
      don_vi: ln.don_vi,
      so_luong: soLuong,
      don_gia: donGia,
      thanh_tien: thanh,
    };
  });
  const h = r.rows[0]; //dòng đầu nhóm (id nhỏ nhất == eff) — metadata header
  return {
    ok: true,
    result: {
      header: {
        id: p.id,
        loai: h.loai,
        ngay: h.ngay,
        ncc: h.ncc,
        ly_do: h.ly_do,
        sc_id: h.sc_id,
        nguoi: h.nguoi,
      },
      lines,
      so_dong: lines.length,
      tong_tien: tongTien,
    },
  };
}

// ═════════════════════════════════════════════════════════════════════
// W1b — TỒN KHO + LỊCH SỬ GIÁ (port v3.6 kho.js: tonKho dòng 79–94,
// ghiGiaLichSu dòng 259–266, giaLichSuList dòng 268–277 — hành vi chuẩn
// v3.6 nhưng cột/bảng theo schema v5 thật: không có cột `ten`/`nguon`
// riêng, dùng loai='nhap'|'dm' + created_by thay dấu vết).
// quy ước hàm mới: KHÔNG ném ra ngoài — lỗi input trả {ok:false,error}
// (khác contract cũ nhapKho/xuatKho vẫn throw; không sửa contract cũ).
// ═════════════════════════════════════════════════════════════════════

/** Ngày hệ thống dạng YYYY-MM-DD (đồng nhất today() các suite conformance). */
function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Ghi MỘT mốc giá vào `vattu_gia_lich_su` — PHẢI chạy trong transaction của
 * caller (client được truyền vào; không động tới pool — quy tắc withTransaction).
 * Hành vi v3.6: giá không hợp lệ (≤0 / NaN / Infinity) → KHÔNG ghi (dòng 260).
 * Khác v3.6 (chốt trong spec W1b):
 *  - `ngay` do caller truyền (theo phiếu), không phải today() cứng;
 *  - dedupe nhanh: dòng CUỐI CÙNG của chính vật tư đó có cùng (gia, ngay) → bỏ
 *    qua (chống nhập đi nhập lại cùng giá trong ngày sinh rác lịch sử).
 * whitelist `loai`: ngoài 'dm' đều về 'nhap' — chặn giá trị lạ chui vào DB.
 * Return true khi thực sự ghi (hữu ích cho test/log; caller thường bỏ qua).
 */
export async function ghiGiaLichSu(
  client: PoolClient,
  p: {
    vattu_id: string;
    gia: any;
    loai?: string;
    phieu_id?: string;
    ngay: string;
    ncc?: string;
    created_by?: string;
    is_test?: number;
  }
): Promise<boolean> {
  const g = Number(p.gia);
  if (!Number.isFinite(g) || g <= 0) return false;
  if (typeof p?.vattu_id !== 'string' || !p.vattu_id.trim()) return false;
  if (typeof p?.ngay !== 'string' || !p.ngay.trim()) return false;
  const loai = p.loai === 'dm' ? 'dm' : 'nhap';
  //Dedupe "liên tiếp": chỉ so dòng mới nhất của đúng vật tư (index
  //idx_vgl_vattu_ngay phục vụ lookup theo vattu_id; bảng nhỏ, ORDER id DESC LIMIT 1 rẻ).
  const last = await client.query(
    "SELECT gia, ngay FROM vattu_gia_lich_su WHERE vattu_id = $1 AND deleted_at = '' ORDER BY id DESC LIMIT 1",
    [p.vattu_id]
  );
  if (last.rows.length && Number(last.rows[0].gia) === g && last.rows[0].ngay === p.ngay) {
    return false;
  }
  await client.query(
    'INSERT INTO vattu_gia_lich_su (vattu_id, gia, ncc, loai, phieu_id, ngay, created_by, is_test) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [p.vattu_id, g, p.ncc ?? '', loai, p.phieu_id ?? '', p.ngay, p.created_by ?? '', p.is_test ?? 0]
  );
  return true;
}

/**
 * Đọc lịch sử giá của MỘT vật tư (meta quyền ['kho','xem'] do lớp RPC đảm nhiệm
 * khi đăng ký W1b-reg — handler không check lại, quy tắc như phieuList).
 * khac v3.6 (LIMIT 200/vattu): spec W1b chốt mặc định 8 mốc mới nhất, max 30 —
 * UI chỉ cần vài dòng gần nhất; client muốn nhiều hơn truyền limit (đã chặn trần).
 */
export async function giaLichSuList(
  _api: Api,
  p: { vattu_id?: any; limit?: any }
): Promise<{ ok: boolean; result?: any[]; error?: string }> {
  if (typeof p?.vattu_id !== 'string' || !p.vattu_id.trim() || p.vattu_id.length > 12) {
    return { ok: false, error: 'vattu_id phải là chuỗi 1..12 ký tự' };
  }
  let limit = 8;
  if (p?.limit !== undefined && p?.limit !== null && p?.limit !== '') {
    const n = Number(p.limit);
    if (!Number.isInteger(n) || n < 1 || n > 30) {
      return { ok: false, error: 'limit phải là số nguyên 1..30' };
    }
    limit = n;
  }
  const r = await _api.db.query(
    'SELECT id, vattu_id, gia, ncc, loai, ngay, phieu_id FROM vattu_gia_lich_su ' +
      "WHERE vattu_id = $1 AND deleted_at = '' ORDER BY ngay DESC, id DESC LIMIT $2",
    [p.vattu_id, limit]
  );
  return { ok: true, result: r.rows.map((x) => ({ ...x, gia: Number(x.gia) })) };
}

/**
 * Tồn kho + cảnh báo thiếu (port v3.6 tonKho dòng 79–94, thêm phân trang + tổng
 * giá trị theo yêu cầu W1b). READ-ONLY — quyền ['kho','xem'] ở lớp RPC (W1b-reg).
 *  - Bộ lọc dòng đang dùng: deleted_at='' AND is_test=0 (khác v3.6 chỉ deleted_at —
 *    v5 có is_test, dữ liệu test admin tạo không được lẫn vào sổ kho).
 *  - thieu = ton − ton_min (ÂM = đang thiếu; giữ nguyên công thức SQL theo spec —
 *    v3.6 trả Math.max(0, ton_min−ton), ở đây expose cả 2: low flag = ton<ton_min).
 *  - giaTriTonKho/total/lowCount tính BẰNG SQL trên TOÀN BỘ dòng active (1 subquery
 *    aggregate), KHÔNG sum mảng JS của trang phân trang → số không đổi giữa trang.
 *  - W1c: cột `ton_cu_hong` ĐÃ có (db/schema.sql) → expose per-item như v3.6 dòng 87.
 *    QUY ƯỚC GIÁ TRỊ (chốt W1c, như v3.6 dòng 92): giaTriTonKho chỉ ton×gia — kho hỏng
 *    KHÔNG định giá vào tồn (giá trị thực của nó = gia_thanh_ly trên bảng thanh_ly).
 */
export async function tonKho(
  api: Api,
  p: { low_only?: any; page?: any; limit?: any } = {}
): Promise<{ ok: boolean; result?: any; error?: string }> {
  if (p?.low_only !== undefined && p?.low_only !== null && typeof p.low_only !== 'boolean') {
    return { ok: false, error: 'low_only phải là boolean' };
  }
  let page = 1;
  if (p?.page !== undefined && p?.page !== null && p?.page !== '') {
    const n = Number(p.page);
    if (!Number.isInteger(n) || n < 1) return { ok: false, error: 'page phải là số nguyên >= 1' };
    page = n;
  }
  let limit = 50;
  if (p?.limit !== undefined && p?.limit !== null && p?.limit !== '') {
    const n = Number(p.limit);
    if (!Number.isInteger(n) || n < 1 || n > 200) {
      return { ok: false, error: 'limit phải là số nguyên 1..200' };
    }
    limit = n;
  }
  const offset = (page - 1) * limit;
  const baseWhere = "deleted_at = '' AND is_test = 0";
  const LOW = 'ton < ton_min';
  const listWhere = p.low_only ? `${baseWhere} AND ${LOW}` : baseWhere;
  //W1c: ton_cu_hong vào SELECT (contract mới cho UI kho — worker-c đăng ký meta).
  const [itemsRes, aggRes] = await Promise.all([
    api.db.query(
      `SELECT id, ten, don_vi, gia, ton, ton_min, ton_cu_hong, ` +
        `(ton - ton_min) AS thieu, (ton < ton_min) AS low, (gia * ton) AS gia_tri ` +
        `FROM vattu WHERE ${listWhere} ` +
        `ORDER BY (ton - ton_min) ASC, ten ASC LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    //Aggregate MỘT lần trên toàn bộ dòng active — không phụ thuộc trang/lọc low_only
    //→ total/lowCount/giaTriTonKho ổn định mọi page (low_only chỉ cắt items+total).
    api.db.query(
      `SELECT COUNT(*)::int AS total_all, ` +
        `COUNT(*) FILTER (WHERE ${LOW})::int AS low_count, ` +
        `COALESCE(SUM(gia * ton), 0)::float8 AS gia_tri_ton_kho ` +
        `FROM vattu WHERE ${baseWhere}`
    ),
  ]);
  const agg = aggRes.rows[0] ?? { total_all: 0, low_count: 0, gia_tri_ton_kho: 0 };
  const num = (v: any) => Number(v ?? 0);
  return {
    ok: true,
    result: {
      items: itemsRes.rows.map((r) => ({
        id: r.id,
        ten: r.ten,
        don_vi: r.don_vi ?? '',
        gia: num(r.gia),
        ton: num(r.ton),
        ton_min: num(r.ton_min),
        ton_cu_hong: num(r.ton_cu_hong),
        thieu: num(r.thieu),
        low: !!r.low,
        gia_tri: num(r.gia_tri),
      })),
      total: p.low_only ? agg.low_count : agg.total_all,
      page,
      limit,
      giaTriTonKho: num(agg.gia_tri_ton_kho),
      lowCount: agg.low_count,
    },
  };
}

// ═════════════════════════════════════════════════════════════════════
// W1c — THANH LÝ READ + AUTO THU HỒI (cu_hong) + AUTO XUẤT ĐỦ
// Port v3.6 kho.js: thanhLyList (456), autoGenCuHong (478), autoXuatSC (281).
// Hai hàm auto là CORE ĐỘC LẬP, CHƯA wire RPC (lib/rpc.ts thuộc worker-c) —
// TODO(W3): scHoanThanh hook gọi autoGenCuHong API-internal; lớp RPC đăng ký
// meta + expose autoXuatSC khi UI cần nút manual. Test conformance gọi TRỰC
// TIẾP hàm core (pattern kho_tonkho/kho_phieu2tang).
// ═════════════════════════════════════════════════════════════════════

/** Lý do phiếu xuất tự động (v3.6 ghi_chu dòng 299 — giữ nguyên chuỗi để truy vết). */
const AUTO_XUAT_LY_DO = 'Xuất tự động khi nhập đủ vật tư (liên thông)';
/** SC cho phép autoGenCuHong. v3.6: ['dang_sua','cho_nghiem','da_hoan'] — enum v5
 *  không có 'cho_nghiem', chốt W1c thay bằng 'da_quyet' (thu hồi sau quyết toán vẫn
 *  hợp lệ nghiệp vụ; ghi chú lệch). */
const CU_HONG_SC_STATES = ['dang_sua', 'da_hoan', 'da_quyet'];

/**
 * Đếm "đã nhập cho SC" theo vật tư — v3.6: SUM(phieu_nh_ct.so_luong WHERE ref_sc
 * AND vattu_id). v5: line nhap_xuat.sc_id ↔ sc_vattu (W1a cõng sc_id qua dm).
 * TRỪ dòng mang THU_HOI_MARKER: đó là phiếu thu hồi kho hỏng — KHÔNG tăng `ton`
 * nên không được tính đáp ứng cầu (khác v3.6: đếm cả cu_hong → PXX trừ ton không
 * có nguồn thu → âm tồn; v5 sửa có chủ đích, ghi Production Check).
 * MAX(don_gia) = giá nhập gần nhất của đợt SC này → đơn giá dòng xuất (v3.6
 * r.gia_ngay || cat.gia ở dòng 305).
 */
async function sumNhapTheoSc(
  q: { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> },
  scId: string,
  vattuId: string,
): Promise<{ soLuong: number; giaMax: number }> {
  const r = await q.query(
    "SELECT COALESCE(SUM(so_luong),0)::float8 AS s, MAX(don_gia)::float8 AS g FROM nhap_xuat " +
    "WHERE loai = 'nhap' AND deleted_at = '' AND sc_id = $1 AND vattu_id = $2 AND COALESCE(ly_do, '') <> $3",
    [scId, vattuId, THU_HOI_MARKER]
  );
  return { soLuong: Number(r.rows[0]?.s ?? 0), giaMax: Number(r.rows[0]?.g ?? 0) };
}

/** Danh sách cầu SC còn mở (tt IN can_mua/da_mua — v3.6 autoXuatSC dòng 284). */
const SC_NEED_SQL =
  "SELECT sv.id, sv.vattu_id, sv.so_luong, (v.id IS NOT NULL) AS vt_ok, v.gia AS vt_gia " +
  "FROM sc_vattu sv LEFT JOIN vattu v ON v.id = sv.vattu_id AND v.deleted_at = '' " +
  "WHERE sv.sc_id = $1 AND sv.tt IN ('can_mua','da_mua') AND sv.deleted_at = '' ORDER BY sv.id";

/**
 * Đọc dòng thanh lý (v3.6 thanhLyList dòng 456 — bảng phieu_nhap_thanhly → v5
 * `thanh_ly`). READ-ONLY; meta ['kho','xem'] do lớp RPC đảm khi đăng ký (W1.6-reg).
 * Khách biệt v3.6:
 *  - v3.6 lọc sc qua subquery ref_sc của phieu_nh_ct (chỉ dòng NHẬP) → thanh lý từ
 *    XUẤT có sc_id; v5 loc trực tiếp `t.sc_id` (dòng thanh_ly luôn mang sc_id của
 *    phiếu sinh ra nó — autoGen + xuatKho cùng ghi).
 *  - v3.6 LIMIT 500 cứng → v5 phân trang chuẩn suite: mặc định 50, trần 200, có total.
 *  - KHÔNG lọc is_test (nhất quán phieuList — dữ liệu test của admin có thể cần xem).
 */
export async function thanhLyList(
  api: Api,
  //KIỂU `any` cho field ngoài `from/to/sc_id`: RPC JSON có thể gửi number/'' —
  //mọi giá trị đều được_validate lại bên dưới (contract tonKho cùng convention).
  p: { from?: string; to?: string; sc_id?: string; limit?: any; offset?: any } = {}
): Promise<{ ok: boolean; result?: any[]; total?: number; error?: string }> {
  for (const key of ['from', 'to', 'sc_id'] as const) {
    const v = p?.[key];
    if (v !== undefined && v !== null && v !== '' && typeof v !== 'string') {
      return { ok: false, error: key + ' phải là chuỗi' };
    }
  }
  if (p?.from && !DATE_RE.test(p.from)) return { ok: false, error: 'from phải dạng YYYY-MM-DD' };
  if (p?.to && !DATE_RE.test(p.to)) return { ok: false, error: 'to phải dạng YYYY-MM-DD' };
  let limit = 50;
  if (p?.limit !== undefined && p?.limit !== null && p?.limit !== '') {
    const n = Number(p.limit);
    if (!Number.isInteger(n) || n < 1 || n > 200) return { ok: false, error: 'limit phải là số nguyên 1..200' };
    limit = n;
  }
  let offset = 0;
  if (p?.offset !== undefined && p?.offset !== null && p?.offset !== '') {
    const n = Number(p.offset);
    if (!Number.isInteger(n) || n < 0) return { ok: false, error: 'offset phải là số nguyên >= 0' };
    offset = n;
  }
  const where: string[] = [`t.deleted_at = ''`];
  const params: any[] = [];
  if (p?.sc_id) where.push(`t.sc_id = $${params.push(p.sc_id)}`);
  if (p?.from) where.push(`COALESCE(t.ngay,'') >= $${params.push(p.from)}`);
  if (p?.to) where.push(`COALESCE(t.ngay,'') <= $${params.push(p.to)}`);
  const whereSql = where.join(' AND ');
  const [dataRes, totalRes] = await Promise.all([
    api.db.query(
      `SELECT t.id, t.sc_id, t.vattu_id, t.so_luong, t.gia_thanh_ly, t.ly_do, t.ngay, t.is_test, ` +
      `v.ten AS vattu_ten, v.don_vi AS vattu_don_vi ` +
      `FROM thanh_ly t LEFT JOIN vattu v ON v.id = t.vattu_id ` +
      `WHERE ${whereSql} ORDER BY t.ngay DESC NULLS LAST, t.id DESC LIMIT $${params.push(limit)} OFFSET $${params.push(offset)}`,
      params
    ),
    api.db.query(`SELECT COUNT(*)::int AS total FROM thanh_ly t WHERE ${whereSql}`, params.slice(0, -2)),
  ]);
  const num = (v: any) => Number(v ?? 0);
  return {
    ok: true,
    result: dataRes.rows.map((r) => ({
      ...r,
      so_luong: num(r.so_luong),
      gia_thanh_ly: num(r.gia_thanh_ly),
    })),
    total: totalRes.rows[0]?.total ?? 0,
  };
}

/**
 * AUTO THU HỒI VT cũ/hỏng (v3.6 autoGenCuHong dòng 478): SC đang sửa/hoàn/quyết
 * toán → mọi sc_vattu loai_xu_ly thay thế (chấp nhận 'thay_the' v3.6 VÀ 'thay_moi'
 * enum v5) tạo MỘT phiếu nhập nhóm (phieu_id = dòng đầu, W1a) loại thu hồi:
 *  - dòng mang ly_do = THU_HOI_MARKER + ncc 'Thu hồi nội bộ' — KHÔNG vào `ton`;
 *  - vattu.ton_cu_hong += so_luong (INTEGER — chặn thập phân từ trước);
 *  - mỗi dòng ghi 1 `thanh_ly` (v3.6 507–508: ly_do 'Thay thế — tự động từ SC…', giá 0);
 *  - chống trùng theo CẶP (sc_id, vattu_id): dòng nào đã có phiếu thu hồi → loại khỏi
 *    đợt tạo (tốt hơn v3.6 — chặn cả-level SC → không thể bù VT thay thế mới phát sinh).
 * CHƯA wire RPC — hook nội bộ (W3 scHoanThanh).
 */
export async function autoGenCuHong(
  api: Api,
  p: { sc_id?: string }
): Promise<{ ok: boolean; id?: string; so_dong?: number; error?: string }> {
  const u = api.auth.current();
  const role = u?.role;
  //v3.6 checkLock('kho','tao') — kế thừa throw '403' như họ hàm kho.ts cũ.
  if (!(role && await api.perm.can(api.db, role, 'kho', 'tao'))) throw new Error('403');
  if (typeof p?.sc_id !== 'string' || !p.sc_id.trim()) return { ok: false, error: 'Thiếu sc_id' };
  const scId = p.sc_id.trim();
  const sc = await api.db.query('SELECT id, trang_thai FROM sc WHERE id = $1 AND deleted_at = $2', [scId, '']);
  if (!sc.rows.length) return { ok: false, error: 'Không tìm thấy phiếu sửa chữa.' };
  if (!CU_HONG_SC_STATES.includes(sc.rows[0].trang_thai)) {
    return { ok: false, error: 'Chỉ tạo VT cũ/hỏng khi phiếu đang sửa/đã hoàn/đã quyết toán.' };
  }
  const CU_HONG_FILTER_SQL =
    "SELECT sv.id, sv.vattu_id, sv.so_luong FROM sc_vattu sv " +
    "WHERE sv.sc_id = $1 " +
    "AND lower(btrim(sv.loai_xu_ly)) IN ('thay_the','thay_moi') " +
    "AND sv.deleted_at = '' AND sv.so_luong > 0 " +
    "AND NOT EXISTS (SELECT 1 FROM nhap_xuat nx WHERE nx.sc_id = sv.sc_id AND nx.vattu_id = sv.vattu_id " +
    "AND nx.loai = 'nhap' AND nx.deleted_at = '' AND COALESCE(nx.ly_do, '') = $2) ORDER BY sv.id";
  const thayRes = await api.db.query(CU_HONG_FILTER_SQL, [scId, THU_HOI_MARKER]);
  const thay = thayRes.rows;
  if (thay.length === 0) {
    //phân biệt 'không có VT thay thế' vs 'đã tạo rồi' — đọc tổng source không chống trùng
    const src = await api.db.query(
      "SELECT COUNT(*)::int AS c FROM sc_vattu WHERE sc_id = $1 " +
      "AND lower(btrim(loai_xu_ly)) IN ('thay_the','thay_moi') AND deleted_at = '' AND so_luong > 0",
      [scId]
    );
    const tongSource = src.rows[0]?.c ?? 0;
    return {
      ok: false,
      error: tongSource > 0 ? 'Phiếu này đã tạo nhập VT cũ/hỏng rồi.' : 'Phiếu này không có vật tư loại thay thế.',
    };
  }
  for (const t of thay) {
    if (!Number.isInteger(Number(t.so_luong))) {
      return { ok: false, error: `sc_vattu ${t.id}: so_luong phải nguyên để vào kho hỏng (INTEGER)` };
    }
  }
  //Giữ đúng quy tắc pool: MỌI nextId chạy connection riêng TRƯỚC khi mở tx.
  const nxIds: string[] = [];
  const lnIds: string[] = [];
  for (let i = 0; i < thay.length; i++) { nxIds.push(await nextId('NX')); lnIds.push(await nextId('LN')); }
  const phieuId = nxIds[0];
  const isTest = role === 'admin' ? 1 : 0;
  const ngay = todayStr();
  const out = await withTransaction(async (client) => {
    //Lock SC → 2 lần autoGensong song trên cùng SC tuần tự hóa: kẻ đến sau re-read
    //chống trùng SAU khi đối thủ commit → danh sách trống → rollback im lặng, không
    //đòi phiếu trùng, ton_cu_hong không tăng doubled.
    await client.query('SELECT id FROM sc WHERE id = $1 AND deleted_at = $2 FOR UPDATE', [scId, '']);
    const reRes = await client.query(CU_HONG_FILTER_SQL, [scId, THU_HOI_MARKER]);
    const re = reRes.rows;
    if (re.length === 0) return { ok: false as const, error: 'Phiếu này đã tạo nhập VT cũ/hỏng rồi (đồng thời).' };
    if (re.length > thay.length) throw new Error('SC thay đổi đồng thời, thử lại'); //thiếu id đã cấp trước
    for (let i = 0; i < re.length; i++) {
      const t = re[i];
      const sl = Number(t.so_luong);
      await client.query(
        "INSERT INTO nhap_xuat (id,vattu_id,loai,so_luong,don_gia,ngay,ly_do,nguoi,sc_id,ncc,phieu_id,is_test) " +
        "VALUES ($1,$2,'nhap',$3,NULL,$4,$5,$6,$7,$8,$9,$10)",
        [nxIds[i], t.vattu_id, sl, ngay, THU_HOI_MARKER, u?.id ?? null, scId, THU_HOI_MARKER, phieuId, isTest]
      );
      await client.query(
        'UPDATE vattu SET ton_cu_hong = ton_cu_hong + $2::integer WHERE id = $1',
        [t.vattu_id, sl]
      );
      await client.query(
        'INSERT INTO thanh_ly (id,sc_id,vattu_id,so_luong,gia_thanh_ly,ly_do,ngay,is_test) VALUES ($1,$2,$3,$4,0,$5,$6,$7)',
        [lnIds[i], scId, t.vattu_id, sl, `Thay thế — tự động từ SC ${scId}`, ngay, isTest]
      );
    }
    await auditTx(client, { actor_id: u?.id, actor_role: role, hanh_dong: 'kho_nhap', doi_tuong: 'nhap_xuat', doi_tuong_id: phieuId, sc_id: scId, mo_ta: 'Tự động nhập VT cũ/hỏng từ SC ' + scId, is_test: isTest });
    return { ok: true as const, id: phieuId, so_dong: re.length };
  });
  return out;
}

/**
 * AUTO XUẤT ĐỦ THEO SC (v3.6 autoXuatSC dòng 281): khi MỌI dòng cầu (tt IN
 * can_mua/da_mua) của SC có tổng nhập thường ≥ so_luong → tạo ĐÚNG MỘT phiếu
 * xuất nhóm (phieu_id W1a, loai='xuat', sc_id, ly_do AUTO_XUAT_LY_DO), trừ `ton`
 * bằng row-guard W0, set sc_vattu→da_xuat. Chưa đủ → chờ (phieu_id:null, ok:true
 * — hành vi null của v3.6). Không check perm nội bộ như v3.6 (gọi từ ngữ cảnh
 * đã có kho.tao ở W3 hook; RPC expose nếu cần meta riêng là việc worker-c).
 * Khác v3.6 (CHỦ ĐÍCH, Production Check):
 *  - đếm nhập LOẠI phiếu thu hồi (marker) — v3.6 đếm cả cu_hong → trừ ton không
 *    nguồn thu → âm tồn;
 *  - ton trừ bằng guard atomic + SC lock (v3.6 trừ check-then-act, không tx);
 *  - dòng vật tư bị soft-delete/cố ý: vẫn mark da_xuat (cầu không còn khả thi —
 *    v3.6 skip KHÔNG mark → lần nhập sau tái tạo PXX TRÙNG cho cùng SC).
 */
export async function autoXuatSC(
  api: Api,
  p: { sc_id?: string }
): Promise<{ ok: boolean; phieu_id?: string | null; error?: string }> {
  if (typeof p?.sc_id !== 'string' || !p.sc_id.trim()) return { ok: false, error: 'Thiếu sc_id' };
  const scId = p.sc_id.trim();
  const u = api.auth.current();
  const role = u?.role;
  const scEx = await api.db.query('SELECT id FROM sc WHERE id = $1 AND deleted_at = $2', [scId, '']);
  if (!scEx.rows.length) return { ok: false, error: 'Không tìm thấy phiếu sửa chữa.' };
  const needRes = await api.db.query(SC_NEED_SQL, [scId]);
  const need = needRes.rows;
  if (!need.length) return { ok: true, phieu_id: null }; //không cầu mở → không có gì để xuất (v3.6 null)
  const giaMap = new Map<string, { soLuong: number; giaMax: number }>();
  for (const r of need) {
    const t = await sumNhapTheoSc(api.db, scId, r.vattu_id);
    if (t.soLuong < Number(r.so_luong)) return { ok: true, phieu_id: null }; //còn thiếu → chờ đợt nhập sau
    giaMap.set(r.id, t);
  }
  const valid = need.filter((r) => !!r.vt_ok);
  if (!valid.length) {
    //Mọi dòng cầu trỏ vật tư đã soft-delete → không có gì để xuất; đánh dấu để
    //giải phóng cầu (idempotent cho các lần gọi sau). Không có dòng nào thì
    //không sinh nhóm phiếu → phieu_id null (v3.6 tạo header rỗng; v5 không có
    //bảng header — ghi chú lệch).
    await run("UPDATE sc_vattu SET tt = 'da_xuat' WHERE sc_id = $1 AND tt IN ('can_mua','da_mua') AND deleted_at = ''", [scId]);
    return { ok: true, phieu_id: null };
  }
  const nxIds: string[] = [];
  for (let i = 0; i < valid.length; i++) nxIds.push(await nextId('NX'));
  const phieuId = nxIds[0];
  const isTest = role === 'admin' ? 1 : 0;
  const ngay = todayStr();
  const txRes = await withTransaction(async (client) => {
    //Khóa SC: 2 lệnh autoXuatSCsong song (vd 2 phiếu nhập cùng về đủ cầu) tuần tự —
    //kẻ đến sau re-read need=[] (đã da_xuat) → no-op, ĐÚNG 1 phiếu/đợt (test 2 gọi).
    await client.query('SELECT id FROM sc WHERE id = $1 AND deleted_at = $2 FOR UPDATE', [scId, '']);
    const reRes = await client.query(SC_NEED_SQL, [scId]);
    const reNeed = reRes.rows;
    const reValid = reNeed.filter((r) => !!r.vt_ok);
    if (reNeed.length === 0) return { lines: 0 }; //đối thủ vừa commit phiếu — no-op idempotent
    if (reValid.length > nxIds.length) throw new Error('SC thay đổi đồng thời, thử lại');
    //nxIds cấp theo tập need TRƯỚC khi lấy lock. Dưới lock, tập cầu chỉ có thể
    //THU HẸP (xuatKho thường đổi tt mà không cần lock — re-read sẽ thấy ít
    //hơn), không thể MỞ RỘNG (tăng cầu giữa 2 lần đọc của chính lệnh này) →
    //mọi id cấp trước đều đủ; nếu thực tế nhiều hơn, throw thử lại ở trên.
    //Mỗi id NX là vé duy nhất bất kỳ nên việc đánh số theo thứ tự reValid
    //luôn hợp lệ — group key phieuId ghi tường minh trên mọi dòng INSERT.
    let k = 0;
    for (const r of reNeed) {
      if (!r.vt_ok) continue; //mark gộp cuối tx (đừng cấp dòng xuất cho vật tư chết)
      const sl = Number(r.so_luong);
      if (sl <= 0) { k++; continue; } //phòng hờ dữ liệu cũ; dòng 0 không đáng trừ
      const upd = await client.query(
        'UPDATE vattu SET ton = ton - $2 WHERE id = $1 AND ton >= $2 RETURNING ton',
        [r.vattu_id, sl]
      );
      if (upd.rowCount === 0) {
        //Thất bại nghĩa là nhập đã bị tiêu phí bởi lệnh xuất khác sau pre-read —
        //ROLLBACK toàn nhóm: KHÔNG có phiếu nửa vời; tt giữ nguyên → nhập đợt sau
        //gọi lại autoXuatSC sẽ thành công.
        const cur = await client.query('SELECT ton FROM vattu WHERE id = $1', [r.vattu_id]);
        throw new Error(`Thiếu tồn kho (ton: ${cur.rows[0]?.ton ?? 0})`);
      }
      const pre = giaMap.get(r.id); //giá nhập SC này, fallback giá vật tư (v3.6 305)
      const gia = Number(pre?.giaMax) > 0 ? Number(pre!.giaMax) : Number(r.vt_gia ?? 0);
      await client.query(
        "INSERT INTO nhap_xuat (id,vattu_id,loai,so_luong,don_gia,ngay,ly_do,nguoi,sc_id,phieu_id,is_test) " +
        "VALUES ($1,$2,'xuat',$3,$4,$5,$6,$7,$8,$9,$10)",
        [nxIds[k], r.vattu_id, sl, gia || null, ngay, AUTO_XUAT_LY_DO, u?.id ?? null, scId, phieuId, isTest]
      );
      k++;
    }
    //Một UPDATE phủ TOÀN BỘ cầu đã chốt (kể cả dòng vt_ok fail — giải phóng cầu
    //không khả thi, xem docstring) → không còn dư địa PXX trùng cho cùng SC.
    await client.query(
      "UPDATE sc_vattu SET tt = 'da_xuat' WHERE sc_id = $1 AND tt IN ('can_mua','da_mua') AND deleted_at = ''",
      [scId]
    );
    //Audit CHỈ khi có ≥1 dòng phiếu: nhóm rỗng mà audit trỏ phieuId không dòng
    //nào sẽ là "ma" trong activity_log (không truy vết được phiếu tương ứng).
    if (k > 0) {
      await auditTx(client, { actor_id: u?.id, actor_role: role, hanh_dong: 'kho_xuat', doi_tuong: 'nhap_xuat', doi_tuong_id: phieuId, sc_id: scId, mo_ta: 'Xuất tự động đủ vật tư cho SC ' + scId, is_test: isTest });
    }
    return { lines: k };
  });
  return { ok: true, phieu_id: txRes.lines > 0 ? phieuId : null };
}

// ═════════════════════════════════════════════════════════════════════
// W2a — DM ĐỀ NGHỊ MUA: DOC + SOFT-DELETE PHIẾU CHỜ DUYỆT
// (port v3.6 kho.js: dmList dòng 97–103, dmDetail 105–111, dmDelete
// 247–255, dmListBySc 516–529 — hành vi NGUYÊN, bảng/cột theo schema v5
// thật: de_nghi_mua→`dm`, dm_mua_ct→`dm_chitiet`).
// W2b (dmDecide/dmFromSC/dmAutoBu) nối tiếp file này — KHÔNG viết ở W2a.
//
// LỆCH v3.6 ĐÃ XÁC MINH TRÊN SCHEMA THẬT (ghi chú bàn giao):
//  1) v3.6 link đề nghị↔SC qua dm_mua_ct.sc_id (per-line) và dấu vết nhập
//     qua phieu_nh_ct.ref_dm. v5 KHÔNG có cột ref_dm ở đâu cả và
//     dm_chitiet cũng không có sc_id: liên kết nằm ở header `dm.sc_id`
//     (dmCreate ghi) còn phiếu nhập từ DM được dmNhap ghi dấu vết
//     `nhap_xuat.ly_do = 'Nhập DM <id>'` (hằng số core — không có đường
//     nào khác tạo chuỗi này). dmListBySc theo `dm.sc_id` là_cover cả hai
//     nhánh v3.6 (dmNhap luôn copy sc_id header xuống dòng phiếu); điều
//     kiện ly_do của dmDelete tương đương COUNT(phieu_nhap WHERE ref_dm)
//     v3.6 vì dm không sc_id → phiếu nhập cũng không sc_id (đọc dmInfo).
//  2) Bỏ `label` (tự điển DM_TT v3.6) khỏi rows — contract UI worker-c→
//     worker-e chốt shape {id,ma,trang_thai,tong,ngay_tao,so_dong,sc_id}.
//     `ma` = id (v5 'DM-000001'; v3.6 dùng prefix 'DNM' — không bịa lại).
//  3) whitelist trang_thai bám sát CHECK `dm` v5 — W2a chốt 3 giá trị
//     ('cho_duyet','da_nhap','tu_choi') vì 'da_duyet' CHƯA tồn tại ở CHECK
//     thời điểm đó; W2b (dmDecide) đã cấp 'da_duyet' trong CHECK
//     (db/schema.sql) → whitelist mở theo 4 giá trị (giữ hợp đồng dmList).
//  4) id-không-tìm-thấy: v3.6 dmDetail trả null → v5 trả envelope
//     {ok:false,'Không thấy đề nghị.'} như dmDelete v3.6 dòng 250 (HTTP
//     wrapper vẫn {ok:true,result:{ok:false,...}} — dispatch không đổi).
// ═════════════════════════════════════════════════════════════════════

/** Whitelist trạng thái DM — khớp CHÍNH XÁC CHECK constraint bảng `dm`
 *  (db/schema.sql; W2b mở thêm 'da_duyet' khi dmDecide cấp trạng thái duyệt). */
const DM_TT_WHITELIST = ['cho_duyet', 'da_duyet', 'da_nhap', 'tu_choi'] as const;

/** Columns SELECT chung cho mọi danh sách DM + so_dong subquery (port v3.6 dòng 100). */
const DM_LIST_SELECT =
  `SELECT d.id, d.sc_id, d.trang_thai, d.tong, d.ngay_tao, ` +
  `(SELECT COUNT(*) FROM dm_chitiet c WHERE c.dm_id = d.id AND c.deleted_at = '')::int AS so_dong ` +
  `FROM dm d `;

/** ORDER thống nhất mọi hàm DM (v3.6: ngay DESC, id DESC — cột v5 là ngay_tao). */
const DM_ORDER_SQL = `ORDER BY d.ngay_tao DESC NULLS LAST, d.id DESC`;

/** Map row SQL → shape contract DM (so_json numeric → number như suite thanh_ly). */
function dmRowOut(r: any): any {
  return {
    id: r.id,
    ma: r.id,
    trang_thai: r.trang_thai,
    tong: Number(r.tong ?? 0),
    ngay_tao: r.ngay_tao,
    so_dong: Number(r.so_dong ?? 0),
    sc_id: r.sc_id,
  };
}

/**
 * Danh sách đề nghị mua, phân trang + lọc (port v3.6 dmList — thêm filter/page
 * theo contract W2a). LIST → lọc is_test=0 ĐÚNG pattern phiếu header v5
 * (scList/baogiaList/hoSoList/tonKho: dữ liệu test admin không lẫn vào sổ);
 * DETAIL theo id (dmDetail) KHÔNG lọc is_test như scGet/hoSoGet/vattuGet.
 * Lỗi input trả envelope {ok:false,error} (quy ước hàm mới từ W1b — không
 * throw, không làm route 400 mất phân biệt lỗi-nghiệp-vụ/lỗi-hệ-thống).
 */
export async function dmList(
  api: Api,
  // style `any`: RPC JSON có thể gửi number/'' — mọi giá trị validate lại ở đây
  // (trần 200 khớp zod contract 2 tầng, không tin một phía — như tonKho).
  p: { trang_thai?: any; from?: any; to?: any; page?: any; limit?: any } = {}
): Promise<{ ok: boolean; result?: any[]; total?: number; page?: number; limit?: number; error?: string }> {
  if (p?.trang_thai !== undefined && p?.trang_thai !== null && p?.trang_thai !== '') {
    if (typeof p.trang_thai !== 'string' || !DM_TT_WHITELIST.includes(p.trang_thai as any)) {
      return { ok: false, error: 'trang_thai không hợp lệ (cho_duyet|da_duyet|da_nhap|tu_choi)' };
    }
  }
  for (const key of ['from', 'to'] as const) {
    const v = p?.[key];
    if (v !== undefined && v !== null && v !== '' && typeof v !== 'string') {
      return { ok: false, error: key + ' phải là chuỗi' };
    }
  }
  if (p?.from && !DATE_RE.test(p.from)) return { ok: false, error: 'from phải dạng YYYY-MM-DD' };
  if (p?.to && !DATE_RE.test(p.to)) return { ok: false, error: 'to phải dạng YYYY-MM-DD' };
  let page = 1;
  if (p?.page !== undefined && p?.page !== null && p?.page !== '') {
    const n = Number(p.page);
    if (!Number.isInteger(n) || n < 1) return { ok: false, error: 'page phải là số nguyên >= 1' };
    page = n;
  }
  let limit = 50;
  if (p?.limit !== undefined && p?.limit !== null && p?.limit !== '') {
    const n = Number(p.limit);
    if (!Number.isInteger(n) || n < 1 || n > 200) return { ok: false, error: 'limit phải là số nguyên 1..200' };
    limit = n;
  }
  const offset = (page - 1) * limit;
  const where: string[] = [`d.deleted_at = ''`, `d.is_test = 0`];
  const params: any[] = [];
  if (p?.trang_thai) where.push(`d.trang_thai = $${params.push(p.trang_thai)}`);
  if (p?.from) where.push(`COALESCE(d.ngay_tao,'') >= $${params.push(p.from)}`);
  if (p?.to) where.push(`COALESCE(d.ngay_tao,'') <= $${params.push(p.to)}`);
  const whereSql = where.join(' AND ');
  // total tính BẰNG SQL trên toàn bộ dòng khớp (không subquery so_dong — rẻ hơn,
  // COUNT header không phụ thuộc số dòng) → số không đổi giữa trang (như tonKho).
  const [dataRes, totalRes] = await Promise.all([
    api.db.query(
      DM_LIST_SELECT + `WHERE ${whereSql} ${DM_ORDER_SQL} LIMIT $${params.push(limit)} OFFSET $${params.push(offset)}`,
      params
    ),
    api.db.query(`SELECT COUNT(*)::int AS total FROM dm d WHERE ${whereSql}`, params.slice(0, -2)),
  ]);
  return {
    ok: true,
    result: dataRes.rows.map(dmRowOut),
    total: totalRes.rows[0]?.total ?? 0,
    page,
    limit,
  };
}

/**
 * Chi tiết MỘT đề nghị mua: header + items JOIN vattu (ten/don_vi) — port
 * v3.6 dmDetail dòng 105–111. v3.6 đọc cột ten/donvi denormalize trên
 * dm_mua_ct; schema v5 dm_chitiet KHÔNG có 2 cột đó (chỉ vattu_id FK) →
 * JOIN mới là đường đúng, giữ nguyên thông tin trả về (ten, don_vi,
 * so_luong, don_gia). LEFT JOIN nếu vật tư gãy tên vẫn trả dòng (không
 * LEFT JOIN nếu vật tư gãy tên vẫn trả dòng (không
 * annihilate item — audit trail của phiếu quan trọng hơn làm sạch hiển thị).
 * W2c: thêm 3 CỘT DUYỆT (nguoi_duyet/ngay_duyet/ly_do — schema v5 sau ALTER
 * W2b, default '') vào header: UI kho/dm và agent cần thấy ai duyệt, duyệt
 * ngày nào, vì sao từ chối mà không phải gọi thêm SQL; shape chỉ THÊM field
 * (không đổi field cũ → không vỡ contract đọc W2a của worker-e).
 */
export async function dmDetail(
  api: Api,
  p: { id?: any } = {}
): Promise<{ ok: boolean; dm?: any; items?: any[]; error?: string }> {
  if (typeof p?.id !== 'string' || !p.id.trim() || p.id.length > 12) {
    return { ok: false, error: 'id phải là chuỗi 1..12 ký tự' };
  }
  const h = await row('SELECT * FROM dm WHERE id = $1 AND deleted_at = $2', [p.id.trim(), '']);
  if (!h) return { ok: false, error: 'Không thấy đề nghị.' };
  const itemsRes = await api.db.query(
    `SELECT c.id, c.vattu_id, v.ten, v.don_vi, c.so_luong, c.don_gia ` +
    `FROM dm_chitiet c LEFT JOIN vattu v ON v.id = c.vattu_id ` +
    `WHERE c.dm_id = $1 AND c.deleted_at = '' ORDER BY c.id`,
    [h.id]
  );
  return {
    ok: true,
    dm: {
      id: h.id,
      ma: h.id,
      sc_id: h.sc_id,
      trang_thai: h.trang_thai,
      tong: Number(h.tong ?? 0),
      nguoi_tao: h.nguoi_tao,
      ngay_tao: h.ngay_tao,
      //W2c: chuỗi duyệt hiển thị được (dmDecide ghi nguoi/ngay khi 'duyet';
      //ly_do ghi khi 'tu_choi'; default '' — chuẩn hóa null → '' cho UI)
      nguoi_duyet: h.nguoi_duyet ?? '',
      ngay_duyet: h.ngay_duyet ?? '',
      ly_do: h.ly_do ?? '',
    },
    items: itemsRes.rows.map((r) => ({
      id: r.id,
      vattu_id: r.vattu_id,
      ten: r.ten,
      don_vi: r.don_vi,
      so_luong: Number(r.so_luong ?? 0),
      don_gia: Number(r.don_gia ?? 0),
    })),
  };
}

/**
 * DM liên kết một SC (port v3.6 dmListBySc dòng 516–529 — A5 GĐ3.7).
 * v3.6 UNION 2 nhánh (dm_mua_ct.sc_id per-line OR phieu_nh_ct.ref_dm qua
 * sc); v5 không có 2 link đó (xem block comment đầu section): liên kết
 * duy nhất là header `dm.sc_id`, và dmNhap copy chính nó xuống phiếu →
 * một điều kiện覆盖 cả hai nhánh. Trả toàn bộ DM khớp (không phân trang —
 * hợp đồng worker-e: danh sách gắn với MỘT phiếu, hữu hạn theo nghiệp vụ).
 */
export async function dmListBySc(
  api: Api,
  p: { sc_id?: any } = {}
): Promise<{ ok: boolean; result?: any[]; error?: string }> {
  if (typeof p?.sc_id !== 'string' || !p.sc_id.trim() || p.sc_id.length > 12) {
    return { ok: false, error: 'sc_id phải là chuỗi 1..12 ký tự' };
  }
  const r = await api.db.query(
    DM_LIST_SELECT + `WHERE d.deleted_at = '' AND d.is_test = 0 AND d.sc_id = $1 ${DM_ORDER_SQL}`,
    [p.sc_id.trim()]
  );
  return { ok: true, result: r.rows.map(dmRowOut) };
}

/**
 * Soft-delete đề nghị mua (port v3.6 dmDelete dòng 247–255). Guard 2 lớp
 * theo contract W2a (chặt hơn v3.6 — v3.6 chỉ chặn ref):
 *  1) còn PHIẾU NHẬP tham chiếu → từ chối. v5 không có cột ref_dm → dùng
 *     liên kết THỰC duy nhất: dòng dmNhap ghi buộc (chọn lọc chính xác để
 *     không LIKE-quét — xem LỆCH #1).
 *  2) chỉ xóa khi `trang_thai = 'cho_duyet'` — 'da_nhap' đã được (1) chặn
 *     nên điều kiện này chặn thêm nhánh 'tu_choi' theo contract.
 * Xóa MỀM header (deleted_at = ISO now — bản ghi xóa đầu tiên trong core
 * v5, cùng conventions TEXT deleted_at='' của schema); dm_chitiet giữ
 * nguyên (dmList/dmDetail lọc theo header → vẫn truy vết được bằng SQL
 * nếu cần khôi phục). Điều kiện `deleted_at=''` trong
 * UPDATE chống double-delete race; kiểm bằng audit cùng điều kiện.
 */
export async function dmDelete(
  api: Api,
  p: { id?: any } = {}
): Promise<{ ok: boolean; error?: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (typeof p?.id !== 'string' || !p.id.trim() || p.id.length > 12) {
    return { ok: false, error: 'id phải là chuỗi 1..12 ký tự' };
  }
  const id = p.id.trim();
  const d = await row('SELECT id, sc_id, trang_thai, is_test FROM dm WHERE id = $1 AND deleted_at = $2', [id, '']);
  if (!d) return { ok: false, error: 'Không thấy đề nghị.' };
  const nhap = await row(
    "SELECT COUNT(*)::int AS c FROM nhap_xuat WHERE loai = 'nhap' AND deleted_at = '' AND ly_do = $1",
    ['Nhập DM ' + id]
  );
  if (Number(nhap?.c ?? 0) > 0) return { ok: false, error: 'Không xoá được: đã có phiếu nhập' };
  if (d.trang_thai !== 'cho_duyet') return { ok: false, error: 'Chỉ xoá được đề nghị ở trạng thái chờ duyệt.' };
  const upd = await api.db.query(
    "UPDATE dm SET deleted_at = $2 WHERE id = $1 AND deleted_at = '' RETURNING id",
    [id, new Date().toISOString()]
  );
  if (upd.rows.length === 0) return { ok: false, error: 'Không thấy đề nghị.' }; // race: đối thủ vừa xóa
  try {
    await logActivity(api.db, {
      actor_id: u?.id, actor_role: role, hanh_dong: 'dm_xoa',
      doi_tuong: 'dm', doi_tuong_id: id, sc_id: d.sc_id ?? undefined,
      mo_ta: 'Xóa đề nghị mua ' + id, is_test: Number(d.is_test ?? 0),
    });
  } catch (e) {
    log.logError('logActivity dm_xoa failed', e, { id });
  }
  invalidateDashCache(); // W3.2-wire: xóa DM gắn sc_id → dash đổi (chủ động)
  return { ok: true };
}

// ═════════════════════════════════════════════════════════════════════
// W2b — DM CHUỖI DUYỆT: dmDecide + dmFromSC + dmAutoBu
// (port v3.6 kho.js: dmDecide dòng 229–245, dmFromSC 137–157, dmAutoBu
// 211–227; ngưỡng perm.js:109–123 `canApproveMua` + seed.js:260
// `duyet_mua_nguong = 5000000` — hành vi NGUYÊN, sai khác có chủ đích
// đều ghi chú tại chỗ + Production Check cuối section.)
//
// CẤU TRÚC QUYỀN (v3.6 → v5):
//  - v3.6: dmDecide = checkLock('mua','duy') (ma trận DB) && perm.canApproveMua
//    (hard-code admin/giamdoc vô hạn; ketoan ≤ ngưỡng). v5 không có bảng
//    phan_quyen → lớp RPC dùng META; W2b chốt META dmDecide ['kho','xem']
//    (xem lib/rpc.ts comment) để TOÀN BỘ phán quyết duyệt nằm MỘT CHỖ trong
//    core dưới đây — role ngoài {admin, giamdoc, ketoan≤ngưỡng} nhận
//    business error '{ok:false,error:cần Giám đốc...}' thay vì 403 cứng;
//    TẬP HỢP người-duyệt-được không đổi so với v3.6 (fail-closed).
//  - MATRIX.mua.duy (lib/perm.ts) = {giamdoc(+admin bypass)} = quyền duyệt
//    TRÊN ngưỡng; dùng đúng nhánh `duyetKhongGuong` bên dưới.
// ═════════════════════════════════════════════════════════════════════

/** Key config ngưỡng duyệt mua (v3.6 perm.js:110 configGet('duyet_mua_nguong')). */
const MUA_NGUONG_KEY = 'duyet_mua_nguong';
/** Default theo v3.6 seed.js:260 — 5.000.000 đ (v5 seed chưa có key → core tự đảm). */
const MUA_NGUONG_DEFAULT = '5000000';

/**
 * Đọc ngưỡng duyệt mua: INSERT-if-missing (ON CONFLICT DO NOTHING — idempotent,
 * tx-safe, không giỡ mặt dữ liệu admin đã chỉnh) rồi SELECT. Hành vi như v3.6
 * muaNguong(): Number(configGet(key, 0)) || 0 → giá trị rác/rỗng = 0 (ketoan
 * không duyệt được đâu khi ngưỡng=0, đúng v3.6). Nhận cả pool (query) lẫn
 * client (trong tx).
 */
async function muaNguong(
  q: { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> }
): Promise<number> {
  await q.query(
    'INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
    [MUA_NGUONG_KEY, MUA_NGUONG_DEFAULT]
  );
  const r = await q.query('SELECT value FROM config WHERE key = $1', [MUA_NGUONG_KEY]);
  const n = Number(r.rows[0]?.value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Duyệt / từ chối MỘT đề nghị mua (port v3.6 dmDecide dòng 229–245).
 *  - tx + `SELECT ... FOR UPDATE`: 2 lệnh decide song song trên cùng DM tuần
 *    tự hóa — kẻ đến sau thấy trang_thai mới (đã da_duyet/tu_choi) → bị chặn
 *    ở nhánh 'chỉ duyệt khi chờ duyệt', không ghi đè người/ngày duyệt.
 *  - Quyền (CẢ 2 nhánh quyet, đúng v3.6 — perm check TRƯỚC action branch):
 *    role ∈ {admin, giamdoc} (can 'mua','duy', MATRIX+admin bypass) vô hạn;
 *    ketoan chỉ khi tong ≤ ngưỡng `duyet_mua_nguong`; còn lại từ chối với
 *    thông báo v3.6 (chứa 'Giám đốc'). KHÔNG mở rộng cho role kho/xuong —
 *    giữ tẬP PHÁN QUYẾT v3.6, dù vào hàm qua gate kho.xem (xem block comment).
 *  - 'duyet'  → trang_thai 'da_duyet' + nguoi_duyet/ngay_duyet (v3.6 ghi 2 cột
 *    này DUY NHẤT ở nhánh duyệt — tu_choi không ghi, port nguyên).
 *  - 'tu_choi'→ BẮT BUỘC ly_do không rỗng (W2b contract chặt hơn v3.6 cho phép
 *    rỗng); ghi vào cột `ly_do` (v5 gộp ly_do_tu_choi+ghi_chu — schema comment).
 *  - audit `dm_duyet` + activity CÙNG TX (auditTx): rollback → không để lại log ma.
 *  - KHÔNG đụng tồn kho: nhập tồn là việc dmNhap (đúng v3.6 — duyệt chỉ đổi trạng thái).
 */
export async function dmDecide(
  api: Api,
  // style any: RPC JSON gửi primitive lạ — validate lại toàn bộ (quy ước hàm mới W1b+).
  p: { id?: any; quyet?: any; ly_do?: any } = {}
): Promise<{ ok: boolean; id?: string; trang_thai?: string; error?: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (typeof p?.id !== 'string' || !p.id.trim() || p.id.length > 12) {
    return { ok: false, error: 'id phải là chuỗi 1..12 ký tự' };
  }
  // whitelist quyet — chặn giá trị lạ (pattern nhapKho `loai`): 'duyet' như
  // v3.6 action='ok', 'tu_choi' như action khác của v3.6 nhưng CÓ ràng buộc ly_do.
  if (p.quyet !== 'duyet' && p.quyet !== 'tu_choi') {
    return { ok: false, error: 'quyet phải là duyet hoặc tu_choi' };
  }
  const lyDo = typeof p?.ly_do === 'string' ? p.ly_do.trim() : '';
  if (p.ly_do !== undefined && p.ly_do !== null && p.ly_do !== '' && typeof p.ly_do !== 'string') {
    return { ok: false, error: 'ly_do không hợp lệ' };
  }
  if (p.quyet === 'tu_choi' && !lyDo) {
    return { ok: false, error: 'Từ chối phải kèm lý do (ly_do)' };
  }
  const id = p.id.trim();
  return await withTransaction(async (client) => {
    const d = (await client.query(
      "SELECT id, sc_id, trang_thai, tong, is_test FROM dm WHERE id = $1 AND deleted_at = '' FOR UPDATE",
      [id]
    )).rows[0];
    if (!d) return { ok: false, error: 'Không thấy đề nghị.' }; // v3.6 dòng 233
    if (d.trang_thai !== 'cho_duyet') {
      // v3.6 dòng 234 'Đề nghị đã xử lý.' + câu chữ hợp đồng W2b 'chỉ duyệt khi chờ duyệt'
      return { ok: false, error: 'Đề nghị đã xử lý - chỉ duyệt khi chờ duyệt.' };
    }
    // ─── perm port NGUYÊN v3.6 checkLock('mua','duy') + canApproveMua ───
    // can() thuần MATRIX static (lib/perm.ts không chạm DB) → an toàn trong tx.
    const duyetKhongGuong = await api.perm.can(api.db, String(role), 'mua', 'duy'); // admin/giamdoc
    const nguong = await muaNguong(client);
    const duyetTrongGuong = String(role).toLowerCase() === 'ketoan' && Number(d.tong ?? 0) <= nguong;
    if (!(duyetKhongGuong || duyetTrongGuong)) {
      // v3.6 dòng 236 + hậu tố ngưỡng (hợp đồng W2b); chứa 'Giám đốc' để UI/agent định hướng.
      return { ok: false, error: 'Chưa đủ quyền - cần Giám đốc duyệt giá trị lớn (> ngưỡng).' };
    }
    if (p.quyet === 'duyet') {
      // v3.6: nguoi_duyet=meId(), ngay_duyet=db.today(); ly_do KHÔNG đụng tới.
      await client.query(
        "UPDATE dm SET trang_thai = 'da_duyet', nguoi_duyet = $2, ngay_duyet = $3 WHERE id = $1",
        [id, u?.id ?? '', todayStr()]
      );
    } else {
      // v3.6: 'tu_choi' + ly_do_tu_choi (v5: cột gộp `ly_do`); không ghi người/ngày duyệt.
      await client.query(
        "UPDATE dm SET trang_thai = 'tu_choi', ly_do = $2 WHERE id = $1",
        [id, lyDo]
      );
    }
    await auditTx(client, {
      actor_id: u?.id, actor_role: role, hanh_dong: 'dm_duyet',
      doi_tuong: 'dm', doi_tuong_id: id, sc_id: d.sc_id ?? undefined,
      mo_ta: 'Đề nghị ' + id + (p.quyet === 'duyet' ? ' - Duyệt' : ' - Từ chối: ' + lyDo),
      is_test: Number(d.is_test ?? 0),
    });
    invalidateDashCache(); // W3.2-wire (end-of-tx): DM duyệt/từ chối → dash đổi (chủ động)
    return { ok: true, id, trang_thai: p.quyet === 'duyet' ? 'da_duyet' : 'tu_choi' };
  });
}

/** GROUP cầu can_mua của SC theo vật tư — port v3.6 dmFromSC dòng 139–141.
 *  v3.6 gom bằng JS loop: `dgia = v.gd_dk` chỉ gán LẦN ĐẦU cho mỗi vattu_id
 *  (row gd_dk=0 vẫn là row đầu → dmCreate fallback cat.gia). v5 tương ứng:
 *  (ARRAY_AGG(gd_dk ORDER BY id))[1] = giá trị row ĐẦU TIÊN (không lọc 0),
 *  vt_gia phục vụ fallback (v3.6 dmCreate: dgia || cat.gia).
 *  LỆCH có chủ đích: bỏ điều kiện `vattu_id>0` — cột v5 VARCHAR FK NOT NULL,
 *  mọi dòng đều trỏ vật tư thật (điều kiện v3.6 chỉ để loại row manual chưa gán). */
const SC_CAN_MUA_GROUP_SQL =
  'SELECT s.vattu_id, SUM(s.so_luong)::float8 AS so_luong, ' +
  '((ARRAY_AGG(s.gd_dk ORDER BY s.id))[1])::float8 AS gd_dk, ' +
  'MAX(v.gia)::float8 AS vt_gia ' +
  'FROM sc_vattu s JOIN vattu v ON v.id = s.vattu_id ' +
  "WHERE s.sc_id = $1 AND s.tt = 'can_mua' AND s.deleted_at = '' " +
  'GROUP BY s.vattu_id';

/**
 * Tạo DM từ nhu cầu mua của SC (port v3.6 dmFromSC dòng 137–157):
 *  - gom sc_vattu `tt='can_mua'` theo vattu_id, SUM so_luong;
 *  - một DM MỞ (`dm.sc_id` + 'cho_duyet') đã tồn tại → từ chối 'đang mở'
 *    (v3.6 dò qua dm_mua_ct.sc_id per-line; v5 không có cột đó — link nằm ở
 *    HEADER dm.sc_id, precedent W2a lệch #1);
 *  - don_gia = gd_dk đầu tiên > 0, không có → giá vật tư (v3.6 dmCreate dòng
 *    gia = Number(it.dgia) || cat.gia); tong = SUM(sl*don_gia);
 *  - idempotent-safe: đọc trước tx (lấy số nhóm), TX lock TOÀN BỘ dòng
 *    sc_vattu can_mua FOR UPDATE (2 lệnh dmFromSC cùng SC tuần tự — v3.6 nhờ
 *    SQLite serialize, PG phải lock tay), re-check open-DM + re-group dưới
 *    lock; nhóm tăng lên giữa 2 lần đọc → throw thử lại (không ghi nửa);
 *  - v3.6 dòng 153–155 UPDATE bao_gia_ncc.dm_id: BỎ có chủ đích — schema v5
 *    `bao_gia_ncc` không có cột dm_id (luồng OCR báo giá NCC đã chốt loại ở
 *    v4.0 — AGENTS.md CẤM).
 *  - audit dm_tao CÙNG tx; ly_do = ghi chú 'Vật tư cho phiếu sửa chữa <sc>'
 *    (v3.6 dmCreate ghi_chu nguyên văn).
 * Quyền vào: META ['kho','tao'] (v3.6 checkLock('mua','tao') — v5 gộp module
 * kho/mua theo precedent W2a).
 */
export async function dmFromSC(
  api: Api,
  p: { sc_id?: any } = {}
): Promise<{ ok: boolean; id?: string | null; so_dong?: number; tong?: number; error?: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (typeof p?.sc_id !== 'string' || !p.sc_id.trim() || p.sc_id.length > 12) {
    return { ok: false, error: 'sc_id phải là chuỗi 1..12 ký tự' };
  }
  const scId = p.sc_id.trim();
  const pre = (await api.db.query(SC_CAN_MUA_GROUP_SQL, [scId])).rows;
  if (!pre.length) return { ok: false, error: 'Không còn vật tư cần mua.' }; // v3.6 dòng 140
  const preOpen = (await api.db.query(
    "SELECT id FROM dm WHERE sc_id = $1 AND trang_thai = 'cho_duyet' AND deleted_at = '' LIMIT 1",
    [scId]
  )).rows[0];
  if (preOpen) return { ok: false, error: 'Đã có đề nghị mua đang mở cho SC này: ' + preOpen.id };
  const isTest = role === 'admin' ? 1 : 0;
  const dmId = await nextId('DM');
  const ctIds: string[] = [];
  for (let i = 0; i < pre.length; i++) ctIds.push(await nextId('DMCT'));
  const lyDo = 'Vật tư cho phiếu sửa chữa ' + scId; // v3.6 dòng 150 ghi_chu nguyên văn
  const ngay = todayStr();
  const out = await withTransaction(async (client) => {
    // 1) Lock toàn bộ dòng cầu can_mua của SC (aggregate KHÔNG đi kèm FOR UPDATE
    //    được — tách SELECT khóa raw row rồi mới group trên chính connection).
    await client.query(
      "SELECT id FROM sc_vattu WHERE sc_id = $1 AND tt = 'can_mua' AND deleted_at = '' ORDER BY id FOR UPDATE",
      [scId]
    );
    // 2) Re-check DM mở DƯỚI lock (đối thủ vừa tạo xong → đọc thấy ngay).
    const open = (await client.query(
      "SELECT id FROM dm WHERE sc_id = $1 AND trang_thai = 'cho_duyet' AND deleted_at = '' LIMIT 1",
      [scId]
    )).rows[0];
    if (open) return { ok: false as const, error: 'Đã có đề nghị mua đang mở cho SC này: ' + open.id };
    // 3) Re-group dưới lock: cầu CHỈ có thể THU HẸP (xuatKho/dmLock đánh dấu tt
    //    ngoài flow này); rộng hơn nghĩa là thêm vt giữa 2 lần đọc → thiếu id
    //    đã cấp → throw thử lại (pattern autoGenCuHong).
    const re = (await client.query(SC_CAN_MUA_GROUP_SQL, [scId])).rows;
    if (!re.length) return { ok: false as const, error: 'Không còn vật tư cần mua (đồng thời).' };
    if (re.length > ctIds.length) throw new Error('SC thay đổi đồng thời, thử lại');
    // HEADER trước, dòng sau — FK dm_chitiet.dm_id check tức thì trên PG
    // (khác SQLite v3.6 defer); tong tính từ tập re đã chốt dưới lock.
    let tong = 0;
    const lines: Array<{ ctId: string; vattuId: string; sl: number; gia: number }> = [];
    for (let i = 0; i < re.length; i++) {
      const gia = Number(re[i].gd_dk ?? 0) || Number(re[i].vt_gia ?? 0);
      tong += Number(re[i].so_luong) * gia;
      lines.push({ ctId: ctIds[i], vattuId: re[i].vattu_id, sl: Number(re[i].so_luong), gia });
    }
    tong = Math.round(tong * 100) / 100; // NUMERIC(14,2) — làm tròn 2 chữ số như dmCreate
    await client.query(
      "INSERT INTO dm (id, sc_id, trang_thai, tong, nguoi_tao, ngay_tao, ly_do, is_test) VALUES ($1,$2,'cho_duyet',$3,$4,$5,$6,$7)",
      [dmId, scId, tong, u?.id ?? null, ngay, lyDo, isTest]
    );
    for (const l of lines) {
      await client.query(
        'INSERT INTO dm_chitiet (id, dm_id, vattu_id, so_luong, don_gia) VALUES ($1,$2,$3,$4,$5)',
        [l.ctId, dmId, l.vattuId, l.sl, l.gia]
      );
    }
    await auditTx(client, {
      actor_id: u?.id, actor_role: role, hanh_dong: 'dm_tao',
      doi_tuong: 'dm', doi_tuong_id: dmId, sc_id: scId,
      mo_ta: 'Tạo đề nghị mua ' + dmId + ' - ' + lyDo, is_test: isTest,
    });
    return { ok: true as const, id: dmId, so_dong: re.length, tong };
  });
  if (out.ok) invalidateDashCache(); // W3.2-wire (post-commit): DM mới gắn SC → dash đổi
  return out;
}

/**
 * Tự động lập DM bù tồn tối thiểu (port v3.6 dmAutoBu dòng 211–227):
 *  - vật tư active ton_min>0 AND ton<ton_min → thiếu (ton_min − ton), giữ
 *    thập phân vì cột NUMERIC(12,2) (v3.6 Math.max(0, ton_min−ton) nguyên văn);
 *  - BỎ QUA vt đã nằm trong DM chưa khép: v3.6 chặn cả `cho_duyet` LẪN
 *    'da_duyet' (DM đã duyệt chờ nhập = hàng đang về, đặt tiếp là mua lặp) —
 *    port NGUYÊN tập 2 trạng thái (nhiệm vụ ghi 'cho_duyet' nhưng nguồn v3.6
 *    đúng là IN ('cho_duyet','da_duyet')); LỆCH có chủ đích: thêm
 *    `d.deleted_at = ''` (v3.6 sót — DM đã xóa mềm không được chặn đơn nữa);
 *  - một DM nhiều dòng, KHÔNG sc_id (đúng v3.6), ly_do = ghi chú v3.6 nguyên
 *    văn 'Tự động bổ sung tồn tối thiểu' (v3.6 để ở ghi_chu);
 *  - không có gì thiếu → {ok:true,id:null,'Không cần bổ sung tồn.'} như v3.6;
 *  - không lock (v3.6 serialize ngầm SQLite; 2 lệnh autoBu song song TUỲ THUỘC
 *    có thể sinh 2 DM trùng — chấp nhận theo hành vi gốc, DM thừa bị dmDecide
 *    từ chối được; ghi Production Check).
 * Quyền vào: META ['kho','tao'] (v3.6 checkLock('mua','tao')).
 */
export async function dmAutoBu(
  api: Api,
  _p: Record<string, never> | any = {}
): Promise<{ ok: boolean; id?: string | null; so_dong?: number; tong?: number; message?: string; error?: string }> {
  const u = api.auth.current();
  const role = u?.role;
  const short = (await api.db.query(
    'SELECT v.id AS vattu_id, (v.ton_min - v.ton)::float8 AS thieu, v.gia::float8 AS gia ' +
    'FROM vattu v ' +
    "WHERE v.ton_min > 0 AND v.ton < v.ton_min AND v.deleted_at = '' " +
    'AND NOT EXISTS (SELECT 1 FROM dm_chitiet c JOIN dm d ON d.id = c.dm_id ' +
    "WHERE c.vattu_id = v.id AND c.deleted_at = '' AND d.deleted_at = '' " +
    "AND d.trang_thai IN ('cho_duyet','da_duyet')) " +
    'ORDER BY v.id'
  )).rows.filter((r) => Number(r.thieu) > 0); // v3.6 `if (short <= 0) return;`
  if (!short.length) return { ok: true, id: null, message: 'Không cần bổ sung tồn.' };
  const dmId = await nextId('DM');
  const ctIds: string[] = [];
  for (let i = 0; i < short.length; i++) ctIds.push(await nextId('DMCT'));
  const isTest = role === 'admin' ? 1 : 0;
  const lyDo = 'Tự động bổ sung tồn tối thiểu';
  const ngay = todayStr();
  const tong = await withTransaction(async (client) => {
    let acc = 0;
    const lines: Array<{ ctId: string; vattuId: string; sl: number; gia: number }> = [];
    for (let i = 0; i < short.length; i++) {
      const s = short[i];
      const gia = Number(s.gia ?? 0); // v3.6 dgia = v.gia (|| cat.gia — cùng nguồn)
      acc += Number(s.thieu) * gia;
      lines.push({ ctId: ctIds[i], vattuId: s.vattu_id, sl: Number(s.thieu), gia });
    }
    // HEADER trước, dòng sau — FK dm_chitiet.dm_id check tức thì (PG, như dmFromSC)
    await client.query(
      "INSERT INTO dm (id, sc_id, trang_thai, tong, nguoi_tao, ngay_tao, ly_do, is_test) VALUES ($1,NULL,'cho_duyet',$2,$3,$4,$5,$6)",
      [dmId, Math.round(acc * 100) / 100, u?.id ?? null, ngay, lyDo, isTest]
    );
    for (const l of lines) {
      await client.query(
        'INSERT INTO dm_chitiet (id, dm_id, vattu_id, so_luong, don_gia) VALUES ($1,$2,$3,$4,$5)',
        [l.ctId, dmId, l.vattuId, l.sl, l.gia]
      );
    }
    await auditTx(client, {
      actor_id: u?.id, actor_role: role, hanh_dong: 'dm_tao',
      doi_tuong: 'dm', doi_tuong_id: dmId, sc_id: undefined,
      mo_ta: 'Tạo đề nghị mua ' + dmId + ' - ' + lyDo, is_test: isTest,
    });
    return Math.round(acc * 100) / 100;
  });
  invalidateDashCache(); // W3.2-wire (post-commit): DM bù tồn (chủ động, dash không đếm DM)
  return { ok: true, id: dmId, so_dong: short.length, tong };
}

// ─── Production Check (W2b) ───────────────────────────────────────────
// 1) CON THIEU GI? — ✅ W2c ĐÓNG: dmDetail ĐÃ expose 3 cột mới
//    (nguoi_duyet/ngay_duyet/ly_do); seed.ts chưa INSERT sẵn
//    duyet_mua_nguong (core tự ON CONFLICT DO NOTHING — đạt cùng hiệu lực).
// 2) RUI RO DAU? — Phán quyết duyệt TẬP TRUNG trong dmDecide (không dựa UI);
//    gate kho.xem RỘNG hơn v3.6 (checkLock mua.duy) nhưng TẬP người được duyệt
//    cuối cùng GIỐNG HỆT v3.6 (ketoan vẫn kẹt ngưỡng, kho/xuong bị từ chối
//    ngay cả DM nhỏ). FOR UPDATE chống decision race; audit cùng tx chống log ma.
// 3) DA CHAY TEST CHUA? — tsc --noEmit + jest suite dm_decide/dm_read/
//    kho_phieu2tang/mcp/mcp_resources/rbac (kết quả dán trong báo cáo worker).
// 4) DE XUAT TIEP? — (a) ✅ ĐÃ LÀM Ở W2c: dmNhap chặn khi trang_thai<>'da_duyet'
//    (guard trong tx, SAU lock FOR UPDATE, TRƯỚC mọi UPDATE vattu.ton);
//    (b) autoBu khóa chống trùng bằng advisory lock nếu
//    thống kê dùng cho thấy trùng lặp thực tế.
//
// ─── Production Check (W2c — dmNhap guard + dmDetail cột duyệt) ────────
// 1) CON THIEU GI? — message guard chốt 'Chỉ nhập khi đề nghị đã duyệt.'
//    (tương đương v3.6 'Đề nghị mua chưa duyệt.' — kho.js:343; chọn câu
//    diễn đạt CHỦ ĐỘNG vì guard nay chặn cả da_nhap/DM xóa-mềm, không chỉ
//    "chưa"). UI /kho/dm (W2.6) chưa render cột duyệt — chỉ thêm field ở
//    envelope, không ép phía hiển thị (quyền file W2.6, không đụng).
// 2) RUI RO DAU? — Guard nằm SAU lock FOR UPDATE nên hai lệnh nhập song song
//    trên cùng DM đã-duyet: tx đầu cộng ton + set 'da_nhap', tx sau thấy
//    'da_nhap' → chặn (đóng luôn lỗ cộng-ton-lặp trước W2c). DM xóa-mềm còn
//    'cho_duyet' → bị chặn (trước W2c nhập được — chặt hơn, đúng chiều v3.6).
//    Không cònthrow nghiệp vụ: envelope {ok:false} → client phải soi result.ok
//    (pattern W2a-W2b đã thống nhất). dmDetail thêm field — reader cũ bỏ qua
//    key lạ, không vỡ shape đã chốt.
// 3) DA CHAY TEST CHUA? — tsc=0 + jest dm_read/dm_decide/kho_phieu2tang/
//    asset_gttv/sc_totals (server :3000, số liệu dán trong báo cáo worker).
// 4) DE XUAT TIEP? — W0 suite gọi dmNhap trên DM CHƯA duyệt sẽ đỏ trở lại
//    (kho_tonkho TC6, kho_race test-3 — CẦN thêm bước duyệt trước nhập;
//    nằm NGOÀI phạm vi file W2c → đã báo coordinator. rpc.test.ts vẫn xanh
//    vì chỉ assertion dispatch-level). Có thể thêm cột 'ref_dm' thật vào
//    nhap_xuat nếu về sau cần liên kết chặt hơn dấu vết ly_do.
// ═════════════════════════════════════════════════════════════════════
