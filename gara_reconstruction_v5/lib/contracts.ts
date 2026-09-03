import { z } from 'zod';

/**
 * Zod raw shapes for RPC function arguments.
 * Keys match the exact parameter names (snake_case) used in lib/core/*.ts
 */
export const RPC_SCHEMAS: Record<string, z.ZodRawShape> = {
  // sc.ts
  scCreate: {
    xe_id: z.string(),
    ngay: z.string(),
    // GĐ6: ghi chú thăm khám (optional, trần 2000 khớp core slice + cột TEXT).
    ghi_chu_tham_kham: z.string().max(2000).optional(),
  },
  scAddCongViec: {
    sc_id: z.string(),
    mo_ta: z.string(),
    nguyen_nhan: z.string().optional(),
    loai_xu_ly: z.string().optional(),
    so_luong: z.number().optional(),
    don_gia: z.number().optional(),
  },
  scAddVatTu: {
    sc_id: z.string(),
    vattu_id: z.string(),
    so_luong: z.number(),
    // W3.3A ĐÓNG WIRESH_PRICE: giá đăng ký gửi ngay khi thêm dòng.
    //  - `don_gia` = key app/(app)/sc/page.tsx đang phát (dòng 390–395, WIRESH_PRICE
    //    flag do UI tự bật — core KHÔNG đổi UI); `gd_dk` = tên cột v5/v3.6 cho MCP client.
    //  - core: gd_dk = Number(gd_dk ?? don_gia ?? 0), >= 0 (clampNonNegative sc.ts).
    don_gia: z.number().min(0).optional(),
    gd_dk: z.number().min(0).optional(),
  },
  scBatDauSua: {
    sc_id: z.string(),
  },
  scHoanThanh: {
    sc_id: z.string(),
  },
  scTuChoi: {
    sc_id: z.string(),
    ly_do: z.string(),
  },
  scQuyetToan: {
    sc_id: z.string(),
  },

  // W3.3A — dòng công việc/vật tư + deadline + thợ (id = mã dòng, sc_id suy từ dòng
  // trong core nên KHÔNG phải input; enum tt 'cho|dang|hoan' theo CHECK sc_congviec v5;
  // deadline regex YYYY-MM-DD (rỗng = xóa hẹn); id trần 12 ký theo chuẩn PREFIX-000001).
  scWorkSet: {
    id: z.string().min(1).max(12),
    mo_ta: z.string().max(500).optional(),
    ten: z.string().max(500).optional(), // alias v3.6 của mo_ta
    so_luong: z.number().min(0).optional(),
    don_gia: z.number().min(0).optional(),
    tho_id: z.string().max(12).optional(),
    tt: z.enum(['cho', 'dang', 'hoan']).optional(),
    stt: z.number().int().min(0).optional(),
    nguyen_nhan: z.string().max(500).optional(),
    loai_xu_ly: z.enum(['thay_moi', 'sua_chua', 'bao_duong', 'khac']).optional(),
  },
  scWorkDel: {
    id: z.string().min(1).max(12),
  },
  scVtUpd: {
    id: z.string().min(1).max(12),
    so_luong: z.number().min(0).optional(),
    gd_dk: z.number().min(0).optional(),
  },
  scVtDel: {
    id: z.string().min(1).max(12),
  },
  scSetDeadline: {
    id: z.string().min(1).max(12),
    // '' = xóa hẹn (v3.6 String(ngay||'')); có nội dung thì bắt buộc YYYY-MM-DD.
    han_tra_xe: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'han_tra_xe phải dạng YYYY-MM-DD')
      .optional(),
  },
  // thoList: không tham số — READ danh sách thợ (role xuong).
  thoList: {},

  // W3.5 — DUYỆT SC THEO NGƯỠNG + TỔNG DUYỆT CHỐT SNAPSHOT (code sc_phien_ban).
  // Ràng buộc nghiệp vụ (trang_thai phải de_xuat/da_duyet, ngưỡng tiền
  // duyet_sc_nguong, chưa-chot) KHÔNG biểu diễn được bằng zod → core
  // (lib/core/sc.ts scApprove/scTongDuyet, envelope business error). id theo
  // chuẩn VARCHAR(12) 'PREFIX-000001' — cùng trần scWorkSet/dmDecide 2 tầng.
  scApprove: {
    id: z.string().min(1).max(12),
  },
  scTongDuyet: {
    id: z.string().min(1).max(12),
  },

  // ho_so.ts
  keHoachSave: {
    sc_id: z.string(),
    mo_ta: z.string().optional(),
  },
  kiemTuSave: {
    sc_id: z.string(),
    mo_ta: z.string().optional(),
  },
  nghiemThuSave: {
    sc_id: z.string(),
    ngay_nghiem: z.string().optional(),
    tong_vat_tu: z.number().optional(),
    tong_nhan_cong: z.number().optional(),
  },
  hoSoSave: {
    sc_id: z.string(),
    so_chung_tu: z.string().optional(),
    ngay: z.string().optional(),
    ghi_chu: z.string().optional(),
  },

  // baogia.ts
  baogiaSave: {
    sc_id: z.string(),
    ncc: z.string().optional(),
    ngay: z.string(),
    items: z.any(),
  },

  // kho.ts
  nhapKho: {
    vattu_id: z.string(),
    so_luong: z.number(),
    don_gia: z.number().optional(),
    ngay: z.string(),
    ly_do: z.string().optional(),
  },
  xuatKho: {
    vattu_id: z.string(),
    so_luong: z.number(),
    sc_id: z.string().optional(),
    ly_do: z.string().optional(),
  },
  vattuCreate: {
    ten: z.string(),
    ma: z.string().optional(),
    don_vi: z.string().optional(),
    gia: z.number().optional(),
    ton_min: z.number().optional(),
  },
  dmCreate: {
    sc_id: z.string().optional(),
    items: z.any(),
    ngay: z.string(),
  },
  dmNhap: {
    dm_id: z.string(),
  },

  // W1a — phiếu nhập/xuất 2 tầng (đọc nhóm dòng nhap_xuat theo phieu_id)
  phieuList: {
    loai: z.string().optional(),
    sc_id: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  },
  phieuGet: {
    id: z.string(),
  },

  // W1b-reg — tồn kho + lịch sử giá (read-only; core tonKho/giaLichSuList validate
  // lại lần nữa — trần 200/30 khớp nhau ở 2 tầng, không tin schema một phía).
  tonKho: {
    low_only: z.boolean().optional(),
    page: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  giaLichSuList: {
    // id đúng chuẩn VARCHAR(12) 'PREFIX-000001' — như assetXe
    vattu_id: z.string().min(1).max(12),
    limit: z.number().int().min(1).max(30).optional(),
  },

  // W1c-reg — bảng kê thanh lý (read-only; core thanhLyList validate lại lần nữa
  // mọi field — trần 200 khớp nhau ở 2 tầng, không tin schema một phía).
  // sc_id vẫn qua .passthrough() → core kiểm tra kiểu + tồn tại ở tầng 2.
  thanhLyList: {
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from phải dạng YYYY-MM-DD').optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to phải dạng YYYY-MM-DD').optional(),
    limit: z.number().int().min(1).max(200).optional(),
    offset: z.number().int().min(0).optional(),
  },

  // W2a-reg — DM đề nghị mua: đọc (enum bám sát CHECK `dm` v5; trần 200 khớp
  // core dmList 2 tầng, không tin schema một phía) + dmDelete (write, soft-delete
  // khi 'cho_duyet' và chưa có phiếu nhập — điều kiện nghiệp vụ ở core, không
  // biểu diễn được bằng zod).
  dmList: {
    // W2b: 'da_duyet' vào CHECK `dm` (db/schema.sql) → enum whitelist mở theo.
    trang_thai: z.enum(['cho_duyet', 'da_duyet', 'da_nhap', 'tu_choi']).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from phải dạng YYYY-MM-DD').optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to phải dạng YYYY-MM-DD').optional(),
    page: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  dmDetail: {
    id: z.string().min(1).max(12),
  },
  dmListBySc: {
    sc_id: z.string().min(1).max(12),
  },
  dmDelete: {
    id: z.string().min(1).max(12),
  },

  // W2b — chuỗi duyệt DM: decide (whitelist quyet 2 giá trị, core enforce
  // quyền ngưỡng + tx FOR UPDATE), fromSC (tạo DM từ cầu can_mua của SC),
  // autoBu (không tham số). Ràng buộc nghiệp vụ (ly_do bắt buộc khi tu_choi,
  // ngưỡng duyet_mua_nguong) KHÔNG biểu diễn được bằng zod → core.
  dmDecide: {
    id: z.string().min(1).max(12),
    quyet: z.enum(['duyet', 'tu_choi']),
    ly_do: z.string().max(500).optional(),
  },
  dmFromSC: {
    sc_id: z.string().min(1).max(12),
  },
  dmAutoBu: {},

  // asset.ts (W1.6f) — quyết toán tài sản, id đúng chuẩn VARCHAR(12) 'PREFIX-000001'
  assetXe: {
    id: z.string().min(1).max(12),
  },
  // assetReport không tham số — shape rỗng → getToolInputSchema = z.object({}).passthrough()
  assetReport: {},

  // W3.1-reg — dashboardAll: bảng điều khiển xưởng (kanban + KPI), KHÔNG tham số.
  // Mọi chốt quyền/401/403-ketoan ở core (lib/core/xuong.ts); dispatch args||{}.
  dashboardAll: {},

  // ── W4-reg (đợt gộp) — admin.ts + search.ts + auth.ts changePassword ─────
  // Trần số học khớp 2 tầng với core (admin.ts str()/clamp; search.ts
  // Q_MIN=2/LIMIT_MAX=30) — "không tin schema một phía" (khuôn tonKho/thanhLyList).
  // admin.ts tự validate lại toàn bộ input: zod là tầng 1 (MCP inputSchema +
  // tài liệu HTTP), core là tầng 2 (fail-closed cho client gọi thẳng /api/rpc).
  userList: {
    include_deleted: z.boolean().optional(),
    // core userList:106–108 clamp 1..500, rác → 100.
    limit: z.number().int().min(1).max(500).optional(),
  },
  userAdd: {
    name: z.string().min(1).max(32), // cột name = tên đăng nhập (schema v5 — header admin.ts)
    login: z.string().min(1).max(32).optional(), // alias — mặc định = name (admin.ts:146)
    // CHECK users.role 5 giá trị (db/schema.sql:7); core TỪ CHỐI role lạ
    // (không fallback 'tho' như v3.6 — admin.ts:153–156).
    role: z.enum(['admin', 'giamdoc', 'xuong', 'ketoan', 'kho']),
    // omitted → DEFAULT_PASSWORD + must_change=1 (v3.6:153–156).
    password: z.string().min(6).max(100).optional(),
  },
  userSetPassword: {
    id: z.string().min(1).max(12),
    // omitted → đặt về DEFAULT + BẬT must_change (admin.ts:226–229).
    password: z.string().min(6).max(100).optional(),
  },
  userSetActive: {
    id: z.string().min(1).max(12),
    // core nhận whitelist thật hơn (true/false/1/0/'1'/'0'/'true'/'false' —
    // admin.ts:268–270); zod siết khuôn JSON chuẩn cho MCP client.
    active: z.boolean(),
  },
  thresholdsGet: {
    // omitted → trả đủ 3 ngưỡng (shape v3.6 thresholds():604–609); key lạ
    // bị core TỪ CHỐI (whitelist chặn poisoning counter_* — admin.ts:56–63).
    key: z.enum(['duyet_sc_nguong', 'duyet_mua_nguong', 'khau_hao_nam']).optional(),
  },
  thresholdsSet: {
    key: z.enum(['duyet_sc_nguong', 'duyet_mua_nguong', 'khau_hao_nam']),
    // Number(value)||0 / ≥1 semantics ở core (admin.ts:364–374) — string số
    // hợp lệ ('123456') nên union; zod chỉ chặn kiểu rác.
    value: z.union([z.number(), z.string().min(1).max(20)]),
  },
  // core globalSearch(_api, {q, limit?}) — giữ ĐÚNG signature v4 (search.ts:69).
  globalSearch: {
    // min 2 theo search.ts Q_MIN; max 100 = trần input hygiene (ILIKE param,
    // chuỗi dài hơn vô nghĩa với mã phiếu/biển số/tên vật tư).
    q: z.string().min(2).max(100),
    // core clamp 1..30 (search.ts:76–78) — trần zod khớp lõi (2 tầng).
    limit: z.number().int().min(1).max(30).optional(),
  },
  // lib/auth.ts changePassword(api,{old_password,new_password}) — TỰ SERVICE:
  // không có id actor trong args (chống IDOR —fn chỉ đụng chính tài khoản
  // đăng nhập). Verify old + cấm default + ≥6 ký tự phán quyết ở lõi:215–234.
  changePassword: {
    old_password: z.string().min(1).max(100),
    new_password: z.string().min(6).max(100),
  },

  // ── W5-reg — boss.ts: hai fn READ tổng hợp cho BOSS, KHÔNG tham số.
  // Shape rỗng → getToolInputSchema = z.object({}).passthrough() (dispatch
  // args||{}); mọi phán quyết/fail-closed ở lõi (lib/core/boss.ts).
  bossDashboard: {},
  bossAlerts: {},

  // ── W6-reg — kế toán / sổ cái / khách hàng / bảo dưỡng ──────────────────
  // Trần zod khớp 2 tầng với core (ketoan.ts/ledger.ts validate lại mọi input
  // — "không tin schema một phía", khuôn tonKho/thanhLyList). ID theo chuẩn
  // VARCHAR(12) 'PREFIX-000001'; ngày YYYY-MM-DD (quy ước TEXT duy nhất).
  // ketoan.ts — đọc/tính:
  tinhGiaVon: {
    vattu_id: z.string().min(1).max(12),
    so_luong: z.number().min(0),
  },
  reconcileKho: {},
  congNoList: {
    // CHECK cong_no.loai (db/accounting.sql:95) — whitelist 2 giá trị.
    loai: z.enum(['phai_tra', 'phai_thu']).optional(),
    qua_han: z.boolean().optional(),
    q: z.string().max(100).optional(),
    // core clamp: ||500, min(.,5000) — trần zod khớp lõi (2 tầng).
    limit: z.number().int().min(1).max(5000).optional(),
  },
  ledgerReport: {
    tu_ngay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'tu_ngay phải dạng YYYY-MM-DD').optional(),
    den_ngay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'den_ngay phải dạng YYYY-MM-DD').optional(),
  },
  // ketoan.ts — ghi (nghiệp vụ vượt trần: QC206 "chưa HĐ không chi", cân
  // Nợ/Có, kỳ đóng → envelope business error ở core, không biểu diễn bằng zod):
  vatInvoiceSave: {
    so_hd: z.string().min(1).max(64),
    tien_thue: z.number().min(0),
    tien_hang: z.number().min(0).optional(),
    ty_le: z.number().min(0).optional(),
    ncc: z.string().max(200).optional(),
    ngay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ngay phải dạng YYYY-MM-DD').optional(),
    ref_id: z.string().max(12).optional(),
  },
  phieuChiCreate: {
    cong_no_id: z.string().min(1).max(12),
    so_tien: z.number().min(0),
    ngay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ngay phải dạng YYYY-MM-DD').optional(),
    hinh_thuc: z.string().max(20).optional(),
    nguoi_nhan: z.string().max(100).optional(),
    note: z.string().max(500).optional(),
    cp_ve_phuphi: z.number().min(0).optional(),
  },
  kyClose: {
    ten_ky: z.string().min(1).max(100),
    tu_ngay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'tu_ngay phải dạng YYYY-MM-DD'),
    den_ngay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'den_ngay phải dạng YYYY-MM-DD'),
  },
  kyOpen: {
    id: z.string().min(1).max(12).optional(),
    ten_ky: z.string().min(1).max(100).optional(),
  },
  // ledger.ts — ghi sổ kép + tra cứu. entries: mỗi dòng đúng 1 bên Nợ|Có > 0,
  // tổng Nợ = tổng Có, tài khoản phải tồn tại trong `tai_khoan` (ma_so
  // VARCHAR(16)) — mọi ràng buộc phán quyết ở core (ledgerPost envelope).
  // nguoi KHÔNG phải input: core lấy meName(actor) (chống mạo danh ghi sổ).
  ledgerPost: {
    so_ct: z.string().min(1).max(64),
    ngay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ngay phải dạng YYYY-MM-DD'),
    loai_ct: z.string().min(1).max(32),
    ref_type: z.string().max(32).optional(),
    ref_id: z.string().max(12).optional(),
    note: z.string().max(500).optional(),
    entries: z
      .array(
        z.object({
          tai_khoan: z.string().min(1).max(16),
          du_no: z.number().min(0).optional(),
          du_co: z.number().min(0).optional(),
        })
      )
      .min(2)
      .max(50),
  },
  ledgerList: {
    tai_khoan: z.string().max(16).optional(),
    tu_ngay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'tu_ngay phải dạng YYYY-MM-DD').optional(),
    den_ngay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'den_ngay phải dạng YYYY-MM-DD').optional(),
    loai_ct: z.string().max(32).optional(),
    // core: ||500, min(.,5000) — trần khớp 2 tầng.
    limit: z.number().int().min(1).max(5000).optional(),
  },
  // khachhang.ts — whitelist field đúng EDITABLE_FIELDS (chống column-injection:
  // field lạ rơi vào .passthrough() nhưng core CHỈ đọc 7 khóa, không đụng SQL).
  khachHangList: {
    q: z.string().max(100).optional(),
    // core clamp page>=1, limit 1..200.
    page: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(200).optional(),
  },
  khachHangGet: {
    id: z.string().min(1).max(12),
  },
  khachHangSave: {
    // id có mặt = UPDATE (lõi trim); vắng = INSERT KH-000001 qua nextId.
    id: z.string().min(1).max(12).optional(),
    ten: z.string().min(1).max(200),
    sdt: z.string().max(20).optional(),
    dia_chi: z.string().max(300).optional(),
    email: z.string().max(100).optional(),
    ma_so_thue: z.string().max(20).optional(),
    la_ncc: z.boolean().optional(),
    ghi_chu: z.string().max(1000).optional(),
  },
  khachHangDel: {
    id: z.string().min(1).max(12),
  },
  // baoduong.ts — trần 200 khớp HANG_MUC_MAX lõi; enum ≡ CHECK trang_thai
  // (header baoduong.ts); ngày sai format lõi chỉ bỏ về '' (zod chặn sớm hơn).
  baoDuongTao: {
    xe_id: z.string().min(1).max(12),
    hang_muc: z.string().min(1).max(200),
    ngay_du_kien: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ngay_du_kien phải dạng YYYY-MM-DD').optional(),
    ngay_thuc_hien: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ngay_thuc_hien phải dạng YYYY-MM-DD').optional(),
    trang_thai: z.enum(['cho', 'xong', 'bo']).optional(),
  },
  baoDuongList: {
    xe_id: z.string().min(1).max(12),
  },
};

/**
 * Convert a ZodRawShape to a JSON Schema object.
 * Supports: z.string(), z.number(), z.boolean(), z.enum([...]), and .optional()
 * Nested objects/arrays use z.any() → treated as { type: 'object', additionalProperties: true }
 */
export function zodShapeToJsonSchema(shape: z.ZodRawShape): any {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const [key, zodType] of Object.entries(shape)) {
    let propSchema: any = { type: 'object', additionalProperties: true }; // default for z.any()
    let isOptional = false;

    // Check if it's an optional wrapper
    if (zodType instanceof z.ZodOptional) {
      isOptional = true;
      // Unwrap to get the inner type
      const innerType = zodType.unwrap();
      propSchema = zodTypeToJsonSchema(innerType);
    } else {
      propSchema = zodTypeToJsonSchema(zodType);
    }

    properties[key] = propSchema;

    if (!isOptional) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: true,
  };
}

function zodTypeToJsonSchema(zodType: z.ZodTypeAny): any {
  // Handle ZodString
  if (zodType instanceof z.ZodString) {
    return { type: 'string' };
  }

  // Handle ZodNumber
  if (zodType instanceof z.ZodNumber) {
    return { type: 'number' };
  }

  // Handle ZodBoolean
  if (zodType instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }

  // Handle ZodEnum
  if (zodType instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: zodType.options,
    };
  }

  // Handle ZodOptional (should be handled by caller, but defensive)
  if (zodType instanceof z.ZodOptional) {
    return zodTypeToJsonSchema(zodType.unwrap());
  }

  // Handle ZodNullable
  if (zodType instanceof z.ZodNullable) {
    const inner = zodTypeToJsonSchema(zodType.unwrap());
    return {
      anyOf: [inner, { type: 'null' }],
    };
  }

  // Handle ZodArray
  if (zodType instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodTypeToJsonSchema(zodType.element),
    };
  }

  // Handle ZodObject
  if (zodType instanceof z.ZodObject) {
    return zodShapeToJsonSchema(zodType.shape);
  }

  // Handle ZodAny, ZodUnknown, ZodUnion, ZodIntersection, etc.
  // Fallback: permissive object
  return { type: 'object', additionalProperties: true };
}

/**
 * Get a Zod schema for a tool input by function name.
 * Returns a Zod schema suitable for MCP SDK's registerTool inputSchema.
 * If shape exists in RPC_SCHEMAS, wraps it; otherwise returns empty passthrough object.
 */
export function getToolInputSchema(fn: string): z.ZodTypeAny {
  const shape = RPC_SCHEMAS[fn];
  return shape ? z.object(shape).passthrough() : z.object({}).passthrough();
}