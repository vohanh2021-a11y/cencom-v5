import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { db } from "@/lib/db";
import { encryptConfig, decryptConfig, AiProviderConfig } from "@/lib/ai-config";

export const dynamic = "force-dynamic";
function sidFrom(req: NextRequest) { return req.cookies.get(SESSION_COOKIE)?.value; }

export async function GET(req: NextRequest) {
  const actor = verifySession(sidFrom(req));
  if (!actor) return NextResponse.json({ ok: false }, { status: 401 });
  const row: any = await db.query("SELECT value FROM config WHERE key='ai_provider'").then((r:any)=>r.rows[0]).catch(()=>null);
  if (!row) return NextResponse.json({ ok: true, config: null });
  const cfg = decryptConfig(row.value, process.env.SESSION_SECRET || "");
  if (!cfg) return NextResponse.json({ ok: true, config: null });
  // Không trả apiKey đầy đủ
  return NextResponse.json({ ok: true, config: { ...cfg, apiKey: cfg.apiKey ? "****" + cfg.apiKey.slice(-4) : "" } });
}

export async function POST(req: NextRequest) {
  const actor = verifySession(sidFrom(req));
  if (!actor) return NextResponse.json({ ok: false }, { status: 401 });
  if (!["admin","giamdoc"].includes(actor.role)) return NextResponse.json({ ok: false, error: "Chỉ admin/giamdoc" }, { status: 403 });
  const body = await req.json().catch(()=>null) as AiProviderConfig;
  if (!body?.baseURL || !body?.apiKey || !body?.model) return NextResponse.json({ ok: false, error: "Thiếu baseURL/apiKey/model" }, { status: 400 });
  const secret = process.env.SESSION_SECRET || "";
  const enc = encryptConfig(body, secret);
  await db.query("INSERT INTO config(key, value) VALUES('ai_provider',$1) ON CONFLICT(key) DO UPDATE SET value=$1", [enc]);
  return NextResponse.json({ ok: true });
}
