/**
 * UAT/cases/generate.mjs — Sinh file UAT/cases/<TC-ID>.md từ index.json.
 * Mỗi file: kịch bản AI đọc + plan-task + template báo cáo (điền khi chạy).
 * Chạy: node UAT/cases/generate.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..', '..');
const idxPath = resolve(__dirname, 'index.json');
const data = JSON.parse(readFileSync(idxPath, 'utf8'));

const DOMAIN_VI = { sua_chua: 'Sửa chữa xe', mua_sam: 'Mua sắm vật tư', quyet_toan: 'Quyết toán & báo cáo' };

function render(c) {
  const steps = c.steps
    .map((s, i) => `${i + 1}. **Làm**: ${s.do}\n   **Mong đợi**: ${s.expect}`)
    .join('\n');
  return `# ${c.id} — ${c.title}

> **Miền nghiệp vụ**: ${DOMAIN_VI[c.domain] || c.domain}
> **Vai thực hiện**: ${c.role}  ·  **Vai liên quan**: ${c.rolesInvolved.join(', ')}
> **Ưu tiên**: ${c.priority}  ·  **Trạng thái**: ${c.status}

## 1. Kịch bản (AI đọc)
Mục tiêu: ${c.title}.
Điều kiện tiên quyết: đăng nhập bằng tài khoản vai **${c.role}** (mật khẩu chung \`${data.meta.password}\`).

### Các bước (plan-task)
${steps}

## 2. Kết quả kỳ vọng
${c.expected}

## 3. Tiêu chí đạt (verify)
${c.verify}

## 4. Tính năng ẩn có thể phát sinh
${c.discover}

## 5. Báo cáo kết quả (điền khi chạy)
| Trường | Giá trị |
|---|---|
| Kết quả | ☐ Đạt / ☐ Không đạt / ☐ Cần bổ sung tính năng |
| Video | \`${data.meta.videoDir}/${c.id}.webm\` |
| Ghi chú / Lỗi gặp | _(điền)_ |
| Tính năng đã bổ sung | _(điền)_ |
| Ngày chạy | _(điền)_ |

---
*Tự động sinh từ UAT/cases/index.json. Chạy: \`pwsh UAT/run-case.ps1 ${c.id}\`*
`;
}

mkdirSync(__dirname, { recursive: true });
for (const c of data.cases) {
  const p = resolve(__dirname, `${c.id}.md`);
  writeFileSync(p, render(c), 'utf8');
  console.log('✔', c.id);
}
console.log(`✅ Đã sinh ${data.cases.length} file case.`);
