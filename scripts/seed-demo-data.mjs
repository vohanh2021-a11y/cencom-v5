/**
 * seed-demo-data.mjs — Sinh dữ liệu transaction thực cho video UX audit.
 *
 * - Kết nối Postgres qua DATABASE_URL từ .env.local dùng pg Pool.
 * - Idempotent: nếu SC is_test đã tồn tại → thoát 0 (không tạo lại).
 * - Tạo 5 SC (is_test=1) cho xe đã seed, mỗi SC có 2-3 sc_cong_viec.
 * - 3 vattu có ton > 0 (để kho/phiếu nhập xuất có dữ liệu).
 * - 2 baogia_ncc.
 * - 2 ho_so (mới thêm cho video).
 * - Set must_change=0 cho user admin (nếu cột tồn tại).
 *
 * Chạy: node scripts/seed-demo-data.mjs
 */
import pg from 'pg';
import { createHash } from 'crypto';

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  console.error('❌ Thiếu DATABASE_URL');
  process.exit(1);
}

// Helper: pad number to 4 digits (cho HO-SO/CT numbering)
const pad4 = (n) => String(n).padStart(4, '0');

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5 });

async function q(sql, params = []) {
  await pool.query(sql, params);
}

async function main() {
  console.log('🔗 Kết nối DB...');
  const client = await pool.connect();
  try {
    // ---- Kiểm tra idempotent: nếu đã có SC is_test thì bỏ qua ----
    console.log('🔍 Kiểm tra dữ liệu tồn tại (idempotent)...');
    const existCheck = await pool.query(
      `SELECT COUNT(*) AS cnt FROM phieu_sua WHERE is_test = 1`
    );
    const already = Number(existCheck.rows[0].cnt) > 0;
    if (already) {
      console.log('✅ Đã có phiếu sửa chữa is_test=1, bỏ qua (idempotent).');
      await pool.end();
      process.exit(0);
    }

    // ---- Đảm bảo cột is_test tồn tại trên các bảng ----
    console.log('🛠️ Đảm bảo cột is_test cho các bảng...');
    await q(`ALTER TABLE xe ADD COLUMN IF NOT EXISTS is_test SMALLINT DEFAULT 0`);
    await q(`ALTER TABLE phieu_sua ADD COLUMN IF NOT EXISTS is_test SMALLINT DEFAULT 0`);
    await q(`ALTER TABLE vattu ADD COLUMN IF NOT EXISTS is_test SMALLINT DEFAULT 0`);
    await q(`ALTER TABLE bao_gia_ncc ADD COLUMN IF NOT EXISTS is_test SMALLINT DEFAULT 0`);
    await q(`ALTER TABLE phieu_nhap ADD COLUMN IF NOT EXISTS is_test SMALLINT DEFAULT 0`);
    await q(`ALTER TABLE phieu_xuat ADD COLUMN IF NOT EXISTS is_test SMALLINT DEFAULT 0`);
    await q(`ALTER TABLE ho_so ADD COLUMN IF NOT EXISTS is_test SMALLINT DEFAULT 0`);

    // ---- Seed 3 vật tư có ton > 0 (nếu chưa có) ----
    console.log('📦 Đảm bảo vật tư có sẵn (ton > 0)...');
    const vattuData = [
      ['VT-0001', 'Nhớt động cơ 15W-40', 'Nhớt', 'Can 4L', 320000, 50, 20],
      ['VT-0002', 'Lọc dầu động cơ', 'Linh kiện', 'Cái', 85000, 30, 10],
      ['VT-0003', 'Má phanh trước', 'Phanh', 'Bộ', 450000, 12, 5],
      ['VT-0004', 'Buli curoa truyền động', 'Động cơ', 'Cái', 120000, 25, 8],
      ['VT-0005', 'Ắc quy xe tải 12V', 'Điện', 'Cái', 850000, 8, 3],
      ['VT-0006', 'Bơm cao áp', 'Động cơ', 'Cái', 1500000, 6, 2],
    ];
    for (const [code, name, nhom, donvi, gia, ton, tonMin] of vattuData) {
      await q(
        `INSERT INTO vattu (code, name, nhom, donvi, gia, ton, ton_min, active, tenant_id, is_test)
         VALUES ($1,$2,$3,$4,$5,$6,$7,1,'c1',1)
         ON CONFLICT (code) DO UPDATE SET name=$2, nhom=$3, donvi=$4, gia=$5, ton=$6, ton_min=$7, is_test=1`,
        [code, name, nhom, donvi, gia, ton, tonMin],
      );
    }
    console.log('  ✅ Vật tư đã sẵn sàng (6 vật tư, ton > 0).');

    // ---- Lấy biển số xe thực từ DB ----
    console.log('🚛 Lấy danh sách xe...');
    const xeRes = await pool.query(`SELECT id, bks FROM xe WHERE deleted_at = '' ORDER BY id LIMIT 10`);
    const xeList = xeRes.rows;
    if (xeList.length < 3) {
      console.error('❌ Chưa đủ xe (cần chạy seed xe trước); tìm thấy:', xeList.length);
      await pool.end();
      process.exit(1);
    }
    console.log(`  ✅ Tìm thấy ${xeList.length} xe: ${xeList.map((r) => r.bks).join(', ')}`);

    // ---- Tạo 5 SC (is_test=1), mỗi SC có 2-3 công việc ----
    console.log('🔧 Tạo 5 phiếu sửa chữa (SC) là test data...');
    const scIds = ['SC-000011', 'SC-000012', 'SC-000013', 'SC-000014', 'SC-000015'];
    const today = new Date().toISOString().slice(0, 10);
    const ngayTruoc = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);

    // Xóa SC cũ nếu có (theo ID cố định)
    await q(`DELETE FROM sc_congviec WHERE sc_id = ANY($1)`, [scIds]);
    await q(`DELETE FROM sc_vattu WHERE sc_id = ANY($1)`, [scIds]);
    await q(`DELETE FROM phieu_sua WHERE id = ANY($1)`, [scIds]);

    const scDescriptions = [
      ['SC-000011', 'KTM-1111', 'de_xuat', 'Kiểm tra tiếng kêu động cơ, thay nhớt định kỳ', 'Lê Văn A'],
      ['SC-000012', 'KTM-2222', 'da_duyet', 'Thay má phanh trước, bảo dưỡng hệ thống phanh', 'Lê Văn A'],
      ['SC-000013', 'KTM-3333', 'dang_sua', 'Sửa bơm cao áp, thay buli curoa', 'Trần Văn B'],
      ['SC-000014', 'KTM-4444', 'da_hoan', 'Thay ắc quy, kiểm tra hệ thống điện', 'Lê Văn A'],
      ['SC-000015', 'KTM-5555', 'cho_duyet', 'Cấp phân quyền và kiểm tra tổng quan', 'Khoa C'],
    ];

    // Map role to navigation target for video flow
    const roleTargets = {
      admin: '/',
      giamdoc: '/',
      kho: '/kho',
      xuong: '/sc',
      ketoan: '/baogia',
    };

    for (const [scId, bks, trangThai, moTa, nguoiLap] of scDescriptions) {
      const xe = xeList.find((x) => x.bks === bks) || xeList[0];
      await q(
        `INSERT INTO phieu_sua (id, bks, xe_id, nguoi_lap, ngay, trang_thai, tong_cong, tong_vt, tong, is_test, tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,1,'c1')`,
        [scId, bks, xe.id, nguoiLap, ngayTruoc, trangThai, 2500000, 1200000, 3700000],
      );

      // Mỗi SC có 2-3 sc_cong_viec
      const congViecCount = 2 + Math.floor(Math.random() * 2); // 2 or 3
      const cvTheLoai = ['thay_the', 'khac_phuc'];
      for (let cv = 0; cv < congViecCount; cv++) {
        await q(
          `INSERT INTO sc_congviec (sc_id, ten, donvi, so_luong, don_gia, thanh, tt, stt, loai_xu_ly, tenant_id)
           VALUES ($1,$2,$3,$4,$5,$6,'todo',$7,$8,'c1')`,
          [scId, `Công việc ${cv + 1} cho ${scId}`, 'Cái', 1, 100000 + cv * 100000, 100000 + cv * 100000, cv + 1, cvTheLoai[cv % cvTheLoai.length]],
        );
      }
      console.log(`  ✅ SC ${scId} tạo xong (${congViecCount} công việc).`);
    }

    // ---- Phiếu nhập kho 3 vật tư ----
    console.log('📥 Tạo phiếu nhập kho...');
    const phieuNhapIds = ['PN-000011', 'PN-000012', 'PN-000013'];
    const todayStr = new Date().toISOString().slice(0, 10);
    for (const pId of phieuNhapIds) {
      await q(
        `INSERT INTO phieu_nhap (id, ngay, nguoi_lap, nha_cc, nguoi_duyet, tong, ghi_chu, loai_nhap, tenant_id, is_test)
         VALUES ($1,$2,'khoa-1','Công ty TNHH Phụ tùng An Phát','quanly-1', 1850000, 'Nhập vật tư bảo dưỡng tháng', 'moi',1)`,
        [pId, todayStr],
      );
    }
    // 3 dòng vật tư nhập
    for (let i = 1; i <= 3; i++) {
      const vtCode = `VT-000${i}`;
      await q(
        `INSERT INTO phieu_nh_ct (ph_id, vattu_id, ten, donvi, so_luong, dgia, thanh, ncc, tenant_id, is_test)
         VALUES ($1,(SELECT id FROM vattu WHERE code=$2),$3,'Can',5,320000,1600000,'An Phát',1)`,
        [phieuNhapIds[i - 1], vtCode, `Vật tư ${i}`],
      );
    }
    console.log('  ✅ Phiếu nhập kho tạo xong (3 phiếu, 3 vật tư).');

    // ---- Phiếu xuất kho ----
    console.log('📤 Tạo phiếu xuất kho...');
    const phieuXuatId = 'PX-000011';
    await q(
      `INSERT INTO phieu_xuat (id, ngay, nguoi_lap, ref_sc, ghi_chu, nguoi_nhan, loai_xuat, tenant_id, is_test)
       VALUES ($1,$2,'khoa-1',$3,'Xuất vật tư cho SC','Lê Văn A','dung','c1',1)`,
      [phieuXuatId, todayStr, 'SC-000012'],
    );
    // 1 dòng vật tư xuất
    await q(
      `INSERT INTO phieu_xuat_ct (ph_id, vattu_id, ten, donvi, so_luong, dgia, thanh, ref_sc, tenant_id, is_test)
       VALUES ($1,(SELECT id FROM vattu WHERE code='VT-0004'),'Buli curoa','Cái',1,120000,120000,$2,'c1',1)`,
    [phieuXuatId, 'SC-000012'],
    );
    console.log('  ✅ Phiếu xuất kho tạo xong.');

    // ---- 2 báo giá NCC ----
    console.log('📄 Tạo 2 báo giá NCC...');
    const today2 = new Date().toISOString().slice(0, 10);
    for (let i = 1; i <= 2; i++) {
      const scRef = scIds[Math.floor(Math.random() * scIds.length)];
      await q(
        `INSERT INTO bao_gia_ncc (dm_id, sc_id, ncc_ten, ncc_dia_chi, ncc_sdt, ngay, loai_chung_tu, nguoi_lap, tenant_id, is_test)
         VALUES ($1,$2,'Công ty TNHH Phụ tùng An Phát','123 Đường Láng, Hà Nội','0901234567',$3,'bao_gia','demo-seed',1)`,
        [DNM, scRef, today2], // DNM là de_nghi_mua id đã seed trước
      );
    }
    console.log('  ✅ 2 báo giá NCC tạo xong.');

    // ---- 2 hồ sơ (ho_so) ----
    console.log('📁 Tạo 2 hồ sơ (ho_so)...');
    for (let i = 1; i <= 2; i++) {
      const scRef = scIds[i - 1];
      await q(
        `INSERT INTO ho_so (id, sc_id, so_chung_tu, ngay, ghi_chu, nguoi_lap, is_test, tenant_id)
         VALUES ($1,$2,$3,$4,$5,'khoa-1',1,'c1')`,
        [`HO-SO-${pad4(i)}`, scRef, `CT-${pad4(i)}`, today2, `Hồ sơ kiểm tra ${i}`],
      );
    }
    console.log('  ✅ 2 hồ sơ tạo xong.');

    // ---- Set must_change=0 cho user admin (nếu cột tồn tại) ----
    console.log('🔐 Cấu hình user admin (must_change=0)...');
    try {
      // Thử cập nhật user admin - admin có thể là id='admin-1' hoặc name='admin'
      const adminRes = await pool.query(`SELECT id, name, must_change FROM users WHERE name ILIKE 'admin%' LIMIT 1`);
      if (adminRes.rows.length > 0) {
        const adminUser = adminRes.rows[0];
        await q(`UPDATE users SET must_change = 0 WHERE id = $1`, [adminUser.id]);
        console.log(`  ✅ Đã set must_change=0 cho user ${adminUser.id} (${adminUser.name}): ${adminUser.must_change} → 0`);
      } else {
        console.log('  ⚠️ Không tìm thấy user admin, bỏ qua must_change.');
      }
    } catch (e) {
      console.log('  ⚠️ Không thể set must_change (cột có thể chưa tồn tại):', e.message);
    }

    // ---- Cập nhật counter ----
    console.log('🔢 Cập nhật counter...');
    await q(`UPDATE config SET value='000015' WHERE key='counter_SC'`);
    await q(`UPDATE config SET value='000013' WHERE key='counter_PXN'`);
    await q(`UPDATE config SET value='000011' WHERE key='counter_PXX'`);
    await q(`UPDATE config SET value='000014' WHERE key='counter_DX'`);
    await q(`UPDATE config SET value='000012' WHERE key='counter_DNM'`);

    console.log('✅ Demo data sẵn sàng cho video UX audit.');
  } finally {
    await pool.end();
  }
}

main().catch(async (e) => {
  console.error('❌ Lỗi nghiêm trọng:', e);
  try { await pool.end(); } catch {}
  process.exit(1);
});