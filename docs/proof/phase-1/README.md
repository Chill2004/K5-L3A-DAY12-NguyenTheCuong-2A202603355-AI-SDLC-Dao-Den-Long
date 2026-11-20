# Bằng chứng Phase 1 (PRD-0, Test Contract v1.0)

Tái lập ở tag `phase-1`: `npm ci && npm run build && npm test && npm run verify`.
Báo cáo headless tự sinh: [headless-report.md](headless-report.md) (lệnh tái lập từng scenario ở cuối file). Output thật: [runs/](runs/).
Giả định dùng để kiểm: [../../notes/assumptions.md](../../notes/assumptions.md).

## Truy vết yêu cầu → bằng chứng

| ID | Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| R1 | Di chuyển, nhảy, camera 3D | Scenario: tốc độ 6 m/s, xoay yaw 90°, chuẩn hóa `[1,1]`; nhảy rồi về Y=0; chơi thử bản 3D | `10_cam_yaw`, `11_jump`, [img/gameplay.png](img/gameplay.png) | ĐẠT |
| R2 | Đom đóm, nhặt được | Nhặt đúng tick tính tay (36), giới hạn 10 | `01_pickup`, `12_carry_capacity` | ĐẠT |
| R3 | Nạp ánh sáng thắp đèn | Nạp đủ 5 thì sáng; nạp một phần; biên `interact_radius` (= 3 m) | `02_deposit_light`, `03_partial_deposit` | ĐẠT |
| R4 | Bóng Mực đuổi; xung sáng xua | Choáng 180 tick + đẩy 4 m + tốn 1; giữ nút chỉ 1 lần; chạm ở tick 35/125/215 (bất tử 90 tick); `safe_radius`; tự sinh và đuổi | `05_pulse_stun`, `06_pulse_edge_cost`, `07_hit_no_flames`, `09_safe_radius`, `13_random_idle` | ĐẠT |
| R5 | Thắng / thua | `all_lit` (điểm 549 tính tay), `dawn` ở tick 60, `no_flames` ở tick 215 | `04_win_all_lit`, `08_dawn`, `07_hit_no_flames` | ĐẠT |
| R6 | Điểm, HUD | Điểm theo bảng contract trong mọi scenario; HUD trên ảnh | các `end.score` trong [headless-report.md](headless-report.md), [img/lanterns-lit.png](img/lanterns-lit.png) | ĐẠT |
| R7 | Chơi lại | Màn kết thúc có nút "Chơi lại (R)", phím R tạo ván mới | `src/render/main.ts` (`showEnd`, `start`); kiểm bằng chơi thử thủ công | ĐẠT (kiểm thủ công, chưa có ảnh màn kết thúc) |
| R8 | Headless theo contract | Cấu trúc JSONL (snapshot tick 0, end cuối, tên event), mã thoát 2, chạy 2 lần giống hệt | `checkOutput` trong [scenario-lib.mjs](../../../scripts/scenario-lib.mjs), bảng mã thoát + cột Tất định trong [headless-report.md](headless-report.md), `tests/scenarios.test.ts > determinism` | ĐẠT |
| R9 | Contract khai đúng số | Core và CLI đọc `tuning` trực tiếp từ `game.contract.json`; scenario tính tay từ chính các số đó | [cli.ts](../../../src/headless/cli.ts), [main.ts](../../../src/render/main.ts) | ĐẠT |
| R10 | Chạy trên macOS/Linux | Node + web tĩnh; CI ubuntu-latest + macos-latest | [.github/workflows/ci.yml](../../../.github/workflows/ci.yml); clone sạch trên Windows chạy được và output khớp `runs/07_hit_no_flames.jsonl` | ĐẠT trên Windows; **chờ CI** xác nhận macOS/Linux sau khi push (Docker local không chạy được) |

## Kiểm tra clone sạch

Clone repo sang thư mục khác → `npm ci` → `npm run build` → `node build/headless/cli.js --seed 1 --night 1 --ticks 600 --scenario scenarios/07_hit_no_flames/scenario.json --out out.jsonl`
→ exit 0, `{"type":"end","ticks":215,"state":"lost","score":0}`, `diff` với `runs/07_hit_no_flames.jsonl`: **giống hệt**.

## Ảnh

- [img/start.png](img/start.png): màn bắt đầu.
- [img/gameplay.png](img/gameplay.png): Mây (nón lá, đèn nhỏ), đom đóm, HUD.
- [img/lanterns-lit.png](img/lanterns-lit.png): 4 đèn đã sáng (chụp với `?autostart&lit=4`), vòng an toàn `safe_radius`, trời ấm dần.

Ảnh chụp bằng Chrome headless (SwiftShader) từ bản `npm run preview`.

## Đánh giá Phase 1

- Đạt: R1–R9. R10 chờ CI.
- Chưa có: ảnh màn thắng/thua (chỉ kiểm thủ công), âm thanh.
- AI sai 1 lần về logic (choáng hết sớm 1 tick); scenario tính tay đã bắt được. Xem [ai-log.md](../../notes/ai-log.md).
- Harness cần chỉnh: chưa cần. Hook Stop và skill verify đã dùng được ngay từ phase này.
