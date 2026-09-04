import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildApi } from "@/lib/api";
import { scCreate, scAddVatTu } from "@/lib/core/sc";
import { nhapKho, dmCreate } from "@/lib/core/kho";
import { z } from "zod";

export const dynamic = "force-dynamic";
const Schema = z.object({ ids: z.array(z.string()).min(1).max(50), device_id: z.string().optional() });

function sidFrom(req: NextRequest) { return req.cookies.get(SESSION_COOKIE)?.value; }

/**
 * POST /api/sync/confirm — ghi thật các item đã push vào PG.
 * - Đọc payload từ sync_log push-ok (client không gửi lại).
 * - Dispatch đúng core fn (RBAC do core trọng tài — 403 lan ra failed[], không 500 cả mẻ).
 * - Idempotent theo client id: confirm lại trả mapping cũ, không ghi trùng.
 */
export async function POST(req: NextRequest) {
  const actor = verifySession(sidFrom(req));
  if (!actor) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.message }, { status: 400 });

  const device = parsed.data.device_id || actor.id;
  const api = buildApi(actor);
  const synced: { id: string; newId?: string; dup?: boolean }[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const id of parsed.data.ids) {
    try {
      // Idempotent: đã confirm-ok → trả mapping cũ
      const prev: any = await db.query(
        "SELECT chi_tiet FROM sync_log WHERE ref_id=$1 AND huong='confirm' AND trang_thai='ok' AND device_id=$2 ORDER BY id DESC LIMIT 1",
        [id, device]
      ).then((r: any) => r.rows[0]).catch(() => null);
      if (prev) {
        let m: any = null;
        try { m = JSON.parse(prev.chi_tiet || "null"); } catch {}
        synced.push({ id, newId: m?.newId, dup: true });
        continue;
      }
      // Lấy payload đã lưu ở push
      const pushRow: any = await db.query(
        "SELECT loai, chi_tiet FROM sync_log WHERE ref_id=$1 AND huong='push' AND trang_thai='ok' AND device_id=$2 ORDER BY id DESC LIMIT 1",
        [id, device]
      ).then((r: any) => r.rows[0]).catch(() => null);
      if (!pushRow) throw new Error("Chưa push hoặc đã bị từ chối ở push");
      let item: any = null;
      try { item = JSON.parse(pushRow.chi_tiet || "null"); } catch {}
      if (!item?.payload) throw new Error("Payload push hỏng");

      let newId = "";
      if (pushRow.loai === "scCreate") {
        const r = await scCreate(api, {
          xe_id: String(item.payload.xe_id),
          ngay: String(item.payload.ngay || new Date().toISOString().slice(0, 10)),
          ghi_chu_tham_kham: String(item.payload.ghi_chu_tham_kham || ""),
        });
        newId = r.id;
      } else if (pushRow.loai === "scAddVatTu") {
        const r = await scAddVatTu(api, {
          sc_id: String(item.payload.sc_id),
          vattu_id: String(item.payload.vattu_id),
          so_luong: Number(item.payload.so_luong),
          don_gia: Number(item.payload.don_gia ?? item.payload.gd_dk ?? 0),
        });
        newId = r.id;
      } else if (pushRow.loai === "nhapKho") {
        const r = await nhapKho(api, {
          vattu_id: String(item.payload.vattu_id),
          so_luong: Number(item.payload.so_luong),
          don_gia: item.payload.don_gia !== undefined ? Number(item.payload.don_gia) : undefined,
          ngay: String(item.payload.ngay || new Date().toISOString().slice(0, 10)),
          ly_do: item.payload.ly_do ? String(item.payload.ly_do) : undefined,
          ncc: item.payload.ncc ? String(item.payload.ncc) : undefined,
          sc_id: item.payload.sc_id ? String(item.payload.sc_id) : undefined,
        });
        newId = r.id;
      } else if (pushRow.loai === "dmCreate") {
        const r = await dmCreate(api, {
          sc_id: item.payload.sc_id ? String(item.payload.sc_id) : undefined,
          ngay: String(item.payload.ngay || new Date().toISOString().slice(0, 10)),
          items: (item.payload.items || []).map((it: any) => ({
            vattu_id: String(it.vattu_id),
            so_luong: Number(it.so_luong),
            don_gia: it.don_gia !== undefined ? Number(it.don_gia) : undefined,
          })),
        });
        newId = r.id;
      } else {
        throw new Error(`Loại chưa hỗ trợ: ${pushRow.loai}`);
      }

      await db.query(
        "INSERT INTO sync_log(device_id, huong, loai, ref_id, trang_thai, chi_tiet) VALUES($1,'confirm',$2,$3,'ok',$4)",
        [device, pushRow.loai, id, JSON.stringify({ client_id: id, newId })]
      ).catch(() => {});
      synced.push({ id, newId });
    } catch (e: any) {
      const msg = e?.message || "Lỗi không rõ";
      await db.query(
        "INSERT INTO sync_log(device_id, huong, loai, ref_id, trang_thai, chi_tiet) VALUES($1,'confirm','sync',$2,'failed',$3)",
        [device, id, msg]
      ).catch(() => {});
      failed.push({ id, error: msg });
    }
  }

  return NextResponse.json({ ok: true, synced, failed });
}
