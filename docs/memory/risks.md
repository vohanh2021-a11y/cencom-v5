# Risks — CencomOS Gara v5.2.0

> Rủi ro đã nhận diện + mitigations.

## 🔴 High Priority

### 1. On-premise nginx upstream stale
- **Risk**: `Onpremise/nginx/nginx.conf` vẫn upstream `cencom-web:3000` (tên v4)
- **Impact**: 502 Bad Gateway khi deploy v5
- **Mitigation**: Sửa upstream → `web:3000` + `mcp:3001`
- **Status**: ĐANG FIX

### 2. Chưa test deploy thật
- **Risk**: `docker compose up` chưa chạy end-to-end trên Ubuntu
- **Impact**: Có thể có lỗi runtime không发现 ở dev
- **Mitigation**: Deploy test trên máy sạch trước khi giao

### 3. Installer chưa code-signed
- **Risk**: Windows SmartScreen chặn khi chạy lần đầu
- **Impact**: User hoang mang, không dám cài
- **Mitigation**: Mua EV code signing cert ($200-400/năm)

## 🟡 Medium Priority

### 4. Root monorepo v4 song song
- **Risk**: `apps/web`, `packages/*` gây nhầm baseline
- **Impact**: Developer mới không biết codebase nào là chính
- **Mitigation**: Quyết định gộp/loại bỏ, cập nhật README

### 5. Tài liệu lỗi thời
- **Risk**: CHANGELOG/MASTER_PLAN/Architect.md chưa ghi W6/Electron/PWA
- **Impact**: Đọc docs ≠ code thật
- **Mitigation**: Commit docs catch-up (đang làm)

### 6. CI workflow phụ previously broken
- **Risk**: Red checks trên GitHub dashboard → mất trust
- **Impact**: Developer bỏ qua CI failures thật
- **Mitigation**: Đã fix (ci-cd→legacy, deploy.yml, uat-video.yml)

## 🟢 Low Priority

### 7. GĐ6 Performance chưa làm
- **Risk**: App chậm khi >5000 SC
- **Impact**: Chỉ xảy ra khi scale thật
- **Mitigation**: Tạo indexes trước khi deploy, monitor query time

### 8. Multi-tenant RLS chưa có
- **Risk**: Không phân tách data giữa các garage
- **Impact**: Chỉ 1 garage dùng → không sao
- **Mitigation**: GĐ10 khi cần thương mại hóa
