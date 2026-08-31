# MCP Server — CencomOS Gara v5

> **Mục đích:** Đồng nhất Web ↔ Core ↔ MCP — AI host (Claude Desktop, opencode, Cursor...) gọi tool tên **giống hệt** RPC fn name, đi **cùng cửa phân quyền** RBAC, mọi lệnh ghi **audit `channel=mcp`** vào `activity_log`.

---

## 1. Kiến trúc tóm tắt

```
AI Host (Claude / opencode / Cursor)
  │  stdio (JSON-RPC)
  ▼
mcp-server/index.ts        ← MCP stdio transport
  │  1. loadMcpEnv()       ← .env.mcp → MCP_USER/MCP_PASS/MCP_ROLE/MCP_WRITE_TOOLS
  │  2. resolveActor()     ← login() → Actor {id, name, role}
  │  3. getRegistry()      ← FN_LIST, META, HANDLERS, OPEN (lib/rpc.ts)
  │  4. TOOL_DOCS          ← tool-docs.ts (song ngữ vi/en)
  │  5. isWriteAllowed()   ← WRITE guard (allowlist)
  │  6. auditMcpCall()     ← ghi activity_log
  ▼
Core layer (lib/core/*)     ← RBAC can() là trọng tài cuối
```

**Nguyên tắc anti-confusion:**
- Tool name = RPC fn name **từng ký tự** (vd `hoSoCheck`, KHÔNG phải `hoso_check`).
- Tool tự sinh từ registry `rpc.ts` — **KHÔNG viết code MCP riêng** cho từng fn.
- OPEN fn (`login`, `logout`, `currentUser`, `appInfo`) bị **loại khỏi MCP tool list** (AI không cần login qua MCP).

---

## 2. Bảng 36 fn — Lấy từ `lib/rpc.ts`

> Dữ liệu trích xuất trực tiếp từ `FN_LIST`, `META`, `OPEN` trong `lib/rpc.ts`.
> **32 tool** xuất hiện trong MCP; **4 OPEN** không có trong MCP tool list.

| # | `fn` (RPC name) | `tool name` (MCP) | `perm` (META) | Mode | Trong MCP? |
|---|---|---|---|---|---|
| 1 | `login` | — | — (OPEN) | — | ❌ |
| 2 | `logout` | — | — (OPEN) | — | ❌ |
| 3 | `currentUser` | — | — (OPEN) | READ | ❌ |
| 4 | `appInfo` | — | — (OPEN) | READ | ❌ |
| 5 | `xeList` | `xeList` | `xe.xem` | READ | ✅ |
| 6 | `xeGet` | `xeGet` | `xe.xem` | READ | ✅ |
| 7 | `xeCreate` | `xeCreate` | `xe.tao` | WRITE | ✅ |
| 8 | `scList` | `scList` | `sc.xem` | READ | ✅ |
| 9 | `scGet` | `scGet` | `sc.xem` | READ | ✅ |
| 10 | `scCreate` | `scCreate` | `sc.tao` | WRITE | ✅ |
| 11 | `scAddCongViec` | `scAddCongViec` | `sc.sua` | WRITE | ✅ |
| 12 | `scAddVatTu` | `scAddVatTu` | `sc.sua` | WRITE | ✅ |
| 13 | `scBatDauSua` | `scBatDauSua` | `sc.sua` | WRITE | ✅ |
| 14 | `scHoanThanh` | `scHoanThanh` | `sc.sua` | WRITE | ✅ |
| 15 | `scTuChoi` | `scTuChoi` | `sc.sua` | WRITE | ✅ |
| 16 | `scQuyetToan` | `scQuyetToan` | `sc.kehoach` | WRITE | ✅ |
| 17 | `vattuList` | `vattuList` | `kho.xem` | READ | ✅ |
| 18 | `vattuGet` | `vattuGet` | `kho.xem` | READ | ✅ |
| 19 | `vattuCreate` | `vattuCreate` | `kho.tao` | WRITE | ✅ |
| 20 | `nhapKho` | `nhapKho` | `kho.tao` | WRITE | ✅ |
| 21 | `xuatKho` | `xuatKho` | `kho.xuat` | WRITE | ✅ |
| 22 | `dmCreate` | `dmCreate` | `kho.tao` | WRITE | ✅ |
| 23 | `dmNhap` | `dmNhap` | `kho.tao` | WRITE | ✅ |
| 24 | `baogiaList` | `baogiaList` | `baogia.xem` | READ | ✅ |
| 25 | `baogiaGet` | `baogiaGet` | `baogia.xem` | READ | ✅ |
| 26 | `baogiaSave` | `baogiaSave` | `baogia.tao` | WRITE | ✅ |
| 27 | `hoSoGet` | `hoSoGet` | `hoso.xem` | READ | ✅ |
| 28 | `hoSoSave` | `hoSoSave` | `hoso.tao` | WRITE | ✅ |
| 29 | `hoSoList` | `hoSoList` | `hoso.xem` | READ | ✅ |
| 30 | `hoSoCheck` | `hoSoCheck` | `hoso.xem` | READ | ✅ |
| 31 | `keHoachSave` | `keHoachSave` | `sc.sua` | WRITE | ✅ |
| 32 | `kiemTuSave` | `kiemTuSave` | `sc.sua` | WRITE | ✅ |
| 33 | `nghiemThuSave` | `nghiemThuSave` | `sc.kehoach` | WRITE | ✅ |
| 34 | `activityFeed` | `activityFeed` | `activityFeed.xem` | READ | ✅ |
| 35 | `dashboard` | `dashboard` | `dashboard.xem` | READ | ✅ |
| 36 | `report` | `report` | `report.xem` | READ | ✅ |

**Tổng kết:** 36 fn → 32 MCP tool (14 READ + 18 WRITE) + 4 OPEN (không trong MCP).

---

## 3. Cách chạy

### Yêu cầu
- Node.js ≥ 18
- PostgreSQL đang chạy
- File `.env.mcp` trong `mcp-server/` (hoặc fallback `.env.local` ở root):

```bash
# mcp-server/.env.mcp
MCP_USER=admin
MCP_PASS=your-strong-password
MCP_ROLE=giamdoc          # optional, mặc định 'giamdoc'
MCP_WRITE_TOOLS=''         # optional, mặc định '' = chỉ đọc

# Fallback từ .env.local (root):
DATABASE_URL=postgres://postgres:postgres@localhost:5432/cencom
SESSION_SECRET=change-me-strong-secret
```

### Khởi chạy

```bash
# Cách 1: npm script (khuyến nghị)
npm run mcp

# Cách 2: trực tiếp
npx tsx mcp-server/index.ts
```

**Output trên stderr:**
```
MCP cencom-gara-v5 v5.0.0 ready (32 tools, actor=admin role=giamdoc write=)
```

### Chế độ READ-ONLY vs WRITE

| `MCP_WRITE_TOOLS` | Kết quả |
|---|---|
| `''` (mặc định) | Chỉ 14 READ tools hoạt động. 18 WRITE tools trả `403 write tool disabled`. |
| `'xeCreate,scCreate'` | 14 READ + 2 WRITE được phép. Các WRITE khác vẫn `403`. |
| `'xeCreate,scCreate,vattuCreate,nhapKho,xuatKho,dmCreate,dmNhap,baogiaSave,scAddCongViec,scAddVatTu,scBatDauSua,scHoanThanh,scTuChoi,scQuyetToan,hoSoSave,keHoachSave,kiemTuSave,nghiemThuSave'` | Tất cả 32 tools hoạt động (read + write). |

---

## 4. Cấu hình AI Host

### opencode (`opencode.json`)

```json
{
  "mcpServers": {
    "cencom-gara-v5": {
      "command": "npx",
      "args": ["tsx", "mcp-server/index.ts"],
      "cwd": "E:\\APP-LAPTOP-SYNC\\cencomOS_gara_4.0_supa\\gara_reconstruction_v5",
      "env": {
        "MCP_USER": "admin",
        "MCP_PASS": "your-strong-password",
        "MCP_ROLE": "giamdoc",
        "MCP_WRITE_TOOLS": ""
      }
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "cencom-gara-v5": {
      "command": "npx",
      "args": ["tsx", "mcp-server/index.ts"],
      "cwd": "E:\\APP-LAPTOP-SYNC\\cencomOS_gara_4.0_supa\\gara_reconstruction_v5",
      "env": {
        "MCP_USER": "admin",
        "MCP_PASS": "your-strong-password",
        "MCP_ROLE": "giamdoc",
        "MCP_WRITE_TOOLS": ""
      }
    }
  }
}
```

---

## 5. Quy tắc thêm hàm mới = 3 bước

> **TUYỆT ĐỐI KHÔNG viết code MCP riêng cho từng fn mới.** Tool tự sinh từ registry.

### Bước 1: Thêm vào `lib/rpc.ts`
```typescript
// FN_LIST: thêm tên fn mới
export const FN_LIST: string[] = [..., 'fnMoi'];

// META: khai báo quyền (quên = fail-closed, 403)
const META: Record<string, [string, string]> = {
  ...,
  fnMoi: ['module', 'permission'],
};

// HANDLERS: thêm handler
const HANDLERS: Record<string, ...> = {
  ...,
  fnMoi: async (api, args) => { ... },
};
```

### Bước 2: Thêm entry `mcp-server/tool-docs.ts`
```typescript
// Thêm vào part file (part1/part2/part3) tương ứng:
fnMoi: {
  title: 'Tên tool',
  descVi: 'Mô tả tiếng Việt (khi nào gọi, dùng để gì).',
  descEn: 'English description (when to call, what it does).',
  mode: 'READ',  // hoặc 'WRITE'
  example: { /* args mẫu nếu fn cần tham số bắt buộc */ },
},
```

### Bước 3: Thêm test parity
Thêm test case vào `tests/conformance/rpc.test.ts` (hoặc file test tương ứng) để verify fn mới hoạt động đúng với từng role.

### Lưu ý quan trọng
- **Đổi tên fn = breaking change** cho AI đã "học" tên tool. Tránh đổi tên sau khi đã deploy.
- Nếu fn mới là READ → thêm vào `READ_TOOLS` trong `mcp-server/auth.ts`.
- Nếu fn mới là WRITE → không cần làm gì thêm (default là WRITE, cần allowlist trong `MCP_WRITE_TOOLS`).

---

## 6. Security Note

| Lớp | Bảo mật |
|---|---|
| **Mặc định** | Read-only. `MCP_WRITE_TOOLS=''` → mọi WRITE tool bị chặn. |
| **RBAC (lớp 2)** | Mỗi fn có `META[fn]` → core `can()` kiểm tra role + module + permission. Fail-closed: fn chưa khai báo META → **từ chối**. |
| **Audit (lớp 3)** | Mọi lệnh gọi MCP (thành công + thất bại) đều ghi `activity_log` với `channel=mcp`, bao gồm: `fn`, `actor`, `role`, `result`. |
| **Secret** | `MCP_PASS` chỉ nằm trong `.env.mcp` (không commit). Log không chứa pass/token. |
| **WRITE guard** | Kiểm tra `isWriteAllowed()` **trước** khi gọi core handler — blocked request không chạm DB. |

---

## 7. File structure

```
mcp-server/
├── index.ts              ← MCP stdio server (main)
├── auth.ts               ← Service-account auth + WRITE guard + audit
├── env.ts                ← Load .env.mcp + fallback
├── tool-docs.ts          ← Aggregate tool descriptions (vi/en)
├── tool-docs.part1.ts    ← Descriptions: Xe CRUD + SC CRUD + Luồng SC
├── tool-docs.part2.ts    ← Descriptions: SC reply/settle + Kho + Báo giá
├── tool-docs.part3.ts    ← Descriptions: Hồ sơ + Activity + Dashboard
├── .env.mcp              ← MCP_USER/MCP_PASS/MCP_ROLE/MCP_WRITE_TOOLS
└── README.md             ← Tài liệu này
```
