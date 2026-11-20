# Bằng chứng Phase 2 (Ticket-02 "Ba hòn đảo", Contract v1.1)

Tái lập ở tag `phase-2`: `npm ci && npm run build && npm test && npm run verify -- phase-2`.
Báo cáo tự sinh: [headless-report.md](headless-report.md) (24 scenario, mã thoát, hiệu năng headless, lệnh tái lập). Output thật: [runs/](runs/).
Tiêu chí nghiệm thu và giả định: [assumptions.md § Phase 2](../../notes/assumptions.md#phase-2-ticket-02-ba-hòn-đảo-contract-v11).

## Truy vết yêu cầu → bằng chứng

| ID | Yêu cầu | Bằng chứng | Kết quả |
|---|---|---|---|
| Phần 1 | Số liệu chuẩn thay mọi số tự chọn | [game.contract.json](../../../game.contract.json) (v1.1), [constants.ts](../../../src/core/constants.ts), [maps.ts](../../../src/core/maps.ts) | ĐẠT |
| Phần 1 | Thứ tự 12 bước trong một tick | [sim.ts `step`](../../../src/core/sim.ts) (comment đánh số 1–11 + snapshot ở runner); `07`, `09b`, `16` kiểm thứ tự chạm/an toàn/tạm dừng | ĐẠT |
| Regression | Test Phase 1 đạt với số chuẩn | `01`–`13` (cập nhật theo số chuẩn; danh sách test bị thay thế và lý do ở assumptions.md) | ĐẠT |
| P2-1 | Lướt | `14_dash`, `14b_dash_air_height` | ĐẠT |
| P2-2 | Rơi khỏi đảo | `15_fall_respawn`, `15b_fall_last_flame` | ĐẠT |
| P2-3 | Tạm dừng | `16_pause` (headless); bản thường: Esc/P → menu 4 lựa chọn | ĐẠT (headless); bản thường kiểm thủ công |
| P2-4 | Bùa Gió | `17_charm` | ĐẠT |
| P2-5 | Gió Lạc | `18_drifter_steal`, `19_drifter_pulse`, `23_night2_drifter_schedule` | ĐẠT |
| P2-6 | Đêm 2 Đảo Cau | `20_night2_jump_pad`, [img/night2.png](img/night2.png) | ĐẠT |
| P2-7 | Đêm 3 Đảo Chuông | `21_night3_cliff_ramp`, `21b_night3_ramp`, [img/night3.png](img/night3.png), [img/night3-lit.png](img/night3-lit.png) | ĐẠT (bục nhảy Đêm 3 chưa có scenario riêng) |
| P2-8 | Gió mạnh | `22_night3_wind` | ĐẠT (lá bay báo trước chưa có ảnh) |
| P2-9 | Chuỗi 3 Đêm, Ông Đăng, Bình Minh | [main.ts](../../../src/render/main.ts) `showIntro/showResult`; [img/menu.png](img/menu.png) | Kiểm thủ công |
| P2-10 | Cài đặt lưu giữa các lần mở | [settings.ts](../../../src/render/settings.ts) (localStorage) | Kiểm thủ công |
| P2-11 | Âm thanh (nhạc + 10 loại SFX) | [audio.ts](../../../src/render/audio.ts), gắn vào event trong `onEvents` | Kiểm thủ công (nghe) |
| P2-12 | HUD đầy đủ | [img/night1.png](img/night1.png), [img/night3-lit.png](img/night3-lit.png): lửa, đồng hồ, đèn/điểm, thanh 10 ô, 2 ô hồi chiêu, mũi tên chỉ đèn | ĐẠT (đồng hồ đỏ ≤ 30 s chưa có ảnh) |
| P2-13 | Bảng màu + ánh sáng môi trường | `PAL` và `ambient.intensity = 0.15 + 0.55 × k` trong [world.ts](../../../src/render/world.ts) | ĐẠT (đối chiếu mã) |
| P2-14 | Contract v1.1 (trường, event, tên trạng thái) | `checkOutput` trong [scenario-lib.mjs](../../../scripts/scenario-lib.mjs) kiểm mọi snapshot của 24 scenario | ĐẠT |
| P2-15a | Headless 1 Đêm ≤ 30 s | Bảng "Hiệu năng headless" trong [headless-report.md](headless-report.md): 0.2–0.3 s | ĐẠT |
| P2-15b | ≥ 30 FPS ở 1280×720 | [fps.json](fps.json): Đêm 1 ≈ 163, Đêm 2 ≈ 168, Đêm 3 ≈ 124 FPS (Chrome, Intel UHD iGPU, i7-10750H) | ĐẠT |
| DoD | AGENTS/CLAUDE.md + skill cập nhật | [CLAUDE.md](../../../CLAUDE.md), [verify skill](../../../.claude/skills/verify/SKILL.md) (lịch sử git) | ĐẠT |

## Ảnh (Chrome headless, `?autostart&night=N`)

- [img/menu.png](img/menu.png): menu chính.
- [img/night1.png](img/night1.png), [img/night2.png](img/night2.png), [img/night3.png](img/night3.png): 3 bản đồ chuẩn, HUD.
- [img/night3-lit.png](img/night3-lit.png): Đêm 3, 6/7 đèn sáng (`&lit=6`): tầng 1, tầng 2, tháp chuông, mũi tên chỉ đèn còn lại.

## Đo FPS

`npm run build && npx vite preview --port 4173` rồi `OUT=docs/proof/phase-2/fps.json npm run fps`
(Chrome qua DevTools Protocol, viewport 1280×720, mỗi Đêm khoảng 10 s, đọc FPS trung bình do game tự đo).

## Đánh giá Phase 2

- Đạt: toàn bộ test headless (24 scenario + unit + tất định), hiệu năng headless, FPS.
- Chưa có bằng chứng tự động: luồng menu/Ông Đăng/Bình Minh, cài đặt, âm thanh (chỉ kiểm thủ công); scenario riêng cho bục nhảy Đêm 3; ảnh đồng hồ đỏ và lá bay báo gió.
- Phase 1: các test cũ bị số chuẩn thay thế đã được viết lại, lý do ghi trong assumptions.md. Không có test nào bị tắt.
