# Bằng chứng headless: phase-1

Sinh tự động bởi `npm run verify` lúc 2026-11-20T08:00:21.740Z.
Máy: Windows_NT 10.0.26300 · Intel(R) Core(TM) i7-10750H CPU @ 2.60GHz · Node v24.14.0.
Commit: 8589747.
Mỗi scenario chạy CLI thật **2 lần** và so sánh byte-by-byte (tất định). Output lần 1 lưu trong `runs/`.

| Scenario | Yêu cầu kiểm | Kết thúc | Tất định | Thời gian | Kết quả |
|---|---|---|---|---:|---|
| `01_pickup` | R2 nhặt đom đóm trong pickup_radius; R9 per_mote; mô hình tick | playing @60, score 10 | giống hệt | 72 ms | ĐẠT |
| `02_deposit_light` | R3 nạp trong interact_radius, đủ lantern_cost thì thắp; R9 per_lantern | playing @20, score 100 | giống hệt | 78 ms | ĐẠT |
| `03_partial_deposit` | R3 nạp một phần; khoảng cách 3 = interact_radius vẫn tính (<= r); chưa đủ thì chưa sáng | playing @30, score 0 | giống hệt | 69 ms | ĐẠT |
| `04_win_all_lit` | R5 thắng khi đủ 5 đèn; đèn lit sẵn từ scenario không cộng điểm; điểm = 100 + floor(299.983)*1 + 3*50 = 549 | won @1, score 549 | giống hệt | 70 ms | ĐẠT |
| `05_pulse_stun` | R4 pulse: trong pulse_radius bị stunned pulse_stun_s (180 tick), đẩy pulse_push_m, tốn pulse_cost; per_stun | playing @200, score 25 | giống hệt | 77 ms | ĐẠT |
| `06_pulse_edge_cost` | R4 giữ nút chỉ kích hoạt 1 lần (false->true); hết đom đóm thì không pulse được | playing @150, score 0 | giống hệt | 66 ms | ĐẠT |
| `07_hit_no_flames` | R4/R5 chạm mất 1 flame, rơi floor(carried*hit_drop_ratio), bất tử invuln_s; hết flame thì thua no_flames | lost @215, score 0 | giống hệt | 75 ms | ĐẠT |
| `08_dawn` | R5 hết giờ thì thua dawn; time_left_s = thời lượng - bước/60 | lost @60, score 0 | giống hệt | 70 ms | ĐẠT |
| `09_safe_radius` | R4 Bóng Mực không vào safe_radius quanh đèn đã sáng; đứng trong vùng an toàn không bị chạm | playing @600, score 0 | giống hệt | 78 ms | ĐẠT |
| `10_cam_yaw` | R1 tốc độ player_speed; yaw 90 biến z thành +X; vector [1,1] được chuẩn hóa | playing @130, score 0 | giống hệt | 70 ms | ĐẠT |
| `11_jump` | R1 nhảy rồi về mặt đất Y=0; giữ nút không nhảy lại | playing @120, score 0 | giống hệt | 68 ms | ĐẠT |
| `12_carry_capacity` | R2 không mang quá carry_capacity (10) | playing @10, score 100 | giống hệt | 78 ms | ĐẠT |
| `13_random_idle` | R4 Bóng Mực tự sinh và đuổi theo; một đêm ngẫu nhiên theo seed, đứng yên thì thua no_flames | lost @763, score 0 | giống hệt | 75 ms | ĐẠT |

## Mã thoát khi đầu vào sai

| Trường hợp | Mã thoát | stderr | Kết quả |
|---|---:|---|---|
| inputs JSON hỏng -> 2 | 2 | Lỗi: File inputs không phải JSON hợp lệ: Expected property name or '}' in JSON at position | ĐẠT |
| inputs tick không tăng -> 2 | 2 | Lỗi: inputs.frames[1].tick: phải tăng nghiêm ngặt | ĐẠT |
| scenario sai kiểu -> 2 | 2 | Lỗi: scenario.player.pos: cần mảng 3 số [x, y, z] | ĐẠT |
| file scenario không tồn tại -> 2 | 2 | Lỗi: Không đọc được file scenario: khong-co.json | ĐẠT |
| thiếu --out -> khác 0 | 1 | Lỗi: Thiếu --out | ĐẠT |

## Lệnh tái lập

```bash
node build/headless/cli.js --seed 1 --night 1 --ticks 60 --snapshot-every 10 --scenario scenarios/01_pickup/scenario.json --inputs scenarios/01_pickup/inputs.json --out docs/proof/phase-1/runs/01_pickup.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 20 --snapshot-every 10 --scenario scenarios/02_deposit_light/scenario.json --inputs scenarios/02_deposit_light/inputs.json --out docs/proof/phase-1/runs/02_deposit_light.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 30 --snapshot-every 10 --scenario scenarios/03_partial_deposit/scenario.json --inputs scenarios/03_partial_deposit/inputs.json --out docs/proof/phase-1/runs/03_partial_deposit.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 600 --snapshot-every 10 --scenario scenarios/04_win_all_lit/scenario.json --inputs scenarios/04_win_all_lit/inputs.json --out docs/proof/phase-1/runs/04_win_all_lit.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 200 --snapshot-every 10 --scenario scenarios/05_pulse_stun/scenario.json --inputs scenarios/05_pulse_stun/inputs.json --out docs/proof/phase-1/runs/05_pulse_stun.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 150 --snapshot-every 10 --scenario scenarios/06_pulse_edge_cost/scenario.json --inputs scenarios/06_pulse_edge_cost/inputs.json --out docs/proof/phase-1/runs/06_pulse_edge_cost.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 1000 --snapshot-every 10 --scenario scenarios/07_hit_no_flames/scenario.json --out docs/proof/phase-1/runs/07_hit_no_flames.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 600 --snapshot-every 30 --scenario scenarios/08_dawn/scenario.json --out docs/proof/phase-1/runs/08_dawn.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 600 --snapshot-every 100 --scenario scenarios/09_safe_radius/scenario.json --out docs/proof/phase-1/runs/09_safe_radius.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 130 --snapshot-every 60 --scenario scenarios/10_cam_yaw/scenario.json --inputs scenarios/10_cam_yaw/inputs.json --out docs/proof/phase-1/runs/10_cam_yaw.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 120 --snapshot-every 10 --scenario scenarios/11_jump/scenario.json --inputs scenarios/11_jump/inputs.json --out docs/proof/phase-1/runs/11_jump.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 10 --snapshot-every 10 --scenario scenarios/12_carry_capacity/scenario.json --out docs/proof/phase-1/runs/12_carry_capacity.jsonl
node build/headless/cli.js --seed 42 --night 1 --ticks 18000 --snapshot-every 60 --out docs/proof/phase-1/runs/13_random_idle.jsonl
```
