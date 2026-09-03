import fs from 'fs';
import path from 'path';
import { db } from '../lib/db';
import { login } from '../lib/auth';
import { logActivity } from '../lib/core/activity';
import type { Actor } from '../lib/types';

/**
 * MCP Server Authentication Module
 * 
 * Service-account authentication for MCP stdio server.
 * Imports core directly (no HTTP) — runs as separate tsx process.
 * All calls audited with channel='mcp'.
 */

// Module-level cache for resolved actor
let cachedActor: Actor | null = null;

/**
 * Read set: tool names that are considered READ operations.
 * All other tools in FN_LIST are WRITE and require explicit allowlist.
 */
const READ_TOOLS = new Set<string>([
  'currentUser',
  'appInfo',
  'xeList',
  'xeGet',
  'scList',
  'scGet',
  'vattuList',
  'vattuGet',
  'baogiaList',
  'baogiaGet',
  'hoSoGet',
  'hoSoList',
  'hoSoCheck',
  'activityFeed',
  'dashboard',
  'report',
  // W1a: phiếu 2 tầng — READ (META ['kho','xem']); thiếu 2 dòng này → MCP mặc định
  // MCP_WRITE_TOOLS='' sẽ chặn 403 sai bản chất read-only của fn.
  'phieuList',
  'phieuGet',
  // W1.6f: asset — READ (META ['xe','xem']); thiếu 2 dòng này thì MCP vẫn chạy
  // (guard chỉ chặn khi doc.mode==='WRITE') nhưng READ_TOOLS phải phản ánh đúng
  // bản chất fn — assetXe/assetReport không ghi gì, không cần allowlist.
  'assetXe',
  'assetReport',
  // W1b-reg: tonKho/giaLichSuList — READ (META ['kho','xem']). Ghi rõ vào READ_TOOLS
  // để phân loại đúng bản chất fn (cả hai không ghi gì) thay vì dựa guard doc.mode.
  'tonKho',
  'giaLichSuList',
  // W1c-reg: thanhLyList — READ (META ['kho','xem']); bảng kê thuần đọc, không ghi
  // gì (dòng thanh_ly do autoGen/xuatKho viết là chuyện nội bộ transaction).
  'thanhLyList',
  // W2a: DM đọc 3 fn — READ thuần (META ['kho','xem']); dmDelete KHÔNG vào đây:
  // WRITE (META ['kho','sua'], soft-delete ghi DB) → cần MCP_WRITE_TOOLS allowlist.
  'dmList',
  'dmDetail',
  'dmListBySc',
  // W2b: dmDecide/dmFromSC/dmAutoBu KHÔNG vào READ_TOOLS — cả 3 là WRITE
  // (ghi dm/dm_chitiet + audit, xem tool-docs.part4 mode:'WRITE'); mặc định
  // MCP_WRITE_TOOLS='' → deny, bật ghi có chủ đích qua allowlist.
  // W3.1-reg: dashboardAll — READ thuần (META ['sc','xem'], core/xuong.ts):
  // Kanban + KPI chỉ đọc; 401/403-ketoan trả về là ENVELOPE {ok:false}, không ghi gì.
  'dashboardAll',
  // W3.3A: thoList — READ thuần (META ['sc','xem'], core/sc.ts): SELECT id+name users
  // role='xuong'. ScWorkSet/scWorkDel/scVtUpd/scVtDel/scSetDeadline KHÔNG vào đây —
  // WRITE ghi DB (dòng sc_congviec/sc_vattu/sc + audit) → MCP_WRITE_TOOLS='' mặc định deny.
  'thoList',
  // W3.5: scApprove/scTongDuyet KHÔNG vào READ_TOOLS — cả 2 là WRITE:
  // scApprove UPDATE sc.trang_thai/nguoi_duyet/ngay_duyet + audit; scTongDuyet
  // INSERT sc_phien_ban (snapshot đóng hồ sơ) + audit (core/sc.ts). Mặc định
  // MCP_WRITE_TOOLS='' → deny (tool-docs.part6 mode:'WRITE'), bật ghi có chủ đích.
  // W4-reg: globalSearch — READ thuần (META ['sc','xem'], core/search.ts): 4
  // SELECT ILIKE không ghi gì. userList/thresholdsGet — READ theo BẢN CHẤT
  // (SELECT users投影 + SELECT config); quyền admin thật do core gateAdmin
  // enforce (envelope 403 khi MCP account không admin) — vào READ_TOOLS để
  // phân loại đúng khuôn "READ_TOOLS phản ánh bản chất fn" (phòng 403 sai lệch
  // khi MCP_WRITE_TOOLS='' như bài học W1a phieuList).
  'globalSearch',
  'userList',
  'thresholdsGet',
  // W5-reg: bossDashboard/bossAlerts — READ thuần (META ['sc','xem'],
  // core/boss.ts): chỉ SELECT qua các fn lõi tonKho/dmList/dashboardAll/query
  // sc quá hạn — không ghi gì, không cần allowlist. Thiếu 2 dòng này thì
  // guard doc.mode vẫn cho qua, nhưng READ_TOOLS phải phản ánh đúng bản chất
  // fn (bài học W1a phieuList).
  'bossDashboard',
  'bossAlerts',
  // W6-reg: 8 fn READ thuần (chỉ SELECT/tính trên db — không ghi, audit chỉ
  // khi ghi nên ở đây cũng không audit-ghi): tinhGiaVon/reconcileKho/
  // congNoList/ledgerReport/ledgerList (ke_toan.xem trong lõi), khachHangList/
  // khachHangGet, baoDuongList. Vào READ_TOOLS để mặc định MCP_WRITE_TOOLS=''
  // không chặn sai bản chất (bài học W1a phieuList).
  'tinhGiaVon',
  'reconcileKho',
  'congNoList',
  'ledgerReport',
  'ledgerList',
  'khachHangList',
  'khachHangGet',
  'baoDuongList',
  // W6-reg: WRITE KHÔNG vào READ_TOOLS (mặc định deny, bật qua allowlist):
  // vatInvoiceSave/phieuChiCreate/kyClose/kyOpen (ghi vat_invoice/phieu_chi/
  // cong_no/ky + bút toán ledger tx); ledgerPost (INSERT chung_tu/ledger);
  // khachHangSave/khachHangDel (INSERT/UPDATE khach_hang + audit);
  // baoDuongTao (INSERT bao_duong_lich + audit).
  // W4-reg: userAdd/userSetPassword/userSetActive/thresholdsSet KHÔNG vào
  // READ_TOOLS — WRITE ghi users/config + audit (INSERT/UPDATE/soft-delete).
  // changePassword cũng KHÔNG — dù chỉ đụng tài khoản của chính MCP actor:
  // bản chất là WRITE (UPDATE pass_hash + must_change + audit doi_mat_khau),
  // mặc định MCP_WRITE_TOOLS='' deny là ĐÚNG — không cho agent âm thầm xoay
  // credential của service account; bật có chủ đích mới đổi được mk.
]);

/**
 * Load MCP environment from mcp-server/.env.mcp with UTF-16LE BOM support,
 * then fall back to ../.env.local for missing keys.
 * 
 * Env keys:
 * - MCP_USER (required)
 * - MCP_PASS (required)
 * - MCP_ROLE (optional, default: 'giamdoc')
 * - MCP_WRITE_TOOLS (optional, comma-separated, default: '')
 * - DATABASE_URL (fallback from .env.local)
 * - SESSION_SECRET (fallback from .env.local)
 */
export function loadMcpEnv(): void {
  const mcpEnvPath = path.join(__dirname, '.env.mcp');
  const rootEnvPath = path.join(__dirname, '..', '.env.local');

  // Load .env.mcp first (if exists)
  if (fs.existsSync(mcpEnvPath)) {
    loadEnvFile(mcpEnvPath);
  }

  // Fallback to root .env.local for missing keys
  if (fs.existsSync(rootEnvPath)) {
    loadEnvFile(rootEnvPath, true); // only set if not already set
  }

  // Default MCP_ROLE if not set
  if (!process.env.MCP_ROLE) {
    process.env.MCP_ROLE = 'giamdoc';
  }

  // Default MCP_WRITE_TOOLS if not set
  if (process.env.MCP_WRITE_TOOLS === undefined) {
    process.env.MCP_WRITE_TOOLS = '';
  }
}

/**
 * Load a single .env file with encoding detection (UTF-16LE BOM, UTF-16BE, UTF-8).
 * @param filePath Path to .env file
 * @param onlyIfMissing If true, only set env vars that are not already set
 */
function loadEnvFile(filePath: string, onlyIfMissing = false): void {
  const buffer = fs.readFileSync(filePath);
  let content: string;

  // Detect encoding from BOM
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    // UTF-16LE with BOM
    content = buffer.toString('utf16le').slice(1); // Remove BOM
  } else if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
    // UTF-16BE with BOM
    content = buffer.slice(2).swap16().toString('utf16le'); // Swap to LE, skip BOM
  } else {
    // UTF-8 (no BOM or other)
    content = buffer.toString('utf8');
  }

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key && (!onlyIfMissing || !process.env[key])) {
      process.env[key] = value;
    }
  }
}

/**
 * Resolve and cache the MCP service account actor.
 * Uses login() from lib/auth with MCP_USER/MCP_PASS.
 * Validates MCP_ROLE matches DB role if set.
 * 
 * @returns Actor object with id, name, role
 * @throws Error if login fails or role mismatch
 */
export async function resolveActor(): Promise<Actor> {
  if (cachedActor) {
    return cachedActor;
  }

  const user = process.env.MCP_USER;
  const pass = process.env.MCP_PASS;
  const expectedRole = process.env.MCP_ROLE;

  if (!user || !pass) {
    throw new Error('MCP auth: MCP_USER and MCP_PASS must be set in .env.mcp');
  }

  const actor = await login(db, user, pass);

  if (!actor) {
    throw new Error('MCP auth: login failed');
  }

  if (expectedRole && expectedRole !== actor.role) {
    throw new Error(`MCP auth: role mismatch — expected '${expectedRole}', got '${actor.role}'`);
  }

  cachedActor = actor;
  return actor;
}

/**
 * Check if a tool/function is allowed for WRITE operations.
 * 
 * READ tools (in READ_TOOLS set): always allowed.
 * WRITE tools (all others): only allowed if listed in MCP_WRITE_TOOLS env (CSV).
 * Default MCP_WRITE_TOOLS is empty → all write tools blocked (read-only mode).
 * 
 * @param fnName Function/tool name from FN_LIST
 * @returns true if allowed, false if blocked
 */
export function isWriteAllowed(fnName: string): boolean {
  // READ tools always allowed
  if (READ_TOOLS.has(fnName)) {
    return true;
  }

  // All other tools are WRITE — check allowlist
  const writeToolsEnv = process.env.MCP_WRITE_TOOLS || '';
  if (!writeToolsEnv.trim()) {
    return false; // Empty allowlist = read-only mode
  }

  const allowedWriteTools = writeToolsEnv
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return allowedWriteTools.includes(fnName);
}

/**
 * Audit an MCP tool call to activity_log with channel='mcp'.
 * 
 * @param fnName Function/tool name called
 * @param actor Actor who made the call
 * @param ok true if call succeeded/allowed, false if denied
 */
export async function auditMcpCall(fnName: string, actor: Actor, ok: boolean): Promise<void> {
  const result = ok ? 'ok' : 'denied';
  const message = `fn=${fnName} actor=${actor.name} role=${actor.role} channel=mcp result=${result}`;

  await logActivity(db, {
    actor_id: actor.id,
    actor_role: actor.role,
    hanh_dong: 'mcp_call',
    doi_tuong: 'mcp_tool',
    doi_tuong_id: fnName,
    mo_ta: message,
    is_test: 0,
  });
}

/**
 * Clear the cached actor (useful for testing).
 * Not exported for production use — internal only.
 */
export function _clearActorCache(): void {
  cachedActor = null;
}