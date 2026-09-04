import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { SyncPushSchema } from "@/lib/sync";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function sidFrom(req: NextRequest) {
  return req.cookies.get(SESSION_COOKIE)?.value;
}

export async function POST(req: NextRequest) {
  const actor = verifySession(sidFrom(req));
  if (!actor) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = SyncPushSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });

  const conflicts: any[] = [];
  const accepted: string[] = [];

  for (const item of parsed.data.items) {
    // Kiểm tra xung đột đơn giản: nếu payload có id đã tồn tại và updated_at mới hơn
    // Hiện tại chỉ validate Zod, chưa check DB chi tiết — trả accepted để Spoke confirm
    // Logic chi tiết sẽ so sánh serverRow.updated_at vs client_ts trong confirm
    if (item.loai === "scCreate" && item.payload.xe_id) {
      const exists = await db.query("SELECT id FROM sc WHERE id=$1 AND deleted_at=''", [item.id]).catch(() => ({ rows: [] }));
      if ((exists as any).rows?.length) {
        conflicts.push({ id: item.id, reason: "ID đã tồn tại trên HUB", serverRow: (exists as any).rows[0] });
        continue;
      }
    }
    accepted.push(item.id);
  }

  // Ghi sync_log
  try {
    for (const id of accepted) {
      await db.query("INSERT INTO sync_log(device_id, huong, loai, ref_id, trang_thai) VALUES($1,'push',$2,$3,'ok')", [parsed.data.device_id || actor.id, "push", id]);
    }
    for (const c of conflicts) {
      await db.query("INSERT INTO sync_log(device_id, huong, loai, ref_id, trang_thai, chi_tiet) VALUES($1,'push',$2,$3,'conflict',$4)", [parsed.data.device_id || actor.id, "conflict", c.id, c.reason]);
    }
  } catch {}

  return NextResponse.json({ ok: true, accepted, conflicts });
}
