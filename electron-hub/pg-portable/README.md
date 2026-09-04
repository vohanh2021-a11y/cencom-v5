# PostgreSQL Portable cho Hub

Thư mục này chứa binary PostgreSQL 16 portable cho Windows x64.

## Cách lấy binary (chạy 1 lần trước khi build Hub)

```powershell
# Từ gốc repo
.\electron-hub\scripts\fetch-pg.ps1
```

Script sẽ tải `postgresql-16.x-win64-binaries.zip` từ enterprisedb.com (~35MB),
giải nén vào `electron-hub/pg-portable/` (~120MB), cấu trúc:

```
pg-portable/
  bin/      (postgres.exe, initdb.exe, pg_ctl.exe, psql.exe ...)
  lib/
  share/
```

## Build Hub

`pg-portable/` được copy vào `extraResources` (đã khai trong `electron-hub/package.json`),
data dir nằm ngoài installer: `%APPDATA%/CencomOS/hub-data` (không bị xóa khi gỡ cài đặt).

Nếu chưa có `pg-portable/bin`, Hub vẫn build được nhưng sẽ chạy ở chế độ
thin-client (yêu cầu PG ngoài). Khi có binary, Hub tự initdb + pg_ctl.
