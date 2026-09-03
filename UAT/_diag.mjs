// UAT/_diag.mjs — chẩn đoán export route theo từng vai
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = 'http://localhost:3000';
const roles = ['ketoan', 'giamdoc', 'laixe', 'xuong', 'khoa'];
const AUTH = resolve('UAT/.auth');

for (const r of roles) {
  let cookie = '';
  try {
    const s = JSON.parse(readFileSync(resolve(AUTH, `${r}.json`), 'utf8'));
    cookie = s.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  } catch (e) {
    console.log(r, 'NO STORAGE', e.message);
    continue;
  }
  try {
    const res = await fetch(`${BASE}/api/export/sc-hoso/SC-TEST-XYZ`, { headers: { cookie } });
    const txt = await res.text();
    console.log(r.padEnd(8), res.status, txt.slice(0, 160).replace(/\n/g, ' '));
  } catch (e) {
    console.log(r, 'FETCH ERR', e.message);
  }
}
