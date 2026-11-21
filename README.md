# MiHi TOEIC 2026 - Nền tảng luyện thi TOEIC Online
> **Designed & Developed by Minh Hiếu**

Hệ thống luyện thi và thi thử TOEIC trực tuyến chuẩn format quốc tế ETS/IIG, do **Minh Hiếu** thiết kế với kho dữ liệu đầy đủ 100% offline, phòng thi mô phỏng máy tính như thật, giải thích song ngữ và phân tích điểm số thông minh.

---

## 🌟 Các tính năng chính

1. **Kho đề thi chuẩn & Dữ liệu 100% Offline (Hơn 320 tệp dữ liệu, 12.000+ câu hỏi):**
   - **21 đề Full Test** (200 câu hỏi, 120 phút) đã tải sẵn 100% offline.
   - **20 đề Mini Test** (100 câu hỏi, 60 phút) đã tải sẵn 100% offline.
   - **226 đề luyện tập từng phần** (Part 1 đến Part 7) với đầy đủ audio và hình ảnh.
   - **36 bài giảng lý thuyết & mẹo làm bài** (Study Guides) kèm bẫy đề thi cho từng Part.
   - **38 chuyên đề ngữ pháp trọng tâm** kèm quy tắc, bảng biểu và ví dụ chi tiết.
   - **48 chủ đề từ vựng ăn điểm** theo chủ đề kinh doanh + 6 bộ từ vựng theo Part.

2. **Giao diện chuẩn 100% EstudyMe / TOEIC Test Pro 2026:**
   - Thanh điều hướng đầy đủ: Lộ trình hoá, Dropdown Luyện tập 7 Part, Dropdown Đề thi thử, Ngữ pháp, Từ vựng, Lịch sử, Get Pro, Get App, Cờ VN.
   - 4 Card phân loại đề thi: Thi Mô Phỏng, Full Test (L&R), Full Test (S&W), Mini Test.
   - Cửa sổ đọc lý thuyết & mẹo làm bài tích hợp (Lesson Reader).
   - Bộ chọn từ vựng 2 tab: 48 chuyên đề & Từ vựng theo Part.

3. **Hệ thống học Từ vựng bằng Flashcard lật nghĩa 3D (Chuẩn EstudyMe 100%):**
   - **Thẻ học 3D tương tác:** Bấm vào thẻ hoặc nút lật (⇄) để xoay 180 độ xem nghĩa tiếng Việt và câu ví dụ song ngữ.
   - **Mặt trước:** Ảnh minh họa thực tế, từ vựng tiếng Anh (xanh đậm), phiên âm quốc tế IPA và nút nghe phát âm giọng bản xứ.
   - **Mặt sau:** Nghĩa tiếng Việt cốt lõi, câu ví dụ tiếng Anh có in đậm từ vựng và câu dịch tiếng Việt.
   - **Đánh giá ghi nhớ tức thì:** Nút đỏ *"Chưa ghi nhớ"* và nút xanh *"Đã ghi nhớ"*.
   - **Thống kê Card Overview:** Đếm số từ đã thuộc, chưa thuộc và chưa trả lời theo thời gian thực.
   - **Phím tắt tiện dụng:** Phím `Space` hoặc `F` để lật thẻ, `Mũi tên trái` hoặc `1` để đánh dấu chưa thuộc, `Mũi tên phải` hoặc `2` để đánh dấu đã thuộc, `Mũi tên lên` hoặc `R` để nghe lại phát âm.
   - **Tổng kết phiên học:** Báo cáo tỷ lệ ghi nhớ %, hỗ trợ ôn lại riêng các từ chưa thuộc.

4. **Phòng thi thông minh (Exam Room):**
   - Đồng hồ đếm ngược thời gian thực.
   - Trình phát Audio nghe tích hợp (tua lùi 5s, chỉnh tốc độ 0.8x - 1.25x).
   - Bảng câu hỏi (Question Palette 1 - 200) chuyển câu tức thì, nhảy nhanh theo Part (`P1` - `P7`).
   - Đánh dấu cờ (Flag) câu nghi vấn.
   - Phím tắt bàn phím (A, B, C, D để chọn đáp án; Mũi tên trái/phải để chuyển câu).

4. **Hai chế độ linh hoạt:**
   - **Thi thử (Exam Mode):** Làm bài liên tục bấm giờ, không lộ đáp án, nộp bài tính điểm chuẩn TOEIC.
   - **Luyện tập (Practice Mode):** Phản hồi trực quan tức thì (xanh khi đúng, đỏ khi sai), tự động mở giải thích song ngữ Anh - Việt & Transcript câu thoại.

5. **Chấm điểm & Lời giải chi tiết:**
   - Chấm điểm TOEIC chuẩn bảng điểm ETS (Listening 5 - 495, Reading 5 - 495, Tổng 10 - 990).
   - Thống kê tỷ lệ đúng, số câu đúng/sai/bỏ qua, thời gian làm bài.
   - Chế độ xem lại bài (Review Mode) lọc câu sai, xem Transcript và bản dịch tiếng Việt từng câu.

---

## 🚀 Hướng dẫn khởi chạy

Chỉ cần chạy file `start.bat` hoặc gõ lệnh:
```bash
node server.js
```
Sau đó mở trình duyệt và truy cập: **http://localhost:3000**

---

## 🛠️ Cấu trúc thư mục

```
c:\Toeic\wed\
├── server.js              # Máy chủ backend Node.js / Express
├── crawler.py             # Công cụ cào dữ liệu gốc Python
├── start.bat              # File chạy nhanh máy chủ
├── data\                  # Kho đề thi và bài tập đã lưu trữ
│   ├── tests_summary.json # Danh sách 41 đề thi Full Test & Mini Test
│   ├── practice_summary.json # Danh sách 7 Part, ngữ pháp & từ vựng
│   └── *.json             # Dữ liệu chi tiết từng đề thi
└── public\                # Giao diện Frontend
    ├── index.html         # Giao diện chính (Tailwind CSS)
    ├── app.js             # Logic phòng thi, chấm điểm, audio player
    └── style.css          # Tùy biến giao diện & hiệu ứng
```
