# CHANGELOG MCP — gara_reconstruction_v5

Theo dõi chuỗi **B → A → D** + hoàn thiện M2 (TM7/TM8) + đề xuất a/b/c.
Trạng thái: pending | in_progress | done | blocked.

## M1 (đã xong — tag v5.0.0)
- [done] TM1–TM5: buildApi/getRegistry, mcp-server scaffold, parity test 7/7 (296/296), README+AGENTS.

## B — M2 (zod contracts + CI) — DONE
- [done] TM6a/b/c + TM9a/b → Gate B: tsc=0, version-consistency OK, full conformance **318/318**.

## A — Commit — DONE
- [done] bump 5.1.0, commit `65e8722` (25 files), tag `v5.1.0`.

## D — M3 (UAT + adversarial) — DONE
- [done] TM10 demo 5/5; TM11 adversarial 4/4 PASS.

## M2 hoàn thiện (TM7/TM8) — DONE
- [done] **TM7** — `mcp-server/resources.ts`: resource `sc://{sc_id}` (hoSo+scGet, list 20 SC), `xe://{xe_id}` (xeGet, list 20 xe); `prompts.ts`: prompt `ho-so-sc-chuan-qc206` (8 bước); đăng ký trong `index.ts`; test `mcp_resources.test.ts` **6/6 PASS**.
- [done] **TM8** — `mcp-server/http.ts`: Streamable HTTP (Bearer timing-safe + fail-closed, stateful session, chỉ route /mcp); `Onpremise/docker-compose.mcp.yml` (service cencom-mcp, bind 127.0.0.1:3001); `Onpremise/nginx/mcp.conf` (location /mcp, hướng dẫn include); README thêm mục LAN/HTTP. Smoke 9 ca thật: init 200 + session id, sai key 401, tools/list 32, xeList data thật, scCreate bị zod chặn qua HTTP, DELETE session, audit `channel=mcp` ghi activity_log.
- [done] **Gate M2-full**: tsc=0; version-consistency OK (5.1.0==v5.1.0); full conformance **324/324 GREEN**.

## Đề xuất a/b/c — DONE (b bị chặn môi trường)
- [done] **(a)** commit `08996b4` — 13 files, +1713 dòng (chỉ file MCP/Onpremise-MCP; đống thay đổi cũ không lọt vào).
- [blocked] **(b)** push GitHub — **KHÔNG CÓ REMOTE** (`git remote -v` rỗng). Workflow CI (`gara_reconstruction_v5/.github/workflows/ci.yml`) đã sẵn sàng; chỉ cần: `git remote add origin <URL>` → `git push -u origin master --tags`. CI sẽ tự chạy (postgres + version-consistency + mcp parity).
- [done] **(c)** `mcp-server/mcp.json.example` — config mẫu stdio (cùng máy) + HTTP LAN (máy khác), có đường dẫn tuyệt đối; README tham chiếu.

## HỘI TỤ (PLAN_HOI_TU_01.09.md) — GPS per-wave
- [x] **W0 FIX NỀN (01.09)**: race-condition kho (withTransaction + row-guard, tests 4/4) · recalcScTotals bước 8 QC206 thật (8/8) · docs/convergence 01-03 + **00_CAU_TRUC_HE_THONG.md** · gate tsc=0 + conformance **336/336** · commit W0. → Backlog: scVtUpd→W3.4, CRUD danh mục CV→W3.3.
- [x] **W1 KHO (01.09) ✅** — phiếu 2 tầng `phieuList/phieuGet`+`phieu_id` legacy-tuync · `tonKho` (low/giaTri aggregate) · `vattu_gia_lich_su`+hooks tx · `ton_cu_hong`+`thanh_ly`+`autoGenCuHong`(chống trùng theo cặp) + FIX bug kế thừa `autoXuatSC` (1 PXX/đủ cầu) · GTTV asset (KH N+1) · UI kho 4 tabs + Playwright 4/4 · `server-core.ts` tách loop + HTTP res/prompts parity (`mcp_http` 5/5). **FN 43 / tools 39** dynamic · RBAC 141 còn xanh (coverage gap fn mới — đã ghi W2). Gates tsc=0 · **conformance 378/378 18 suites**.
- [ ] **W2 DM**: dmList/Detail/Decide/FromSC/AutoBu + mua.duy + UI /kho/dm + docs part5.
- [ ] **W3 XƯỞNG**: kanban + KPI 11 + thợ + sửa/xoá dòng (kèm scVtUpd) + snapshot + deadline + docs part6 + res/prompt sếp.
- [ ] **W4 CROSS+AI**: admin 7fn + must_change + search/in A4/xlsx + workspace/PA1 + PWA + boss://dashboard + http rate-limit (kho max pool check).
- [ ] **W5 RELEASE**: bump **5.2.0** + tag + MASTER_PLAN/CHANGELOG cập nhật + gate ≥380 → push (CẦN user cấp remote URL).
- [ ] (Q1 mở) TK thăm khám W3.9: chờ duyệt. (Q2 mở) 211 draft GĐ4/5: chưa commit — chờ duyệt.

- MCP v1 hoàn chỉnh: **32 tool** trùng tên fn + **2 resource** (sc, xe) + **1 prompt** QC206 + **HTTP LAN** (Bearer, session) — Web↔Core↔MCP đồng nhất tên/version.
- Conformance toàn hệ thống: **324/324 GREEN**. tsc=0. version-consistency OK.
- Commits: `65e8722` (M1+M2 core, tag v5.1.0) → `08996b4` (TM7/TM8 + evidence).
- Còn lại duy nhất: **thêm git remote rồi push** (việc của user, 2 lệnh) — sau đó CI chạy thật trên GitHub.
