/**
 * UAT/write-report.mjs — Ghi báo cáo từng case + cập nhật SUMMARY + status trong index.json.
 * Chạy: node UAT/write-report.mjs <TC-ID> <status> [ghi_chu]
 * (Node ghi UTF-8 chuẩn, tránh lỗi encoding của PowerShell 5.1.)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const [id, status, note] = [process.argv[2], process.argv[3] || '?', process.argv[4] || ''];
if (!id) { console.error('Thiếu TC-ID'); process.exit(1); }

const idxPath = resolve(__dirname, 'cases', 'index.json');
const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
const c = idx.cases.find((x) => x.id === id);
if (!c) { console.error('Không tìm thấy case', id); process.exit(1); }

const t0 = new Date().toISOString().slice(0, 16).replace('T', ' ');
mkdirSync(resolve(__dirname, 'reports'), { recursive: true });

const body = `# ${id} — ${c.title}

- **Vai**: ${c.role}
- **Kết quả**: ${status}
- **Video**: \`UAT/videos/${id}.webm\`
- **Thời gian chạy**: ${t0}
- **Ghi chú**: ${note || '_(điền thủ công nếu cần)_'}
- **Tính năng đã bổ sung**: _(điền nếu chạy bộc lộ tính năng ẩn)_
`;
writeFileSync(resolve(__dirname, 'reports', `${id}.md`), body, 'utf8');

// Cập nhật trạng thái trong index.json
c.status = status;
writeFileSync(idxPath, JSON.stringify(idx, null, 2), 'utf8');

// Cập nhật SUMMARY.md
const lines = idx.cases.map(
  (x) => `| ${x.id} | ${x.title} | ${x.role} | ${x.status} | \`UAT/videos/${x.id}.webm\``,
);
const summary = `# UAT SUMMARY (tự động cập nhật mỗi phiên)

| Case | Tên | Vai | Kết quả | Video |
|---|---|---|---|---|
${lines.join('\n')}

> Sinh bởi UAT/write-report.mjs — chạy: \`pwsh UAT/run-case.ps1 <id>\` hoặc \`pwsh UAT/run-all.ps1\`
`;
writeFileSync(resolve(__dirname, 'reports', 'SUMMARY.md'), summary, 'utf8');
console.log('✔ report', id, '→', status);
