# Client Setup — Cài đặt truy cập từ máy khách LAN

Hướng dẫn cài đặt trên **mỗi máy truy cập** trong mạng LAN của công ty để truy cập CencomOS-Gara server (`https://192.168.0.72`).

---

## 📋 YÊU CẦU

- Máy client phải cùng mạng LAN với server (`192.168.0.0/22`)
- Truy cập: `https://192.168.0.72` hoặc `https://cencom.lan`
- Trình duyệt: Chrome / Edge / Firefox (cập nhật)

---

## 🎯 2 CÁCH TRUY CẬP

### Cách A: Dùng IP trực tiếp (khuyên dùng cho máy đầu tiên)
```
https://192.168.0.72
```
- **Ưu**: Không cần cấu hình hosts, resolve ngay
- **Nhược**: Chrome/Firefox báo cảnh báo cert (vì cert thiếu IP)
- **Cách bỏ cảnh báo**: 
  - Chấp nhận cert (click "Advanced" → "Proceed to 192.168.0.72")
  - **Hoặc** cài đặt cert vào Trusted Root (xem bước dưới)

### Cách B: Dùng hostname `cencom.lan` (đề xuất cho toàn công ty)
```
https://cencom.lan
```
- **Ưu**: URL ngắn gọn, professional
- **Nhược**: Cần thêm hosts entry trên mỗi máy
- **Cài đặt**: Chạy `install_cert_win.bat` + thêm dòng hosts

---

## 🖥️ CÀI ĐẶT TRÊN WINDOWS (Client)

### Bước 1: Cài cert vào Trusted Root CA
```bat
# Chạy với quyền Administrator
cd client-setup
install_cert_win.bat
```
→ Script sẽ tự động thêm `server.crt` vào "Trusted Root Certification Authorities"

### Bước 2: Thêm hosts entry
Mở Notepad **với quyền Admin** → mở `C:\Windows\System32\drivers\etc\hosts` → thêm dòng:
```
192.168.0.72    cencom.lan
```
→ Lưu file

### Bước 3: Truy cập
- Mở trình duyệt → truy cập `https://cencom.lan`
- Không còn cảnh báo cert nữa

---

## 🐧 CÀI ĐẶT TRÊN LINUX (Client)

```bash
cd client-setup
sudo bash install_cert_linux.sh
sudo bash -c 'echo "192.168.0.72 cencom.lan" >> /etc/hosts'
```

---

## 🍎 CÀI ĐẶT TRÊN MAC (Client)

```bash
cd client-setup
sudo bash install_cert_mac.sh
echo "192.168.0.72 cencom.lan" | sudo tee -a /etc/hosts
```

---

## 🔑 TÀI KHOẢN MẪU

| Tên đăng nhập | Mật khẩu | Role | Ghi chú |
|---|---|---|---|
| `admin-1` | `cencom@123` | admin | Toàn quyền |
| `giamdoc-1` | `cencom@123` | giamdoc | Phải đổi mk lần đầu |
| `ketoan-1` | `cencom@123` | ketoan | Phải đổi mk lần đầu |
| `tho-1` | `cencom@123` | tho | Phải đổi mk lần đầu |

> Mật khẩu mặc định `cencom@123` — hệ thống buộc đổi mật khẩu khi `must_change=1`
