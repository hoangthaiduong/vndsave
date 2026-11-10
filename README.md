# VND Save — Double-click Edition

## Mở trực tiếp
1. Giải nén toàn bộ ZIP.
2. Mở thư mục `vnd-save`.
3. Nhấn đúp `index.html` để chạy bằng Chrome hoặc Edge.

Không cần Node.js, npm, Terminal, server hay API key. IndexedDB lưu dữ liệu trong profile trình duyệt hiện tại. Nên xuất backup `.vndsave` định kỳ.

## Deploy Vercel
- Framework preset: Other
- Build command: để trống
- Output directory: `.`
- Root directory: `vnd-save` (nếu deploy từ thư mục cha).

## Ghi chú giao diện
Giao diện dùng font Inter khi có Internet và fallback sang Segoe UI/system sans-serif khi offline. Icon điều hướng là SVG theo nét Lucide, nhúng trực tiếp trong trang nên không cần tải thư viện icon.

## Giới hạn lưu trữ
Dữ liệu được lưu trên trình duyệt và thiết bị hiện tại, không tự đồng bộ giữa các thiết bị. File `.vndsave` là JSON với phần mở rộng riêng, không được mã hóa.
