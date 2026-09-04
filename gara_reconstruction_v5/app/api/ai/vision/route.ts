import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptConfig } from "@/lib/ai-config";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
function sidFrom(req: NextRequest) { return req.cookies.get(SESSION_COOKIE)?.value; }

export async function POST(req: NextRequest) {
  const actor = verifySession(sidFrom(req));
  if (!actor) return NextResponse.json({ ok: false }, { status: 401 });
  const form = await req.formData().catch(()=>null);
  const file = form?.get("image") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "Thiếu image" }, { status: 400 });

  const row: any = await db.query("SELECT value FROM config WHERE key='ai_provider'").then((r:any)=>r.rows[0]).catch(()=>null);
  const cfg = row ? decryptConfig(row.value, process.env.SESSION_SECRET||"") : null;
  if (!cfg) return NextResponse.json({ ok: false, error: "Chưa cấu hình AI" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const b64 = buf.toString("base64");
  const mime = file.type || "image/jpeg";

  const prompt = `Extract JSON {ncc: string, ngay: string (YYYY-MM-DD), items: [{ten: string, don_vi: string, so_luong: number, don_gia: number}]} from this handwritten invoice image. Return ONLY valid JSON, no markdown.`;

  try {
    const url = cfg.baseURL.replace(/\/$/,"") + "/chat/completions";
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: "user", content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } }
        ]}],
        temperature: 0.1
      })
    });
    if (!r.ok) throw new Error(await r.text());
    const j:any = await r.json();
    let content = j.choices?.[0]?.message?.content || "";
    // Bóc JSON
    const m = content.match(/\{[\s\S]*\}/);
    if (m) content = m[0];
    const extracted = JSON.parse(content);
    const id = `AIV-${Date.now().toString(36).toUpperCase()}`;
    await db.query("INSERT INTO ai_vision_jobs(id, extracted, trang_thai) VALUES($1,$2,'xong')", [id, JSON.stringify(extracted)]).catch(()=>{});
    return NextResponse.json({ ok: true, extracted, job_id: id });
  } catch (e:any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
