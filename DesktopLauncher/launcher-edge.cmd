@echo off
REM Launcher dùng ngay (không cần build) — mở web garage trong cửa sổ riêng của Edge.
REM Chỉnh URL tại đây nếu đổi IP:
set GARAGE_URL=http://garage.local
start "" "msedge.exe" --app=%GARAGE_URL% --new-window
