# VND Save v1.3

**Take Control of Your Money.** Ứng dụng quản lý tài chính cá nhân bằng VND, chạy trực tiếp trong trình duyệt và lưu dữ liệu trên thiết bị.

## Mở ứng dụng

1. Giải nén thư mục `vnd-save` vào một vị trí trên máy tính.
2. Mở thư mục vừa giải nén.
3. **Nhấn đúp `index.html`** (hoặc chuột phải → Open with → Chrome / Edge / Firefox). Đây là shell khởi chạy duy nhất và cũng là nơi hiển thị màn hình loading ban đầu.
4. Sau khi trang đầu tiên sẵn sàng, shell giữ trang đang xem trên màn hình trong lúc nạp trang kế tiếp ở iframe thứ hai. Khi nội dung mới đã render xong, hai trang crossfade nhẹ; vì vậy không có khoảng trắng trong lúc trình duyệt mở file HTML tiếp theo. Chỉ `index.html` có màn hình loading khởi động. Các trang con không có loading overlay. Hoàn tất onboarding được render ngay trong trang hiện tại, không tải lại tài liệu.
5. Hoàn thành onboarding. Ứng dụng không chèn giao dịch mẫu; các chỉ số ban đầu sẽ là 0 cho đến khi bạn tự ghi nhận giao dịch.

Không cần cài Node.js, npm, extension, tài khoản, API key hoặc chạy local server. Ứng dụng dùng HTML/CSS/JavaScript thuần, các script cổ điển và đường dẫn tương đối để tương thích với cách mở `file://` trực tiếp.

> **Quan trọng:** Hãy giữ nguyên `storage-host.html` và thư mục `src/core/` trong cùng bộ dự án. Các trang HTML riêng sử dụng một iframe lưu trữ trung tâm ẩn để mọi trang cùng đọc/ghi vào một kho dữ liệu. Cách này tránh việc các trình duyệt phân chia IndexedDB theo từng đường dẫn file khi mở nhiều trang `file://`. Không mở riêng `storage-host.html` để sử dụng ứng dụng.
>
> Khuyến nghị Chrome, Edge hoặc Firefox hiện đại. Một số cấu hình trình duyệt có thể hạn chế dữ liệu lưu trữ ở chế độ `file://`; ứng dụng sẽ thông báo khi IndexedDB phải dùng localStorage dự phòng. Hãy tạo file `.vndsave` định kỳ. Dữ liệu cục bộ không tự đồng bộ giữa các thiết bị.

## Tám trang HTML riêng biệt

`index.html` duy trì hai iframe và chuyển đổi giữa các trang HTML sau khi trang đích báo đã render hoàn tất. Điều này giữ nội dung hiện tại trên màn hình trong lúc trang mới được nạp. Các file trang vẫn tồn tại độc lập và có thể mở riêng; để có chuyển trang mượt nhất, hãy bắt đầu bằng `index.html`.

- `index.html` — File khởi chạy khi nhấn đúp.
- `dashboard.html` — Tổng quan.
- `transactions.html` — Giao dịch.
- `budgets.html` — Ngân sách.
- `analytics.html` — Phân tích.
- `insights.html` — Góc nhìn tài chính.
- `goals.html` — Mục tiêu tiết kiệm.
- `reports.html` — Báo cáo.
- `settings.html` — Cài đặt.

Mỗi mục điều hướng sẽ mở đúng file HTML của trang đó. Các trang dùng chung CSS, component JavaScript, phép tính tài chính và kho dữ liệu.

## Giao diện số tiền

- Số tiền dùng bộ phân tách hàng nghìn theo locale Việt Nam, không có chữ số thập phân cho đơn vị VND.
- Thẻ thống kê tổng quan hiển thị phần số và ký hiệu `₫` tách biệt, cỡ chữ lớn hơn và hỗ trợ xuống dòng với số rất dài.
- Số tiền trong bảng giao dịch được căn phải, tăng độ đậm và phân biệt thu nhập/chi tiêu bằng màu trạng thái.
- Các ô tổng hợp trong Analytics, Báo cáo và Mục tiêu có nhãn, khoảng cách và kích thước chữ nhất quán.

## Chức năng

- Onboarding: hồ sơ, danh mục thu nhập/chi tiêu, ngân sách khởi tạo.
- Dashboard: số dư ròng tích lũy, thu nhập/chi tiêu theo tháng, ngân sách, biểu đồ và giao dịch gần đây.
- Giao dịch: thêm, sửa, xóa có xác nhận; tìm kiếm, lọc theo loại/danh mục/tháng/khoảng ngày/khoảng tiền và sắp xếp.
- Ngân sách: theo dõi tiến độ theo danh mục và tháng; cảnh báo ở ngưỡng 80% và khi vượt ngân sách.
- Phân tích và góc nhìn: biểu đồ SVG tự dựng và nhận xét bằng quy tắc JavaScript dựa trên giao dịch thực tế.
- Mục tiêu tiết kiệm: tạo, chỉnh sửa, thêm tiền, theo dõi tiến độ và hạn mục tiêu. Tiền thêm vào mục tiêu không tự động được trừ khỏi số dư giao dịch.
- Báo cáo: tháng, quý, năm; xuất giao dịch CSV UTF-8 BOM.
- Cài đặt: hồ sơ, danh mục, sáng/tối/theo hệ thống, backup/restore `.vndsave`, xóa dữ liệu có xác nhận.
- Responsive cho desktop, tablet và mobile; hỗ trợ phím Escape cho modal và menu mobile.

## Cấu trúc

```text
vnd-save/
├── index.html              # shell, loading khởi động và chuyển trang mượt
├── dashboard.html
├── transactions.html
├── budgets.html
├── analytics.html
├── insights.html
├── goals.html
├── reports.html
├── settings.html
├── storage-host.html
├── README.md
├── vercel.json
├── public/
│   ├── logo.svg
│   └── favicon.svg
├── src/
│   ├── app.js
│   ├── core/
│   │   ├── storage.js
│   │   ├── storage-bridge.js
│   │   ├── storage-host-bridge.js
│   │   ├── finance.js
│   │   └── backup.js
│   ├── ui/
│   │   ├── icons.js
│   │   └── charts.js
│   └── styles/
│       ├── tokens.css
│       ├── app.css
│       └── responsive.css
└── tests/
    ├── smoke-test.js
    ├── render-smoke-test.js
    ├── onboarding-smoke-test.js
    ├── navigation-shell-test.js
    └── storage-bridge-test.js
```

## Logo và favicon

`public/logo.svg` và `public/favicon.svg` đều là SVG vector viết trực tiếp bằng mã SVG, không nhúng PNG/JPG. Biểu tượng kết hợp hình ví, dấu kiểm và mũi tên tăng trưởng theo bảng màu xanh và navy của VND Save.

## Lưu trữ và quyền riêng tư

- IndexedDB là nơi lưu trữ chính. Toàn bộ state được ghi vào một bản ghi IndexedDB để thao tác restore là một lần ghi nguyên tử.
- Tất cả trang giao diện giao tiếp với cùng một `storage-host.html` qua `postMessage`; trang host mới là nơi mở IndexedDB/localStorage.
- Nếu IndexedDB không khả dụng, app thử dùng localStorage làm phương án dự phòng. Dung lượng localStorage thấp hơn; không nên dùng làm lựa chọn lưu trữ lâu dài cho dữ liệu lớn.
- Không có backend, tài khoản, analytics, API tài chính hoặc đồng bộ đám mây. Dữ liệu không tự đồng bộ giữa các thiết bị.
- Google Fonts không được tải từ xa; CSS ưu tiên Inter nếu có sẵn trên thiết bị, sau đó dùng font hệ thống để giữ khả năng chạy offline.

## Backup / Restore

- Vào **Cài đặt → Dữ liệu & sao lưu → Backup .vndsave** để tải toàn bộ state thành JSON có `app`, `formatVersion`, `createdAt`, metadata và data.
- Restore chấp nhận file `.vndsave` tối đa 25 MB. App kiểm tra app name, format version, cấu trúc và các trường quan trọng trước khi hiển thị preview.
- Chỉ sau khi nhấn **Khôi phục và ghi đè** dữ liệu mới được thay thế. Nếu file không hợp lệ, dữ liệu hiện tại không bị thay đổi.
- Định dạng backup hiện tại là version 1; chưa tuyên bố mã hóa file. Hãy lưu file backup ở nơi an toàn.

## Triển khai Vercel

Đây là website tĩnh, không cần bước build:

1. Đưa toàn bộ nội dung thư mục `vnd-save` lên GitHub.
2. Import repository vào Vercel.
3. Chọn Framework Preset **Other**.
4. Không đặt Build Command; Output Directory là `.` (thư mục gốc dự án).
5. Deploy. Các tệp HTML riêng, SVG, CSS và JavaScript được phục vụ trực tiếp.

`vercel.json` giữ nguyên phần mở rộng `.html` để các liên kết giữa trang không cần rewrite về `index.html`. Không có lệnh `npm run build` vì ứng dụng được phục vụ trực tiếp, không có bước bundle.

## Kiểm tra mã nguồn

Yêu cầu Node.js chỉ dành cho chạy test, không dành cho người dùng mở ứng dụng:

```bash
node tests/smoke-test.js
node tests/render-smoke-test.js
node tests/onboarding-smoke-test.js
node tests/storage-bridge-test.js
```

Các bài test kiểm tra phép tính tài chính, backup/restore, render 8 trang, onboarding và giao tiếp giữa trang ứng dụng với storage host. Ứng dụng không phụ thuộc Node.js khi chạy trong trình duyệt.
