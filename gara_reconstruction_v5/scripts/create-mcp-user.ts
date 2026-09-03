/** GĐ9 init — tạo tài khoản MCP chuyên dụng (one-shot, idempotent).
 *  Chạy: DATABASE_URL=... npx tsx scripts/create-mcp-user.ts <username> <password> <role>
 *  Quyền chỉ định qua ROLE + pass mạnh sinh bên ngoài (crypto trong flow init).
 *  must_change=0: MCP HTTP không có luồng đổi mật khẩu trên client AI. */
import pg from 'pg';
import { hashPassword } from '../lib/auth';

async function main() {
  const [name, pass, role] = [process.argv[2], process.argv[3], process.argv[4] || 'giamdoc'];
  if (!name || !pass) throw new Error('cần <username> <password> [role]');
  if (!['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'].includes(role)) throw new Error('role sai');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const id = `U-${name.toUpperCase()}`;
    await pool.query(
      `INSERT INTO users (id, name, role, pass_hash, must_change, deleted_at)
       VALUES ($1,$2,$3,$4,0,'')
       ON CONFLICT (id) DO UPDATE SET pass_hash=$4, must_change=0, role=$3`,
      [id, name, role, hashPassword(pass)]
    );
    console.log(`[create-mcp-user] OK ${name} (${role})`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
