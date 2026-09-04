import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";
function sidFrom(req: NextRequest) { return req.cookies.get(SESSION_COOKIE)?.value; }

export async function POST(req: NextRequest) {
  const actor = verifySession(sidFrom(req));
  if (!actor) return NextResponse.json({ ok: false }, { status: 401 });
  const cfg = await req.json().catch(()=>null);
  if (!cfg?.baseURL || !cfg?.apiKey) return NextResponse.json({ ok: false, error: "Thiếu baseURL/apiKey" }, { status: 400 });
  try {
    const r = await fetch(cfg.baseURL.replace(/\/$/,"") + "/models", { headers: { Authorization: `Bearer ${cfg.apiKey}` } });
    if (!r.ok) {
      // Thử chat completions với prompt nhỏ nếu /models không hỗ trợ
      const r2 = await fetch(cfg.baseURL.replace(/\/$/,"") + "/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
        body: JSON.stringify({ model: cfg.model, messages: [{role:"user", content:"ping"}], max_tokens: 5 })
      });
      if (!r2.ok) throw new Error(await r2.text());
      return NextResponse.json({ ok: true, model: cfg.model });
    }
    const j:any = await r.json();
    return NextResponse.json({ ok: true, model: j.data?.[0]?.id || cfg.model });
  } catch (e:any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
