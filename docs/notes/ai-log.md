# Nhật ký dùng AI

Công cụ: **Claude Code** (VS Code extension), model Claude Opus. Harness: [CLAUDE.md](../../CLAUDE.md), hook Stop
([.claude/settings.json](../../.claude/settings.json) → [stop-tests.mjs](../../.claude/hooks/stop-tests.mjs)), skill
[verify](../../.claude/skills/verify/SKILL.md), CI [.github/workflows/ci.yml](../../.github/workflows/ci.yml).

## Phase 1

### Lời nhắc chính
1. "Đọc các file hướng dẫn lab, hướng dẫn tôi cách làm" → AI tóm tắt cách chấm điểm và đề xuất ưu tiên headless trước đồ họa.
2. Đưa link lab board → AI đọc PRD-0 + Test Contract v1.0, liệt kê các bẫy của contract và các chỗ mơ hồ.
3. "Bắt đầu làm" → AI dựng khung, viết core + headless, scenario (kỳ vọng tính tay từ spec), harness, rồi phần render.

### Cách làm để tiết kiệm token và tránh sai
- Viết **core + headless + scenario trước**, đồ họa sau: phần 30 điểm được kiểm chứng sớm, đồ họa chỉ đọc state.
- Kỳ vọng trong `expect.json` tính tay từ spec + tuning (ví dụ: 0.1 m/tick → nhặt ở tick 36; 3.5/60 m/tick → chạm ở tick 35; bất tử 90 tick → chạm tiếp ở 125, 215), **không** chép từ output, để test bắt được lỗi thật.
- Chạy test sau mỗi bước lớn thay vì để agent viết liền một mạch.

### Các lần AI sai / phải sửa

| # | Sai gì | Phát hiện thế nào | Sửa |
|---|---|---|---|
| 1 | Bộ đếm choáng bị trừ ngay trong tick bị pulse → Bóng Mực hết choáng sớm 1 tick (ở tick 180 đã về `chase`, phải còn `stunned`) | Scenario `05_pulse_stun` (kỳ vọng tính tay) báo đỏ | Chuyển việc trừ bộ đếm choáng lên đầu bước cùng các bộ đếm khác. Ghi giả định A7 |
| 2 | Tạo hàng loạt file scenario bằng heredoc trong bash lỗi trích dẫn (cả lệnh không chạy) | Lỗi shell `unexpected EOF` | Chuyển sang script Node sinh file JSON (ít lỗi hơn, JSON luôn hợp lệ) |
| 3 | Agent định `rm -rf scenarios/*` trước khi sinh lại | Bị chặn bởi kiểm tra an toàn của Claude Code | Không cần xóa (thư mục đang trống); bài học: generator ghi đè, không xóa |

### Token / chi phí ước tính
- Phase 1: khoảng **~150k token** vào + **~45k token** ra (một phiên Claude Code; đọc đề + lab board, viết khoảng 1.5k dòng code/tài liệu).
  Số chính xác xem bằng `/cost` trong Claude Code. _(cập nhật sau khi kiểm tra)_
- Tiết kiệm: chỉ đọc lab board 1 lần rồi trích riêng Test Contract; không đọc lại file đã viết; gộp nhiều file vào một lượt; dùng scenario để kiểm thay vì chạy game thủ công nhiều lần.

## Phase 2

### Lời nhắc chính
1. Dán Ticket-02 (lab board tải nội dung phase từ cơ sở dữ liệu nên công cụ đọc không thấy; phải copy tay).
2. AI đối chiếu ticket với giả định Phase 1, lập bảng "luật bị thay thế → test bị ảnh hưởng" trước khi code.
3. Thứ tự làm: số chuẩn + bản đồ + `sim.ts` theo thứ tự 12 bước → headless v1.1 → scenario (tính tay) → render 3 Đêm/menu/âm thanh/HUD → đo FPS → tài liệu.

### Các lần AI sai / phải sửa

| # | Sai gì | Phát hiện thế nào | Sửa |
|---|---|---|---|
| 4 | Kỳ vọng tính tay sai: S6 ở tick 2700 (đúng là 2220); độ cao ở tick 40 khi nhảy bục "> 6" (đúng 4.77); tọa độ 23.383 (đúng 23.382) | Scenario đỏ; tính lại bằng tay thì code đúng, kỳ vọng sai | Sửa kỳ vọng kèm cách tính trong comment của `gen-scenarios.mjs` |
| 5 | Đặt điểm xuất phát scenario đúng biên số thực (x = 39.5 → 40.0 sau 5 tick; z = −8.1 → −8.0): lệch 1 tick do làm tròn số thực | Rơi ở tick 65 thay vì 66; dừng ở −8.0 thay vì −8.1 | Dịch điểm xuất phát 0.05 m; **thêm quy tắc vào CLAUDE.md** để không lặp lại |
| 6 | Patch `validate.ts` bằng chuỗi `node -e` + heredoc trong bash bị hỏng | Lỗi heredoc, file sửa dở | Viết lại cả file bằng công cụ Write (chắc hơn patch bằng shell) |

### Harness đã chỉnh
- `CLAUDE.md`: lệnh mới (`gen:scenarios`, `fps`, `?autostart&night=N`), cấu trúc `maps.ts`/`constants.ts`, quy tắc tránh biên số thực, sửa scenario qua generator.
- Skill `verify`: thêm `night`, cách sinh scenario, đo FPS, chụp ảnh.
- `verify.mjs`: thêm đo hiệu năng headless một Đêm đầy đủ (ngưỡng 30 s) để phase sau tự kiểm.
- Script mới: `scripts/gen-scenarios.mjs` (scenario tái lập được), `scripts/measure-fps.mjs` (đo FPS qua Chrome DevTools Protocol).

### Token / chi phí ước tính
- Phase 2: khoảng **~250k token vào + ~70k token ra** (ticket dài, viết lại `sim.ts` khoảng 600 dòng, render khoảng 700 dòng, 24 scenario). Số chính xác xem `/cost`. _(cập nhật sau khi kiểm tra)_
- Tiết kiệm: core/headless trước, render sau; sinh scenario bằng script thay vì viết tay 70 file JSON; đọc lỗi qua `verify` (thông báo ngắn) thay vì đọc log Vitest dài; không đọc lại file vừa viết.
