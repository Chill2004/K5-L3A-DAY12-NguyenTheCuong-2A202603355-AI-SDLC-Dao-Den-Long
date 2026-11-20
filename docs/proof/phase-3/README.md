# Bằng chứng Phase 3 (Ticket-03 "Đèn cạn dầu", Contract v1.2)

Tái lập ở tag `phase-3`: `npm ci && npm run build && npm test && npm run verify -- phase-3`.
Báo cáo tự sinh: [headless-report.md](headless-report.md) (34 scenario, mã thoát, hiệu năng). Output thật: [runs/](runs/).
Quyết định thiết kế: [ADR 0001](../../adr/0001-lantern-fuel-and-dawn-win.md). Breaking changes: [CHANGELOG](../../../CHANGELOG.md).

## Truy vết yêu cầu → bằng chứng

| Mục | Yêu cầu | Scenario / bằng chứng | Kết quả |
|---|---|---|---|
| 1 | Hao 1/s; hết dầu thì tắt, deposited 0, `lantern_out`, `ever_lit` | `24_fuel_decay_out` | ĐẠT |
| 1 | Châm dầu: used = min(mang, ceil((100−fuel)/10)), trần 100, +5/đom đóm, `refuel` | `25_refuel` | ĐẠT |
| 1 | Thắp lại đèn `ever_lit` chỉ cần 5, `relight: true`, `relit_count` | `26_relight` | ĐẠT |
| 1 | Thanh dầu, nhấp nháy 1 Hz khi < 30 | [img/fuel-bars.png](img/fuel-bars.png), `world.ts` | ĐẠT (ảnh tĩnh, nhấp nháy kiểm thủ công) |
| 2 | Dầu < 30 mất vùng an toàn; bóng `wander` tới đèn yếu, ≤ 2 m thì `drain`, hút 5/s, `fuel_drain` mỗi 60 tick | `27_drain` | ĐẠT |
| 2 | Tỏa Sáng trúng bóng `drain` tổng +15; hết choáng về `wander` | `28_pulse_drain_bonus`, `05_pulse_stun` | ĐẠT |
| 2 | Châm lên ≥ 30 khi có bóng trong vùng: đẩy ra trong 30 tick, vô hại | `30_refuel_evict` | ĐẠT |
| 2 | Đúng 30 vẫn còn vùng; `drain` → `chase` khi Mây ≤ 6 m | mã `hasSafeZone` (`>=`), nhánh `drain` trong `sim.ts` | Đối chiếu mã (chưa có scenario riêng) |
| 3 | Thời lượng 240/270/300; thắng `dawn_survived` khi ≥ ceil(0.6 n) đèn sáng; không thắng sớm | `04_win_dawn_survived`, `04b_lose_dawn_below_threshold`, `04c_all_lit_no_early_end`, `29_win_threshold_night2`, `29b_lose_threshold_night3`, `16_pause` | ĐẠT |
| 3 | Hết Ngọn Lửa luôn thua trước | `07_hit_recoil_no_flames`, `15b_fall_last_flame` | ĐẠT |
| 4 | Sức chứa 10 + 2 × lần thắp, tối đa 20; đèn đặt sẵn không tính; HUD đang mang / sức chứa | `02` (12), `04c` (12), `26` (12); HUD `0/10` trong [img/fuel-bars.png](img/fuel-bars.png) | ĐẠT |
| 5 | Điểm mới (5/đom đóm, +100/+40, bình minh 50 + floor(fuel), +50/lửa, bỏ thưởng thời gian) | `02` (150), `03` (15), `04` (597), `25` (30), `26` (65), `29` (746) | ĐẠT |
| 6 | Bảng màu dễ phân biệt (lưu): viền bóng #00B3FF, cảnh báo #FFFFFF + ⚠, đèn tắt xẹp 20% + vết rách | `settings.ts`, `world.setColorblind`, `index.html` (`body.cb`), `world.ts` | Kiểm thủ công |
| 7 | Contract v1.2: trường snapshot/scenario/sự kiện mới, trạng thái `drain` | `checkOutput` kiểm `fuel/ever_lit/relit_count/capacity` cho mọi snapshot; validate nhận `fuel/ever_lit/successful_lights/target_lantern_id` | ĐẠT |
| DoD | Regression Phase 1–2 không bị thay vẫn đạt | 34/34 scenario, trong đó 26 từ Phase 1–2 | ĐẠT |
| DoD | Hiệu năng headless một Đêm | 0.2–0.3 s (bảng trong headless-report) | ĐẠT |

## Đánh giá Phase 3

- Đạt toàn bộ test headless (46 Vitest, 34 scenario qua CLI thật, tất định).
- Chưa có scenario riêng: `drain → chase` khi Mây vào 6 m, biên đúng 30 dầu, nhiều bóng hút cộng dồn.
- Test cũ bị luật mới thay: 1 test bị xóa có lý do (`04_win_all_lit`), 3 test được cập nhật số. Không có test bị skip.
