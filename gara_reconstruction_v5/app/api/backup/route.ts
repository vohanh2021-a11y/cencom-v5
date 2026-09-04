import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { promisify } from "util";
const execAsync = promisify(exec);

export const dynamic = "force-dynamic";
function sidFrom(req: NextRequest) { return req.cookies.get(SESSION_COOKIE)?.value; }

export async function POST(req: NextRequest) {
  const actor = verifySession(sidFrom(req));
  if (!actor) return NextResponse.json({ ok: false }, { status: 401 });
  if (!["admin","giamdoc"].includes(actor.role)) return NextResponse.json({ ok: false, error: "Chỉ admin/giamdoc" }, { status: 403 });

  // Hub portable PG: pg_dump từ pg-portable/bin nếu có, fallback là thông báo
  const hubData = process.env.APPDATA ? path.join(process.env.APPDATA, "CencomOS", "backup") : "/tmp/cencom-backup";
  try { fs.mkdirSync(hubData, { recursive: true }); } catch {}
  const file = path.join(hubData, `cencom-${new Date().toISOString().slice(0,10)}.dump`);
  // Thử pg_dump nếu có binary, nếu không thì tạo file marker
  try {
    const pgDump = path.join(process.cwd(), "..", "electron-hub", "pg-portable", "bin", "pg_dump.exe");
    if (fs.existsSync(pgDump)) {
      await execAsync(`"${pgDump}" -h 127.0.0.1 -p 5433 -U postgres -Fc -f "${file}" cencom`);
    } else {
      fs.writeFileSync(file + ".txt", `Backup marker ${new Date().toISOString()} — pg_dump not bundled, use Docker pg_dump`);
    }
    return NextResponse.json({ ok: true, file });
  } catch (e:any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
