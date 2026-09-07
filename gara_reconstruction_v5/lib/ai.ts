/**
 * lib/ai.ts — AI nhúng tại HUB (plan 4.9)
 * - System prompt khóa phạm vi data
 * - Tool-calling qua registry MCP (81 tools)
 * - Gọi provider OpenAI-compatible (mimo, Muse Spark, custom)
 */

export const SYSTEM_PROMPT = `Bạn là trợ lý AI của garage CencomOS, CHỈ trả lời dựa trên dữ liệu nội bộ: tồn kho, công nợ, SC, DM, báo giá, xe, kế toán.
Nếu câu hỏi ngoài phạm vi (thời tiết, chính trị, kiến thức chung), hãy từ chối lịch sự và hướng về dữ liệu garage.
Khi cần số liệu, hãy gọi tool phù hợp (dashboardAll, tonKho, scList, congNoList, ledgerReport...). Không tự bịa số.
Trả lời ngắn gọn, tiếng Việt, có số liệu cụ thể khi có.`;

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  tool_calls?: any[];
}

export async function callProvider(
  cfg: { baseURL: string; apiKey: string; model: string },
  messages: AiChatMessage[],
  tools?: any[]
): Promise<{ content: string; tool_calls?: any[] }> {
  return callOne(cfg, cfg.model, messages, tools);
}

/**
 * C2 — fallback chain (deploy governance §7): gọi tuần tự qua danh sách model
 * `cfg.models` (mặc định [model]); lỗi mạng/429/5xx → thử model kế tiếp, kèm
 * cooldown per-model trong process (300s) tránh đập liên tục vào provider chết.
 * Log luôn "model được dùng" để đo tỷ lệ failover như 1 SLO riêng.
 */
const cooldownUntil = new Map<string, number>();
const COOLDOWN_MS = 300_000;

export function providerModels(cfg: { model: string; models?: unknown }): string[] {
  let extra: string[] = [];
  if (Array.isArray(cfg.models)) {
    extra = cfg.models.map((m) => String(m).trim()).filter(Boolean);
  } else if (typeof cfg.models === 'string' && cfg.models.trim()) {
    // cho phép nhập "mimo-v2.5, backup-model" thay vì JSON array
    extra = cfg.models.split(',').map((m) => m.trim()).filter(Boolean);
  }
  const list = [cfg.model, ...extra].map((m) => m.trim()).filter(Boolean);
  return [...new Set(list)];
}

export async function callProviderWithFallback(
  cfg: { baseURL: string; apiKey: string; model: string; models?: unknown },
  messages: AiChatMessage[],
  tools?: any[],
  log?: { info?: (m: string, meta?: any) => void; warn?: (m: string, meta?: any) => void }
): Promise<{ content: string; tool_calls?: any[]; modelUsed: string; failedModels: string[] }> {
  const models = providerModels(cfg);
  const failedModels: string[] = [];
  let lastErr: Error = new Error('Không có model nào được cấu hình');
  for (const model of models) {
    const cd = cooldownUntil.get(model) || 0;
    if (cd > Date.now()) {
      failedModels.push(`${model}(cooldown)`);
      continue;
    }
    try {
      const out = await callOne(cfg, model, messages, tools);
      if (model !== models[0]) {
        log?.warn?.('AI failover: dùng model dự phòng', { primary: models[0], used: model, failed: failedModels });
      } else {
        log?.info?.('AI ok', { model });
      }
      return { ...out, modelUsed: model, failedModels };
    } catch (e: any) {
      // 4xx client-error (trừ 408/429) là lỗi cấu hình/request → không cooldown, skip ngay
      const status = /Provider (\d{3})/.exec(e?.message || '')?.[1];
      const permanent = status && !['408', '429'].includes(status) && status.startsWith('4');
      if (!permanent) cooldownUntil.set(model, Date.now() + COOLDOWN_MS);
      log?.warn?.(`AI model lỗi: ${model}`, { status: status || 'network', permanent });
      failedModels.push(model);
      lastErr = e;
    }
  }
  throw lastErr;
}

async function callOne(
  cfg: { baseURL: string; apiKey: string },
  model: string,
  messages: AiChatMessage[],
  tools?: any[]
): Promise<{ content: string; tool_calls?: any[] }> {
  const url = cfg.baseURL.replace(/\/$/, "") + "/chat/completions";
  const body: any = {
    model,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    temperature: 0.3,
    timeout: 60_000,
  };
  if (tools?.length) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }));
    body.tool_choice = "auto";
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Provider ${res.status}: ${txt.slice(0, 300)}`);
  }
  const j: any = await res.json();
  const choice = j.choices?.[0]?.message;
  return {
    content: choice?.content || "",
    tool_calls: choice?.tool_calls,
  };
}
