/**
 * lib/ai-config.ts — Lưu/đọc cấu hình AI provider tại HUB
 * Dùng bảng config(key='ai_provider', value=encrypt(JSON))
 * Mã hóa AES-256-GCM với SESSION_SECRET (đã có trong env)
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

export interface AiProviderConfig {
  provider: "openai" | "anthropic" | "custom" | "zen";
  baseURL: string; // https://zen.opencode.ai/v1  (opencode zen, mimo 2.5)
  apiKey: string;
  model: string; // mimo-v2.5-flash-free
}

function keyFromSecret(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

export function encryptConfig(cfg: AiProviderConfig, secret: string): string {
  const key = keyFromSecret(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(cfg), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptConfig(encStr: string, secret: string): AiProviderConfig | null {
  try {
    const [ivHex, tagHex, dataHex] = encStr.split(":");
    const key = keyFromSecret(secret);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
    return JSON.parse(dec.toString("utf8"));
  } catch {
    return null;
  }
}
