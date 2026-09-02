/**
 * mcp-server/tool-docs.part7.ts — W4-reg: QUẢN TRỊ TÀI KHOẢN + NGƯỠNG DUYỆT
 * + TÌM KIẾM TOÀN CỤC + ĐỔI MẬT KHẨU TỰ THÂN (8 fn vào registry đợt gộp).
 *
 * Style trung thành part1-6: title + descVi ([vi]) + descEn ([en]) + mode + example.
 * Nguồn port:
 *  - lib/core/admin.ts  (v3.6 handlers.js:127–186 userList/userAdd/userSetPassword/
 *    userSetActive; :604–618 thresholds/thresholdsSet) — gateAdmin TRỰC TIẾP
 *    trong lõi, envelope 401/403, KHÔNG throw.
 *  - lib/core/search.ts globalSearch (v4 packages/core/src/search.ts — ILIKE
 *    UTF-8 + escape wildcard + is_test/soft-delete theo vai).
 *  - lib/auth.ts changePassword (v3.6 handlers.js:551–573 — verify mk cũ,
 *    brute-force 5 lần/15', cấm quay về default, clear cờ must_change).
 *
 * MCP quyền: READ docs (userList/thresholdsGet/globalSearch) luôn gọi được ở
 * mode mặc định MCP_WRITE_TOOLS='' — nhưng DISPATCH BỊ BỎ QUA ở MCP loop
 * (server-core gọi thẳng HANDLERS), nên quyền thật của 3 fn READ:
 * userList/thresholdsGet vẫn bị core gateAdmin chặn 403 khi MCP account không
 * phải admin (envelope, không exception); globalSearch = sc.xem mọi vai.
 * WRITE docs (userAdd/userSetPassword/userSetActive/thresholdsSet/
 * changePassword) deny mặc định — bật có chủ đích qua MCP_WRITE_TOOLS.
 */

interface ToolDoc {
  title: string;
  descVi: string;       // 1-2 câu tiếng Việt, tập trung KHI NÀO gọi
  descEn: string;
  mode: 'READ' | 'WRITE';
  example?: Record<string, unknown>;
}

export const PART7: Record<string, ToolDoc> = {
  userList: {
    title: 'Liệt kê tài khoản (chỉ admin)',
    descVi:
      'READ (quyền ["user","admin"] — core gateAdmin lớp 2): danh sách tài khoản đang SỐNG (id, đăng nhập, role, must_change, active, has_password — KHÔNG lộ pass_hash, v3.6:130). Truyền {include_deleted:true} để thấy cả tài khoản đã KHÓA (soft-delete deleted_at); limit clamp 1..500 (mặc định 100). v5 không có cột active — "khóa" = deleted_at ≠ "". Non-admin nhận envelope {ok:false,error:"403"} (200, không exception). Dùng khi kiểm tra danh BOOK tài khoản trước khi tạo/khóa/đặt lại mật khẩu.',
    descEn:
      'READ (perm ["user","admin"], core gateAdmin second layer): live account list (id, login, role, must_change, active, has_password — never pass_hash). {include_deleted:true} also shows locked (soft-deleted) accounts; limit clamped 1..500 (default 100). Non-admins get an {ok:false,error:"403"} envelope (HTTP 200, never throws). Use before adding, locking or resetting an account.',
    mode: 'READ',
    example: { include_deleted: true, limit: 50 },
  },
  userAdd: {
    title: 'Tạo tài khoản mới (chỉ admin)',
    descVi:
      'WRITE (["user","admin"] — v3.6 adminOnly handlers.js:653; core gateAdmin + validate lại): tạo tài khoản role đúng 5 giá trị CHECK (admin|giamdoc|xuong|ketoan|kho — role lạ BỊ TỪ CHỐI, không fallback "tho" như v3.6). Login chỉ [a-zA-Z0-9-_], trùng tên (kể cả đã khóa, case-insensitive) → lỗi "Đã tồn tại tài khoản". id sinh U-0000NN (nextId). Mật khẩu omitted → DEFAULT_PASSWORD + must_change=1 (người dùng BUỘC đổi lần đăng nhập đầu — GĐ3.6.2); custom phải ≥6 ký tự (siết hơn v3.6, OWASP A7). Audit user_add. Dùng khi tiếp nhận nhân sự mới vào hệ thống.',
    descEn:
      'WRITE (["user","admin"], v3.6 adminOnly; core re-validates): creates an account with one of the 5 CHECK roles (unknown roles rejected). Login restricted to [a-zA-Z0-9-_]; duplicate names (even locked, case-insensitive) error out. Id auto-generated U-0000NN. Omitted password → default + must_change=1 forcing first-login change; custom ≥6 chars. Audits user_add. Use when onboarding staff.',
    mode: 'WRITE',
    example: { name: 'nhvien01', role: 'xuong' },
  },
  userSetPassword: {
    title: 'Admin đặt lại mật khẩu tài khoản khác (không cần mk cũ)',
    descVi:
      'WRITE (["user","admin"] — reset của admin, KHÁC changePassword: không verify mật khẩu cũ, port handlers.js:165–172): {id, password?}. password omitted → đặt về DEFAULT và BẬT must_change=1; custom (≥6) → đổi hash nhưng GIỮ nguyên cờ must_change đang có (v3.6:165 không đụng — chỉ chính user changePassword mới xóa được cờ, lối thoát duy nhất khỏi màn "buộc đổi"). Custom trùng default → vẫn buộc đổi. Audit user_pw_reset. Dùng khi nhân viên quên mật khẩu.',
    descEn:
      'WRITE (["user","admin"]): admin reset — no old-password verify (unlike changePassword). {id, password?}: omitted → default password and must_change=1; custom (≥6 chars) → new hash but the must_change flag is KEPT as-is (only the user themselves can clear it via changePassword). Setting the literal default still forces a change. Audits user_pw_reset. Use when a staff member forgets their password.',
    mode: 'WRITE',
    example: { id: 'U-000007' },
  },
  userSetActive: {
    title: 'Khóa/mở tài khoản (chỉ admin, soft-delete)',
    descVi:
      'WRITE (["user","admin"] — v3.6 :175–186): {id, active:true|false}. v5 không có cột active: KHÓA = deleted_at=ISO (login chết ngay — auth.ts lọc deleted_at=""), MỞ = deleted_at="". Chặn theo v3.6:181: không khóa BẤT KỲ tài khoản admin nào (chống tự cô lập lockout) và không khóa chính mình. active không phải true/false/1/0 → lỗi validate (không đoán mù). Lưu ý parity: khóa KHÔNG đá session đang treo (v3.6 giữ hành vi), thu hồi session là việc riêng. Audit user_lock/user_open.',
    descEn:
      'WRITE (["user","admin"]): {id, active} — lock = soft-delete (deleted_at=ISO, login dies immediately), unlock = deleted_at="". Blocking any admin account or self is rejected (v3.6 anti-lockout). Strict boolean whitelist. Soft-locked sessions are NOT revoked (v3.6 parity). Audits user_lock/user_open. Use to offboard or temporarily disable staff.',
    mode: 'WRITE',
    example: { id: 'U-000007', active: false },
  },
  thresholdsGet: {
    title: 'Đọc ngưỡng duyệt + số năm khấu hao (chỉ admin)',
    descVi:
      'READ (["config","admin"] — core gateAdmin): omit key → đủ 3 giá trị config {duyet_sc_nguong, duyet_mua_nguong, khau_hao_nam} (default 5.000.000đ / 5.000.000đ / 10 năm — seed v3.6; đọc là đảm-định-key idempotent). Truyền {key} trong đúng whitelist 3 giá trị — key lạ TỪ CHỐI. v3.6 để lộ ngưỡng qua appInfo mọi user; v5 siết admin có chủ đích (ngưỡng = "trần duyệt" nhạy cảm). Non-admin → envelope 403. Dùng khi rà cấu hình phân quyền tiền trước khi đổi.',
    descEn:
      'READ (["config","admin"]): omit key → all three config values (approval thresholds + depreciation years, v3.6 defaults 5M VND / 5M VND / 10y); a single whitelisted key optional. Non-admins get a 403 envelope (v5 deliberately tightened — v3.6 leaked these via appInfo). Use to audit money-approval limits.',
    mode: 'READ',
  },
  thresholdsSet: {
    title: 'Đổi ngưỡng duyệt / năm khấu hao (chỉ admin)',
    descVi:
      'WRITE (["config","admin"] — v3.6 adminOnly thresholdsSet): {key ∈ đúng 3 whitelist, value}. Chuẩn hóa như v3.6:613–615: ngưỡng duyệt Number()||0 (rác/âm → 0 = không ai trong ngưỡng, fail-closed — v5 clamp ≥0); khau_hao_nam số nguyên ≥1 (rác → LỖI, không im lặng 10). Key ngoài whitelist bị chặn tường minh — chống poisoning counter_* của nextId trong bảng config. Ghi UPSERT config + audit config_set (key nằm trong mo_ta) + TRẢ SNAPSHOT 3 giá trị mới. Dùng khi đổi trần duyệt tiền cho quản lý/xưởng.',
    descEn:
      'WRITE (["config","admin"]): {key, value} over exactly the 3 whitelisted config keys. Approval thresholds normalize like v3.6 (junk/negative → 0, fail-closed); khau_hao_nam must be an integer ≥1. Off-whitelist keys rejected (protects nextId counters). Upserts config, audits config_set and returns the fresh 3-value snapshot.',
    mode: 'WRITE',
    example: { key: 'duyet_sc_nguong', value: 8000000 },
  },
  globalSearch: {
    title: 'Tìm kiếm toàn cục (SC / xe / đề nghị mua / vật tư)',
    descVi:
      'READ (["sc","xem"] — mọi vai): tra nhanh 4 nhóm bằng MỘT chuỗi ≥2 ký tự — SC theo mã hoặc BIỂN SỐ xe (JOIN), xe theo biển số, DM theo mã, vật tư theo tên. ILIKE UTF-8 không phân biệt HOA/thường (tiếng Việt có dấu nguyên văn); ký tự %/_/\\ được escape nguyên văn (gõ "%" không biến thành wildcard); limit clamp 1..30 (mặc định 10). Soft-delete ẩn; dữ liệu is_test chỉ admin/giamdoc thấy (pattern scList) — biển số xe test không rò qua JOIN cho vai thường. Envelope {ok,result:{sc,xe,dm,vattu}}. Không tham gia duyệt/xóa. Dùng làm ô search header / command palette để nhảy tới bản ghi.',
    descEn:
      'READ (["sc","xem"], every role): one ≥2-char term queries four groups — repair orders by code or plate (JOIN), vehicles by plate, purchase requests by code, materials by name. Case-insensitive UTF-8 ILIKE; %_\\ escaped literally; limit ≤30. Soft-deleted rows hidden, test data visible only to admin/giamdoc. Returns {ok,result:{sc,xe,dm,vattu}}. Use as the header search box / command palette jump tool.',
    mode: 'READ',
    example: { q: 'SC-000' },
  },
  changePassword: {
    title: 'Tự đổi mật khẩu của mình (mọi vai đã đăng nhập)',
    descVi:
      'WRITE (["security","doi_mk"] — cấp MỌI vai, v3.6 publicFns): {old_password, new_password}. KHÔNG có id trong args — chỉ đổi được tài khoản của CHÍNH người gọi (chống IDOR). Verify mật khẩu cũ (sai 5 lần/15 phút → khóa thử 15\' — chống brute-force in-process); mới ≥6 ký tự và CẤM trùng mật khẩu mặc định (không thì cờ must_change không bao giờ có nghĩa). Thành công: đổi hash + XÓA cờ must_change (đây là LỐI THOÁT DUY NHẤT khỏi màn "buộc đổi mật khẩu" — route /api/rpc whitelist fn này cho tài khoản đang bị khóa fn khác) + audit doi_mat_khau. Fn admin reset mật khẩu người khác là userSetPassword (không cần mk cũ).',
    descEn:
      'WRITE (["security","doi_mk"], every role — v3.6 publicFns): {old_password, new_password} for the CALLER\'S OWN account only (no id argument — IDOR-proof). Verifies the old password (5 wrong tries / 15 min → lockout), new must be ≥6 chars and not the system default. On success clears the must_change flag — the ONLY escape from the forced-change lock — and audits doi_mat_khau. Admin resets for others is userSetPassword.',
    mode: 'WRITE',
    example: { old_password: 'mat-khau-cu', new_password: 'MatKhauMoi#2026' },
  },
};
