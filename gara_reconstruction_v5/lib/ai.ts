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
  const url = cfg.baseURL.replace(/\/$/, "") + "/chat/completions";
  const body: any = {
    model: cfg.model,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    temperature: 0.3,
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
