/**
 * mailer.ts — Abstraction gửi email (GĐ-0, tự chứa) — PORT từ draft v4
 * `packages/core/src/mailer.ts` (commit 8397979) sang v5 `lib/core/`.
 *
 * Hành vi giữ NGUYÊN như v4:
 *  - Mặc định NoopMailer (không gửi — dùng khi chưa cấu hình SMTP, on-premise).
 *  - Có SMTP_HOST: nạp nodemailer qua require() (dependency TÙY CHỌN — không ép
 *    cài). Thiếu nodemailer → ghi WARN một lần + fallback Noop (fail-open:
 *    mất thông báo nhưng không làm hỏng luồng nghiệp vụ).
 *
 * Delta v4 → v5 (chỉ hình thức, KHÔNG đổi hành vi):
 *  1) console.log/warn → createScopedLogger('mailer') — chuẩn observability v5
 *     (log cấu trúc {module, msg, meta} gom về một định dạng để trace).
 *  2) Bỏ 'use strict' (thừa trong TS/ESM) và bỏ default export — quy ước
 *     lib/core v5 chỉ dùng named exports.
 *
 * Dùng cho: reset mật khẩu, thông báo 2FA / nhắc hạn (GĐ-5/4).
 * LƯU Ý REG: module CHƯA đăng ký trong lib/rpc.ts (đây là hạ tầng). Khi nối
 * vào luồng gọi: BAT BUOC `await mailer.send(...)` — cam fire-and-forget theo
 * chuẩn async dự án; send() không throw (trả {ok,error}) nên caller phải tự
 * kiểm tra cờ ok trước khi báo "đã gửi" cho user.
 */
import { createScopedLogger } from '../observability';

const log = createScopedLogger('mailer');

export interface MailMessage {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export interface Mailer {
  send(msg: MailMessage): Promise<{ ok: boolean; error?: string }>;
}

class NoopMailer implements Mailer {
  async send(msg: MailMessage): Promise<{ ok: boolean; error?: string }> {
    log.logInfo('bỏ qua (noop)', { to: msg.to, subject: msg.subject });
    return { ok: true };
  }
}

class SmtpMailer implements Mailer {
  private client: any;
  constructor(client: any) { this.client = client; }
  async send(msg: MailMessage): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.client.sendMail({ from: process.env['SMTP_FROM'] || 'cencomos@local', ...msg });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Lỗi gửi mail' };
    }
  }
}

let _mailer: Mailer | null = null;
let _warned = false;

export function getMailer(): Mailer {
  if (_mailer) return _mailer;
  if (process.env['SMTP_HOST']) {
    try {
      // Dependency tùy chọn: nodemailer KHÔNG có trong package.json v5 —
      // require trong try/catch để tự bật khi user cài thêm. Lưu ý build:
      // về sau khi module được import vào graph của Next, nếu webpack báo
      // "Can't resolve 'nodemailer'" thì hoặc cài nodemailer, hoặc khai báo
      // serverExternalPackages trong next.config.js (quyết định của coordinator
      // tại bước reg — file này không tự sửa config).
      const nodemailer = require('nodemailer');
      const client = nodemailer.createTransport({
        host: process.env['SMTP_HOST'],
        port: Number(process.env['SMTP_PORT'] || 587),
        secure: process.env['SMTP_SECURE'] === '1',
        auth: process.env['SMTP_USER']
          ? { user: process.env['SMTP_USER'], pass: process.env['SMTP_PASS'] }
          : undefined,
      });
      _mailer = new SmtpMailer(client);
    } catch (e: any) {
      if (!_warned) {
        log.logWarn('SMTP_HOST đặt nhưng thiếu nodemailer → dùng Noop', { error: e?.message });
        _warned = true;
      }
    }
  }
  if (!_mailer) _mailer = new NoopMailer();
  return _mailer;
}
