import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";
const Schema = z.object({ ids: z.array(z.string()).min(1), device_id: z.string().optional() });

function sidFrom(req: NextRequest) { return req.cookies.get(SESSION_COOKIE)?.value; }

export async function POST(req: NextRequest) {
  const actor = verifySession(sidFrom(req));
  if (!actor) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });

  // Trong v1, confirm chỉ ghi log — dữ liệu thực đã được push trước đó validated
  // Logic ghi PG thực tế sẽ do từng loại `loai` dispatch (scCreate → scCreate core)
  // Ở đây chỉ audit
  for (const id of parsed.data.ids) {
    await db.query("INSERT INTO sync_log(device_id, huong, loai, ref_id, trang_thai) VALUES($1,'confirm','sync',$2,'ok')", [parsed.data.device_id || actor.id, id]).catch(()=>{});
  }
  return NextResponse.json({ ok: true, synced: parsed.data.ids.length });
}
