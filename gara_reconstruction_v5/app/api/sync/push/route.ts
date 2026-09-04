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

  const device = parsed.data.device_id || actor.id;
  const conflicts: any[] = [];
  const accepted: string[] = [];

  // Tự đăng ký thiết bị chưa biết (Spoke lần đầu) — upsert idempotent
  await db.query(
    "INSERT INTO sync_devices(id, ten_may, last_seen, trang_thai) VALUES($1,$1,'','online') ON CONFLICT (id) DO UPDATE SET last_seen='', trang_thai='online'",
    [device]
  ).catch(() => {});

  for (const item of parsed.data.items) {
    // Idempotent: client id đã confirm-ok trước đó → conflict "đã đồng bộ" (không ghi trùng)
    const done: any = await db.query(
      "SELECT chi_tiet FROM sync_log WHERE ref_id=$1 AND huong='confirm' AND trang_thai='ok' AND device_id=$2 ORDER BY id DESC LIMIT 1",
      [item.id, device]
    ).then((r: any) => r.rows[0]).catch(() => null);
    if (done) {
      let prev: any = null;
      try { prev = JSON.parse(done.chi_tiet || "null"); } catch {}
      conflicts.push({ id: item.id, reason: "Đã đồng bộ trước đó", serverRow: prev });
      continue;
    }
    // Validate sơ bộ theo loại (validate sâu + RBAC do core ở confirm)
    if (item.loai === "scCreate" && !item.payload?.xe_id) {
      conflicts.push({ id: item.id, reason: "Thiếu xe_id" });
      continue;
    }
    if (item.loai === "scAddVatTu" && (!item.payload?.sc_id || !item.payload?.vattu_id)) {
      conflicts.push({ id: item.id, reason: "Thiếu sc_id/vattu_id" });
      continue;
    }
    if (item.loai === "nhapKho" && (!item.payload?.vattu_id || !(item.payload?.so_luong > 0))) {
      conflicts.push({ id: item.id, reason: "Thiếu vattu_id/so_luong" });
      continue;
    }
    if (item.loai === "dmCreate" && (!Array.isArray(item.payload?.items) || !item.payload.items.length)) {
      conflicts.push({ id: item.id, reason: "Thiếu items" });
      continue;
    }
    accepted.push(item.id);
    // Lưu nguyên payload để confirm dispatch mà không cần client gửi lại
    await db.query(
      "INSERT INTO sync_log(device_id, huong, loai, ref_id, trang_thai, chi_tiet) VALUES($1,'push',$2,$3,'ok',$4)",
      [device, item.loai, item.id, JSON.stringify(item)]
    ).catch(() => {});
  }

  for (const c of conflicts) {
    if (c.reason === "Đã đồng bộ trước đó") continue; // không spam log cho idempotent replay
    await db.query(
      "INSERT INTO sync_log(device_id, huong, loai, ref_id, trang_thai, chi_tiet) VALUES($1,'push','validate',$2,'conflict',$3)",
      [device, c.id, c.reason]
    ).catch(() => {});
  }

  return NextResponse.json({ ok: true, accepted, conflicts });
}
