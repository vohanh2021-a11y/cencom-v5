/**
 * mcp-server/tool-docs.ts — Aggregate tool descriptions from part files
 *
 * This file is the SINGLE source of truth for MCP tool docs.
 * Missing any fn → index.ts throws at startup (docs-completeness gate).
 *
 * Part files (part1..part7) contain the actual descriptions.
 * This file merges them into TOOL_DOCS.
 */

import { PART1 } from './tool-docs.part1';
import { PART2 } from './tool-docs.part2';
import { PART3 } from './tool-docs.part3';
import { PART4 } from './tool-docs.part4';
import { PART5 } from './tool-docs.part5';
import { PART6 } from './tool-docs.part6';
import { PART7 } from './tool-docs.part7';

export interface ToolDoc {
  title: string;
  descVi: string;
  descEn: string;
  mode: 'READ' | 'WRITE';
  /** Example args — chỉ khai báo nếu fn cần tham số bắt buộc */
  example?: Record<string, unknown>;
}

export type ToolDocs = Record<string, ToolDoc>;

/**
 * W5-reg — bossDashboard/bossAlerts (lib/core/boss.ts). Khai báo trực tiếp ở
 * đây (đợt reg cuối, không mở part8): docs-completeness gate ở server-core
 * chỉ cần TOOL_DOCS[fn] tồn tại; pattern part1-7 giữ nguyên cho các fn trước.
 * Cả hai READ thuần — MCP mode mặc định MCP_WRITE_TOOLS='' gọi được; quyền
 * thật do RPC dispatch META ['sc','xem'] + lõi fail-closed từng nguồn.
 */
const BOSS_DOCS: ToolDocs = {
  bossDashboard: {
    title: 'Tổng quan BOSS (KPI xưởng + kho thiếu + DM chờ duyệt + SC quá hạn)',
    descVi:
      'READ (["sc","xem"] — mọi vai; lib/core/boss.ts): MỘT gọi lắp 4 nhánh đọc SONG SONG — {kpi: KPI xưởng ngày (null nếu vai bị core chặn dashboardAll, vd ketoan), ton_thieu: vật tư dưới ngưỡng ton_min (từ tonKho low_only), dm_cho_duyet: đơn mua chờ duyệt (dmList cho_duyet), sc_tre_han: phiếu quá hạn hẹn trả xe kèm số ngày trễ, JOIN biển số, cap 200, han gần nhất trước}. Không tham số. Mỗi nhánh bọc Promise.allSettled RIÊNG: một nguồn lỗi chỉ làm nhánh đó rỗng + logWarn — không sập cả trang; chưa đăng nhập → shape rỗng (fail-closed). KHÔNG ghi, KHÔNG đụng tiền. Dùng khi sếp cần bức tranh vận hành một màn hình thay vì gọi 4 fn lẻ.',
    descEn:
      'READ (["sc","xem"], every role; lib/core/boss.ts): one call assembles four parallel read branches — {kpi: daily workshop KPIs (null when core blocks dashboardAll for the role, e.g. ketoan), ton_thieu: materials below reorder level, dm_cho_duyet: pending purchase requests, sc_tre_han: repair orders past their return deadline with days-late, plate JOIN, capped at 200}. No arguments. Each branch is wrapped in Promise.allSettled: one failing source yields an empty branch + warn log, never a broken page; unauthenticated → empty shape (fail-closed). Pure read. Use as the boss one-glance overview instead of four separate calls.',
    mode: 'READ',
  },
  bossAlerts: {
    title: 'Chuông cảnh báo BOSS (kho thiếu + SC quá hạn trả xe)',
    descVi:
      'READ (["sc","xem"] — mọi vai; lib/core/boss.ts): KHÔNG tham số, trả MẢNG CHUỖI tiếng Việt người-đọc-được cho badge đỏ trên header — thứ tự: "Kho thiếu: <tên> — còn X/Y <đv>" trước, rồi "Quá hạn trả xe: SC-00000N (xe 51C-12345) — hẹn YYYY-MM-DD, trễ N ngày [trạng thái]". Cố ý KHÔNG gọi dashboardAll (kanban nặng — không cần cho vài dòng chuông); dữ liệu hạn lấy từ cột han_tra_xe (W3.3A, soft-not-null). Nhánh lỗi chỉ bị BỎ QUA (logWarn/logError), không throw; chưa đăng nhập → [] (fail-closed). Mảnh hơn bossDashboard: chỉ 2 query, phù hợp gọi polling/header.',
    descEn:
      'READ (["sc","xem"], every role; lib/core/boss.ts): no arguments; returns an array of human-readable Vietnamese alert strings for a red header badge — low-stock lines first, then overdue-return repair orders (deadline + days late + status). Deliberately skips the heavy dashboardAll query (only 2 sources); failing branches are skipped with a log, never thrown; unauthenticated → [] (fail-closed). Lighter than bossDashboard — suitable for frequent header polls.',
    mode: 'READ',
  },
};

export const TOOL_DOCS: ToolDocs = { ...PART1, ...PART2, ...PART3, ...PART4, ...PART5, ...PART6, ...PART7, ...BOSS_DOCS };
