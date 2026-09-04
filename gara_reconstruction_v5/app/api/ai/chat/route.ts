import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptConfig } from "@/lib/ai-config";
import { callProvider, SYSTEM_PROMPT } from "@/lib/ai";
import { getRegistry } from "@/lib/rpc";
import { buildApi } from "@/lib/api";
import { resolveActor } from "@/mcp-server/auth";

export const dynamic = "force-dynamic";

function sidFrom(req: NextRequest) {
  return req.cookies.get(SESSION_COOKIE)?.value;
}

export async function POST(req: NextRequest) {
  const actor = verifySession(sidFrom(req));
  if (!actor) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });

  const { messages, conversation_id } = await req.json().catch(() => ({ messages: [] }));
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ ok: false, error: "Thiếu messages" }, { status: 400 });
  }

  // Đọc config AI từ bảng config
  const cfgRow: any = await db.query("SELECT value FROM config WHERE key='ai_provider'").then((r: any) => r.rows[0]).catch(() => null);
  const secret = process.env.SESSION_SECRET || "";
  const cfg = cfgRow ? decryptConfig(cfgRow.value, secret) : null;
  if (!cfg) {
    return NextResponse.json({ ok: false, error: "Chưa cấu hình AI. Vào Cài đặt → AI để nhập provider/model." }, { status: 400 });
  }

  // Lấy tools registry để cho AI gọi
  const registry = getRegistry();
  const tools = Object.entries(registry).map(([name, fn]: any) => ({
    name,
    description: fn.description || name,
    inputSchema: { type: "object", properties: {} },
  })).slice(0, 30); // giới hạn 30 tools đầu để tránh quá token

  try {
    // Gọi provider
    const result = await callProvider(cfg, messages, tools);

    // Nếu AI gọi tool, thực thi tool tại HUB và gọi lại provider
    if (result.tool_calls?.length) {
      const toolResults: any[] = [];
      const apiActor = await resolveActor().catch(() => actor);
      const api = buildApi(apiActor as any);
      for (const tc of result.tool_calls) {
        const fnName = tc.function?.name;
        const args = JSON.parse(tc.function?.arguments || "{}");
        const fn = (registry as any)[fnName];
        if (fn) {
          try {
            const r = await fn(api, args);
            toolResults.push({ tool_call_id: tc.id, role: "tool", name: fnName, content: JSON.stringify(r).slice(0, 4000) });
          } catch (e: any) {
            toolResults.push({ tool_call_id: tc.id, role: "tool", name: fnName, content: `Lỗi: ${e.message}` });
          }
        }
      }
      // Gọi lại provider với kết quả tool
      const followUp = await callProvider(cfg, [
        ...messages,
        { role: "assistant", content: result.content, tool_calls: result.tool_calls } as any,
        ...toolResults.map((tr) => ({ role: "user" as const, content: `[Tool ${tr.name}]: ${tr.content}` })),
      ]);
      // Lưu hội thoại
      await saveHistory(conversation_id, actor.id, messages, followUp.content, result.tool_calls);
      return NextResponse.json({ ok: true, content: followUp.content, tool_calls: result.tool_calls });
    }

    await saveHistory(conversation_id, actor.id, messages, result.content, null);
    return NextResponse.json({ ok: true, content: result.content });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

async function saveHistory(convId: string | undefined, userId: string, userMsgs: any[], assistantContent: string, toolCalls: any) {
  try {
    let cid = convId;
    if (!cid) {
      cid = `AIC-${Date.now().toString(36).toUpperCase()}`;
      await db.query("INSERT INTO ai_conversations(id, user_id, tieu_de) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [cid, userId, userMsgs[0]?.content?.slice(0, 50) || ""]);
    }
    const lastUser = userMsgs[userMsgs.length - 1];
    if (lastUser) {
      await db.query("INSERT INTO ai_messages(conversation_id, role, content) VALUES($1,'user',$2)", [cid, lastUser.content]);
    }
    await db.query("INSERT INTO ai_messages(conversation_id, role, content, tool_calls) VALUES($1,'assistant',$2,$3)", [cid, assistantContent, toolCalls ? JSON.stringify(toolCalls) : null]);
  } catch {}
}
