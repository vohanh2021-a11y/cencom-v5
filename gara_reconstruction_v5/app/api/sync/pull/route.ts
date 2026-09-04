import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
function sidFrom(req: NextRequest) { return req.cookies.get(SESSION_COOKIE)?.value; }

export async function GET(req: NextRequest) {
  const actor = verifySession(sidFrom(req));
  if (!actor) return NextResponse.json({ ok: false, error: "Chưa đăng nhập" }, { status: 401 });
  const since = req.nextUrl.searchParams.get("since") || "1970-01-01";
  // Trả delta đơn giản: vattu/xe mới
  const [vattu, xe, sc] = await Promise.all([
    db.query("SELECT id, ten, ton, gia, don_vi FROM vattu WHERE deleted_at='' AND is_test=0 ORDER BY id").then((r:any)=>r.rows).catch(()=>[]),
    db.query("SELECT id, bien_so, chu_xe FROM xe WHERE deleted_at='' AND is_test=0 ORDER BY bien_so").then((r:any)=>r.rows).catch(()=>[]),
    db.query("SELECT id, xe_id, trang_thai, ngay_tao FROM sc WHERE deleted_at='' ORDER BY ngay_tao DESC LIMIT 100").then((r:any)=>r.rows).catch(()=>[]),
  ]);
  return NextResponse.json({ ok: true, vattu, xe, sc, since });
}
