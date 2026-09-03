import { z } from "zod";

export interface ModelEntry {
  /** opencode model id, dạng "provider/model", vd: "opencode/hy3-free", "2009/mimo-v2.5" */
  id: string;
  /** nhãn provider để log/chẩn đoán: "zen" | "b.ai" */
  provider: string;
}

export interface Config {
  telegramBotToken: string;
  opencodeServeUrl: string;
  opencodeServeToken?: string;
  allowedUserIds: number[];
  allowedChatIds: string[];
  requireMention: boolean;
  maxPromptLen: number;
  logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
  modelPool: ModelEntry[];
  cooldownMs: number;
  maxAttempts: number;
  noResponseTimeoutMs: number;
  dwellMs: number;
  autoApprovePermissions: boolean;
  turnTimeoutMs: number;
  homeChannel?: string;
  serveAgent?: string;
  telegramWebhookUrl?: string;
  telegramWebhookSecret?: string;
}

export function coerceBool(v: string | undefined, def = false): boolean {
  if (v === undefined) return def;
  return ["1", "true", "yes", "on"].includes(v.trim().toLowerCase());
}

export function parseIdList(raw: string | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

/** MODEL_POOL dạng "opencode/hy3-free,2009/mimo-v2.5,..." hoặc để trống dùng mặc định. */
export function parseModelPool(raw: string | undefined): ModelEntry[] {
  if (!raw) return DEFAULT_MODEL_POOL;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((id) => {
      const provider = id.split("/")[0] || "unknown";
      return { id, provider };
    });
}

export function sanitizePrompt(input: string, maxLen: number): string {
  // Loại bỏ ký tự điều khiển (code point < 0x20), giữ lại \n \t \r.
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 && code !== 0x0a && code !== 0x09 && code !== 0x0d) continue;
    out += ch;
  }
  return out.trim().slice(0, maxLen);
}

// "zen" = tầng free nội bộ của opencode; "b.ai" = provider 2009.
// Khớp với các model free-tier đã lưu trong opencode config của bạn (mỗi key 5-7 model).
// Đã xen kẽ (interleave) zen <-> b.ai để mỗi bước switch đều bắt qua provider kia.
export const DEFAULT_MODEL_POOL: ModelEntry[] = [
  { id: "opencode/hy3-free", provider: "zen" },
  { id: "2009/mimo-v2.5", provider: "b.ai" },
  { id: "opencode/nemotron-3-ultra-free", provider: "zen" },
  { id: "2009/hy3", provider: "b.ai" },
  { id: "opencode/deepseek-v4-flash-free", provider: "zen" },
  { id: "2009/deepseek-v4-flash", provider: "b.ai" },
  { id: "opencode/nemotron-3.5-lightning-free", provider: "zen" },
  { id: "2009/glm-5.3-flash", provider: "b.ai" },
  { id: "opencode/mimo-v2.5-free", provider: "zen" },
  { id: "2009/qwen3.8-flash", provider: "b.ai" },
  { id: "2009/deepseek-v4-flash-vision-exp", provider: "b.ai" },
];

export function loadConfig(): Config {
  const schema = z.object({
    TELEGRAM_BOT_TOKEN: z.string().min(10),
    OPENCEDE_SERVE_URL: z.string().default("http://127.0.0.1:4096"),
    OPENCEDE_SERVE_TOKEN: z.string().optional(),
    ALLOWED_USER_IDS: z.string().optional(),
    ALLOWED_CHAT_IDS: z.string().optional(),
    REQUIRE_MENTION: z.string().optional(),
    MODEL_POOL: z.string().optional(),
    MODEL_COOLDOWN_MS: z.string().optional(),
    MODEL_MAX_ATTEMPTS: z.string().optional(),
    MODEL_DWELL_MS: z.string().optional(),
    NO_RESPONSE_TIMEOUT_MS: z.string().optional(),
    TURN_TIMEOUT_MS: z.string().optional(),
    AUTO_APPROVE_PERMISSIONS: z.string().optional(),
    MAX_PROMPT_LEN: z.string().optional(),
    LOG_LEVEL: z.string().optional(),
    HOME_CHANNEL: z.string().optional(),
    OPENCEDE_AGENT: z.string().optional(),
    TELEGRAM_WEBHOOK_URL: z.string().optional(),
    TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  });
  const p = schema.parse(process.env);
  const lvl = (p.LOG_LEVEL || "INFO").toUpperCase();
  return {
    telegramBotToken: p.TELEGRAM_BOT_TOKEN,
    opencodeServeUrl: p.OPENCEDE_SERVE_URL.replace(/\/$/, ""),
    opencodeServeToken: p.OPENCEDE_SERVE_TOKEN,
    allowedUserIds: parseIdList(p.ALLOWED_USER_IDS),
    allowedChatIds: (p.ALLOWED_CHAT_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    requireMention: coerceBool(p.REQUIRE_MENTION, true),
    maxPromptLen: p.MAX_PROMPT_LEN ? Number(p.MAX_PROMPT_LEN) : 4000,
    logLevel: (["DEBUG", "INFO", "WARN", "ERROR"].includes(lvl) ? lvl : "INFO") as Config["logLevel"],
    modelPool: parseModelPool(p.MODEL_POOL),
    cooldownMs: p.MODEL_COOLDOWN_MS ? Number(p.MODEL_COOLDOWN_MS) : 30 * 60 * 1000,
    maxAttempts: p.MODEL_MAX_ATTEMPTS ? Number(p.MODEL_MAX_ATTEMPTS) : 6,
    noResponseTimeoutMs: p.NO_RESPONSE_TIMEOUT_MS ? Number(p.NO_RESPONSE_TIMEOUT_MS) : 5 * 60 * 1000,
    dwellMs: p.MODEL_DWELL_MS ? Number(p.MODEL_DWELL_MS) : 30 * 60 * 1000,
    autoApprovePermissions: coerceBool(p.AUTO_APPROVE_PERMISSIONS, true),
    turnTimeoutMs: p.TURN_TIMEOUT_MS ? Number(p.TURN_TIMEOUT_MS) : 10 * 60 * 1000,
    homeChannel: p.HOME_CHANNEL,
    serveAgent: p.OPENCEDE_AGENT,
    telegramWebhookUrl: p.TELEGRAM_WEBHOOK_URL,
    telegramWebhookSecret: p.TELEGRAM_WEBHOOK_SECRET,
  };
}

/** Fail-closed: nếu không có allowlist hoặc user không khớp -> từ chối. */
export function isUserAllowed(cfg: Config, userId: number | undefined): boolean {
  if (!userId) return false;
  if (cfg.allowedUserIds.length === 0) return false;
  return cfg.allowedUserIds.includes(userId);
}
