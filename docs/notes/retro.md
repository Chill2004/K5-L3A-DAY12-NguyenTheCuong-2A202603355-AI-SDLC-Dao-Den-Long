# Retro: Đảo Đèn Lồng (Lab Day 12 AI SDLC)

Nguyễn Thế Cường, 2A202603355 · Công cụ: Claude Code (VS Code), model Claude Opus · 4 phase, khoảng 4 giờ.

## 1. Số liệu

| | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|---|---|---|---|---|
| Contract | v1.0 | v1.1 | v1.2 | v1.3 |
| Scenario headless (tích lũy) | 13 | 24 | 34 | 34 + bench/soak/leaderboard |
| Vitest | 21 | 36 | 46 | 52 |
| Lỗi AI ghi nhận | 3 | 3 | 2 | 3 |
| Token ước tính (vào / ra) | ~150k / ~45k | ~250k / ~70k | ~120k / ~35k | ~200k / ~60k |

**Tổng ước tính: khoảng 720k token vào, 210k token ra** (một phiên Claude Code dài; số chính xác xem `/cost`).
Hiệu năng cuối: bench avg 192.6 FPS, p1-low 38 (Intel UHD); headless một Đêm khoảng 0.25 s; soak 0 crash, RSS 1.03×.

## 2. Đánh giá từng phase
- **Phase 1:** đạt toàn bộ PRD-0. Core + headless làm trước, đồ họa sau. Không hỏng gì vì chưa có gì trước đó.
- **Phase 2:** số chuẩn thay toàn bộ số tự chọn → 6 scenario cũ phải viết lại (có lý do). Thêm 3 Đêm và 5 tính năng, mỗi tính năng có scenario. Không hỏng phần cũ (regression xanh).
- **Phase 3:** đổi luật cốt lõi (dầu đèn, thắng lúc bình minh). Có ADR + CHANGELOG; 1 test bị xóa có lý do, 3 test cập nhật. Thiếu scenario cho `drain → chase` và biên đúng 30 dầu.
- **Phase 4:** bench, soak, bảng xếp hạng, dễ tiếp cận, phát hành. Bench ban đầu không đạt p1-low; đo tách CPU/GPU mới tìm ra nút cổ chai là GPU.

## 3. Điều gì hiệu quả khi làm với AI
- **Kiểm chứng trước, code sau.** Scenario với kỳ vọng **tính tay từ spec** bắt được lỗi thật (choáng hết sớm 1 tick ở Phase 1) mà nhìn code không thấy.
- **Tách core thuần khỏi render** ngay từ đầu: mọi ticket đều chỉ sửa `sim.ts` + scenario, render gần như không ảnh hưởng tới điểm test ẩn.
- **`verify.mjs` chạy CLI thật 2 lần** và sinh báo cáo Markdown: vừa là bằng chứng, vừa là cách đọc lỗi gọn (ít token hơn đọc log Vitest).
- **Generator scenario** (`gen-scenarios.mjs`): đổi luật chỉ sửa một file, cách tính kỳ vọng nằm ngay trong comment.
- **Đo trước khi tối ưu** (Phase 4): thêm `sim_ms_p95` / `cpu_render_ms_p95` vào bench thì thấy ngay là GPU-bound, sau đó một thay đổi (Lambert, tắt MSAA) đủ đạt.

## 4. Điều gì không hiệu quả
- **Patch bằng heredoc trong bash (Git Bash trên Windows)** hỏng 3 lần: lỗi trích dẫn, mất dấu `\` trong regex. Từ Phase 3 chuyển hẳn sang Edit/Write hoặc script ghi ra file.
- **Đặt kỳ vọng đúng biên số thực** (x = 40.0, r = 8.0) làm lệch 1 tick → tốn một vòng sửa. Đã thành quy tắc trong CLAUDE.md.
- Một số kỳ vọng AI tính nhầm (S6 ở tick 2700 thay vì 2220). Phát hiện được vì test đỏ, nhưng tốn thời gian kiểm lại xem code hay kỳ vọng sai.
- Lab board tải nội dung phase sau từ cơ sở dữ liệu nên AI không đọc được; phải copy tay ticket.

## 5. Những lần AI sai và cách phát hiện (tóm tắt, chi tiết ở [ai-log.md](ai-log.md))
| Loại | Ví dụ | Phát hiện bằng |
|---|---|---|
| Logic sai thứ tự | Trừ bộ đếm choáng ngay tick bị pulse | Scenario tính tay đỏ |
| Kỳ vọng sai | Tick sinh S6, độ cao bục nhảy, tọa độ dốc | Scenario đỏ → tính lại bằng tay |
| Công cụ / shell | Heredoc hỏng, mất ký tự regex → mọi `target_lantern_id` bị exit 2 | `npm run verify` |
| Đồ họa | Billboard thanh dầu quay lưng (Euler từ quaternion) | Ảnh chụp headless Chrome |
| Đo lường | `curl` trên Windows gửi sai mã hóa tên có dấu → tưởng server lỗi | Thử lại bằng `fetch` của Node |
| Hiệu năng | Đoán do số điểm ảnh, rồi do blending: đều sai | Đo tách thời gian sim/render |

## 6. Harness nào giúp nhiều nhất
1. **`scripts/verify.mjs` + skill `verify`**: một lệnh ra bằng chứng khớp tag, kiểm tất định, mã thoát, hiệu năng.
2. **Hook Stop** (`.claude/hooks/stop-tests.mjs`): agent không thể báo "xong" khi Vitest đỏ.
3. **CLAUDE.md** ngắn, cập nhật mỗi phase với quy tắc rút ra từ lỗi thật (biên số thực, không patch bằng heredoc, ADR + CHANGELOG khi đổi luật).
4. **CI** Ubuntu + macOS: thay cho máy Linux/macOS mà mình không có (Docker local không chạy).

## 7. Tiết kiệm token
- Làm phần 30 điểm (headless) trước, đồ họa sau; không viết lại file khi chỉ cần sửa vài hàm (Phase 3 dùng Edit có chọn lọc).
- Đọc lỗi từ báo cáo ngắn (`verify`) thay vì log dài; không đọc lại file vừa viết.
- Sinh 34 scenario bằng một script thay vì viết tay khoảng 100 file JSON.
- Chỗ tốn nhất: viết lại `sim.ts` ở Phase 2 (ticket dài) và vòng tối ưu bench ở Phase 4.

## 8. Nếu làm lại
- Viết `sim.ts` theo **thứ tự bước có tên** (mỗi bước một hàm) ngay từ Phase 1: Phase 2/3 sẽ chỉ chèn bước thay vì sửa giữa hàm dài.
- Dùng **InstancedMesh + vật liệu rẻ** từ đầu và thêm bench sớm, không chờ Phase 4.
- Thêm **tiện ích kiểm biên** cho scenario (cảnh báo khi điểm xuất phát rơi đúng biên) để không lặp lỗi số thực.
- Chuẩn bị Docker để tự kiểm trên Linux thay vì chỉ dựa vào CI.
