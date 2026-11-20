# Bằng chứng headless: phase-3

Sinh tự động bởi `npm run verify` lúc 2026-11-20T09:11:10.373Z.
Máy: Windows_NT 10.0.26300 · Intel(R) Core(TM) i7-10750H CPU @ 2.60GHz · Node v24.14.0.
Commit: 56cc348.
Mỗi scenario chạy CLI thật **2 lần** và so sánh byte-by-byte (tất định). Output lần 1 lưu trong `runs/`.

| Scenario | Yêu cầu kiểm | Kết thúc | Tất định | Thời gian | Kết quả |
|---|---|---|---|---:|---|
| `01_pickup` | R2 nhặt trong pickup_radius 1.0 (tick 41); điểm chưa cộng khi nhặt | playing @60, score 0 | giống hệt | 88 ms | ĐẠT |
| `02_deposit_light` | R3 nạp ở biên interact_radius 2.0; đủ 10 thì thắp lần đầu; điểm (Ticket-03) 10 x 5 + 100 = 150 | playing @20, score 150 | giống hệt | 87 ms | ĐẠT |
| `03_partial_tiebreak` | R3 nạp một phần, đèn nhớ tiến độ; hai đèn cách đều thì chọn id nhỏ hơn | playing @30, score 15 | giống hệt | 90 ms | ĐẠT |
| `04_win_dawn_survived` | T3 thắng khi sống tới bình minh và >= 3/5 đèn sáng; điểm 3 x (50 + floor(99)) + 3 x 50 = 597 | won @60, score 597 | giống hệt | 78 ms | ĐẠT |
| `04b_lose_dawn_below_threshold` | T3 hết giờ mà chỉ 2/5 đèn sáng (< 3) thì thua dawn | lost @60, score 0 | giống hệt | 83 ms | ĐẠT |
| `04c_all_lit_no_early_end` | T3 thắp đủ 5/5 đèn không kết thúc Đêm; sức chứa 10 + 2 x 1 = 12 (đèn đặt sẵn không tính) | playing @120, score 150 | giống hệt | 79 ms | ĐẠT |
| `05_pulse_stun` | R4 Tỏa Sáng: tốn 3, bán kính 5 m (3D), choáng 120 tick, đẩy 4 m trong 15 tick, +5 điểm, hồi chiêu 3 s | playing @200, score 5 | giống hệt | 83 ms | ĐẠT |
| `06_pulse_edge_cooldown_cost` | R4 kích hoạt khi false->true; hồi chiêu 180 tick; không đủ 3 đom đóm thì không kích hoạt | playing @700, score 0 | giống hệt | 104 ms | ĐẠT |
| `07_hit_recoil_no_flames` | R4/R5 chạm XZ<=1: -1 lửa, rơi floor(n/2) đom đóm (vành 1.5-2.5 m, ttl 480), bất tử 90 tick, bóng recoil; hết lửa thua | lost @211, score 0 | giống hệt | 84 ms | ĐẠT |
| `08_dawn` | R5 hết giờ thì thua dawn | lost @60, score 0 | giống hệt | 83 ms | ĐẠT |
| `09_safe_radius_block` | R4 Bóng Mực ngoài vùng bị chặn ở mép 6 m của đèn đã sáng | playing @600, score 0 | giống hệt | 99 ms | ĐẠT |
| `09b_safe_radius_evict` | R4 bóng ở trong lúc đèn vừa thắp bị đẩy ra mép trong 30 tick, không gây sát thương | playing @300, score 150 | giống hệt | 91 ms | ĐẠT |
| `10_cam_yaw` | R1 tốc độ 6 m/s; yaw 90 biến z thành +X; [1,1] chuẩn hóa | playing @130, score 0 | giống hệt | 82 ms | ĐẠT |
| `11_jump` | R1 nhảy 7 m/s, trọng lực 20; về Y=0; giữ nút không nhảy lại | playing @120, score 0 | giống hệt | 91 ms | ĐẠT |
| `12_carry_capacity_height` | R2 không mang quá 10 | playing @10, score 0 | giống hệt | 79 ms | ĐẠT |
| `12b_pickup_height` | R2 chênh cao > 1.5 m thì không nhặt | playing @10, score 0 | giống hệt | 79 ms | ĐẠT |
| `13_night1_random_schedule` | Đêm 1 chuẩn: 20 đom đóm, sinh thêm mỗi 240 tick tới hết 24 điểm; Bóng Mực tick 300 (2 con) rồi mỗi 480 tick, tối đa 6 | playing @3500, score 0 | giống hệt | 125 ms | ĐẠT |
| `14_dash` | P2 Lướt: 14 m/s, 0.2 s, hồi chiêu 1.5 s; hướng mặt khi đứng yên; event dash | playing @130, score 0 | giống hệt | 93 ms | ĐẠT |
| `14b_dash_air_height` | P2 lướt trên không giữ nguyên độ cao; hướng = hướng đang di chuyển (+X) | playing @40, score 0 | giống hệt | 79 ms | ĐẠT |
| `15_fall_respawn` | P2 rơi (Y<-10): -1 lửa, mất toàn bộ đom đóm, chờ 60 tick, hồi sinh ở xuất phát, bất tử 90 tick | playing @300, score 0 | giống hệt | 87 ms | ĐẠT |
| `15b_fall_last_flame` | P2 rơi khi còn 1 lửa thì thua ngay, không hồi sinh | lost @66, score 0 | giống hệt | 75 ms | ĐẠT |
| `16_pause` | P2 tạm dừng: tick tăng, sim_tick/thời gian đứng yên, state paused; event paused/resumed | playing @60, score 0 | giống hệt | 93 ms | ĐẠT |
| `17_charm` | P2 Bùa Gió: nhặt như đom đóm, 600 tick, 7.2 m/s, lướt không hồi chiêu, xuất hiện lại sau 2700 tick | playing @60, score 0 | giống hệt | 86 ms | ĐẠT |
| `18_drifter_steal` | P2 Gió Lạc: idle->chase khi mang >=5 và <=15 m; chạm 1.2 m cướp min(3, n); flee 240 tick rồi removed | playing @300, score 0 | giống hệt | 122 ms | ĐẠT |
| `19_drifter_pulse` | P2 Tỏa Sáng với Gió Lạc: chase->flee không cướp; flee có đồ -> thả lại (drifter_drop), biến mất sau 120 tick | playing @300, score 0 | giống hệt | 85 ms | ĐẠT |
| `20_night2_jump_pad` | P2 Đêm 2 bục nhảy: vy 14, ngang 24 m/s về tâm đảo kia, bay ~1.4 s, đáp trong đảo đích; cầu tre nối hai đảo | playing @120, score 0 | giống hệt | 87 ms | ĐẠT |
| `21_night3_cliff_ramp` | P2 Đêm 3: mép tầng là vách đứng, không đi lên được | playing @60, score 0 | giống hệt | 80 ms | ĐẠT |
| `21b_night3_ramp` | P2 Đêm 3: dốc 30° từ r=30 (Y=0) lên r=24 (Y=3), tới tầng 1 | playing @120, score 0 | giống hệt | 85 ms | ĐẠT |
| `22_night3_wind` | P2 Đêm 3 gió mạnh: mỗi 30 s một cơn 5 s, đẩy người chơi 2 m/s | playing @2200, score 0 | giống hệt | 107 ms | ĐẠT |
| `23_night2_drifter_schedule` | P2 Gió Lạc sinh ở tick 1200, 2400... tối đa 2, id D1, D2 | playing @3700, score 0 | giống hệt | 106 ms | ĐẠT |
| `24_fuel_decay_out` | T3 dầu hao 1/s; fuel <= 0 thì tắt, deposited = 0, lantern_out, ever_lit = true | playing @100, score 0 | giống hệt | 88 ms | ĐẠT |
| `25_refuel` | T3 châm dầu: used = min(mang, ceil((100-fuel)/10)), fuel = min(100, fuel + 10 x used), +5/đom đóm | playing @30, score 30 | giống hệt | 90 ms | ĐẠT |
| `26_relight` | T3 thắp lại đèn ever_lit chỉ cần 5; lantern_lit relight: true; +40; relit_count; sức chứa tăng | playing @20, score 65 | giống hệt | 83 ms | ĐẠT |
| `27_drain` | T3 bóng wander tới đèn fuel < 30 (mất vùng an toàn), cách <= 2 m thì drain, hút 5/s + hao 1/s, fuel_drain mỗi 60 tick | playing @130, score 0 | giống hệt | 85 ms | ĐẠT |
| `28_pulse_drain_bonus` | T3 Tỏa Sáng trúng bóng đang drain: stunned, tổng +15 | playing @20, score 15 | giống hệt | 83 ms | ĐẠT |
| `29_win_threshold_night2` | T3 Đêm 2 thắng với 4/6 đèn sáng; điểm 4 x 149 + 150 = 746 | won @60, score 746 | giống hệt | 81 ms | ĐẠT |
| `29b_lose_threshold_night3` | T3 Đêm 3 chỉ 4/7 đèn sáng (< 5) thì thua dawn | lost @60, score 0 | giống hệt | 76 ms | ĐẠT |
| `30_refuel_evict` | T3 châm dầu lên >= 30 khi có bóng trong vùng: đẩy ra mép trong 30 tick, không gây sát thương | playing @60, score 45 | giống hệt | 77 ms | ĐẠT |

## Mã thoát khi đầu vào sai

| Trường hợp | Mã thoát | stderr | Kết quả |
|---|---:|---|---|
| inputs JSON hỏng -> 2 | 2 | Lỗi: File inputs không phải JSON hợp lệ: Expected property name or '}' in JSON at position | ĐẠT |
| inputs tick không tăng -> 2 | 2 | Lỗi: inputs.frames[1].tick: phải tăng nghiêm ngặt | ĐẠT |
| scenario sai kiểu -> 2 | 2 | Lỗi: scenario.player.pos: cần mảng 3 số [x, y, z] | ĐẠT |
| file scenario không tồn tại -> 2 | 2 | Lỗi: Không đọc được file scenario: khong-co.json | ĐẠT |
| thiếu --out -> khác 0 | 1 | Lỗi: Thiếu --out | ĐẠT |

## Hiệu năng headless (một Đêm đầy đủ, ngưỡng 30 s)

| Đêm | Lệnh | Kết thúc | Thời gian | Kết quả |
|---|---|---|---:|---|
| 1 | `--seed 1 --night 1 --ticks 21600` | lost @14400 | 0.23 s | ĐẠT |
| 2 | `--seed 1 --night 2 --ticks 21600` | lost @16200 | 0.28 s | ĐẠT |
| 3 | `--seed 1 --night 3 --ticks 21600` | lost @14760 | 0.35 s | ĐẠT |

## Lệnh tái lập

```bash
node build/headless/cli.js --seed 1 --night 1 --ticks 60 --snapshot-every 10 --scenario scenarios/01_pickup/scenario.json --inputs scenarios/01_pickup/inputs.json --out docs/proof/phase-3/runs/01_pickup.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 20 --snapshot-every 10 --scenario scenarios/02_deposit_light/scenario.json --inputs scenarios/02_deposit_light/inputs.json --out docs/proof/phase-3/runs/02_deposit_light.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 30 --snapshot-every 10 --scenario scenarios/03_partial_tiebreak/scenario.json --inputs scenarios/03_partial_tiebreak/inputs.json --out docs/proof/phase-3/runs/03_partial_tiebreak.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 600 --snapshot-every 10 --scenario scenarios/04_win_dawn_survived/scenario.json --out docs/proof/phase-3/runs/04_win_dawn_survived.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 600 --snapshot-every 10 --scenario scenarios/04b_lose_dawn_below_threshold/scenario.json --out docs/proof/phase-3/runs/04b_lose_dawn_below_threshold.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 120 --snapshot-every 10 --scenario scenarios/04c_all_lit_no_early_end/scenario.json --inputs scenarios/04c_all_lit_no_early_end/inputs.json --out docs/proof/phase-3/runs/04c_all_lit_no_early_end.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 200 --snapshot-every 10 --scenario scenarios/05_pulse_stun/scenario.json --inputs scenarios/05_pulse_stun/inputs.json --out docs/proof/phase-3/runs/05_pulse_stun.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 700 --snapshot-every 10 --scenario scenarios/06_pulse_edge_cooldown_cost/scenario.json --inputs scenarios/06_pulse_edge_cooldown_cost/inputs.json --out docs/proof/phase-3/runs/06_pulse_edge_cooldown_cost.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 1000 --snapshot-every 10 --scenario scenarios/07_hit_recoil_no_flames/scenario.json --out docs/proof/phase-3/runs/07_hit_recoil_no_flames.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 600 --snapshot-every 30 --scenario scenarios/08_dawn/scenario.json --out docs/proof/phase-3/runs/08_dawn.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 600 --snapshot-every 100 --scenario scenarios/09_safe_radius_block/scenario.json --out docs/proof/phase-3/runs/09_safe_radius_block.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 300 --snapshot-every 10 --scenario scenarios/09b_safe_radius_evict/scenario.json --inputs scenarios/09b_safe_radius_evict/inputs.json --out docs/proof/phase-3/runs/09b_safe_radius_evict.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 130 --snapshot-every 60 --scenario scenarios/10_cam_yaw/scenario.json --inputs scenarios/10_cam_yaw/inputs.json --out docs/proof/phase-3/runs/10_cam_yaw.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 120 --snapshot-every 10 --scenario scenarios/11_jump/scenario.json --inputs scenarios/11_jump/inputs.json --out docs/proof/phase-3/runs/11_jump.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 10 --snapshot-every 10 --scenario scenarios/12_carry_capacity_height/scenario.json --out docs/proof/phase-3/runs/12_carry_capacity_height.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 10 --snapshot-every 10 --scenario scenarios/12b_pickup_height/scenario.json --out docs/proof/phase-3/runs/12b_pickup_height.jsonl
node build/headless/cli.js --seed 42 --night 1 --ticks 3500 --snapshot-every 60 --out docs/proof/phase-3/runs/13_night1_random_schedule.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 130 --snapshot-every 10 --scenario scenarios/14_dash/scenario.json --inputs scenarios/14_dash/inputs.json --out docs/proof/phase-3/runs/14_dash.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 40 --snapshot-every 5 --scenario scenarios/14b_dash_air_height/scenario.json --inputs scenarios/14b_dash_air_height/inputs.json --out docs/proof/phase-3/runs/14b_dash_air_height.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 300 --snapshot-every 10 --scenario scenarios/15_fall_respawn/scenario.json --inputs scenarios/15_fall_respawn/inputs.json --out docs/proof/phase-3/runs/15_fall_respawn.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 300 --snapshot-every 10 --scenario scenarios/15b_fall_last_flame/scenario.json --inputs scenarios/15b_fall_last_flame/inputs.json --out docs/proof/phase-3/runs/15b_fall_last_flame.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 60 --snapshot-every 10 --scenario scenarios/16_pause/scenario.json --inputs scenarios/16_pause/inputs.json --out docs/proof/phase-3/runs/16_pause.jsonl
node build/headless/cli.js --seed 1 --night 2 --ticks 60 --snapshot-every 10 --scenario scenarios/17_charm/scenario.json --inputs scenarios/17_charm/inputs.json --out docs/proof/phase-3/runs/17_charm.jsonl
node build/headless/cli.js --seed 1 --night 2 --ticks 300 --snapshot-every 10 --scenario scenarios/18_drifter_steal/scenario.json --out docs/proof/phase-3/runs/18_drifter_steal.jsonl
node build/headless/cli.js --seed 1 --night 2 --ticks 300 --snapshot-every 10 --scenario scenarios/19_drifter_pulse/scenario.json --inputs scenarios/19_drifter_pulse/inputs.json --out docs/proof/phase-3/runs/19_drifter_pulse.jsonl
node build/headless/cli.js --seed 1 --night 2 --ticks 120 --snapshot-every 10 --scenario scenarios/20_night2_jump_pad/scenario.json --out docs/proof/phase-3/runs/20_night2_jump_pad.jsonl
node build/headless/cli.js --seed 1 --night 3 --ticks 60 --snapshot-every 60 --scenario scenarios/21_night3_cliff_ramp/scenario.json --inputs scenarios/21_night3_cliff_ramp/inputs.json --out docs/proof/phase-3/runs/21_night3_cliff_ramp.jsonl
node build/headless/cli.js --seed 1 --night 3 --ticks 120 --snapshot-every 40 --scenario scenarios/21b_night3_ramp/scenario.json --inputs scenarios/21b_night3_ramp/inputs.json --out docs/proof/phase-3/runs/21b_night3_ramp.jsonl
node build/headless/cli.js --seed 5 --night 3 --ticks 2200 --snapshot-every 10 --scenario scenarios/22_night3_wind/scenario.json --out docs/proof/phase-3/runs/22_night3_wind.jsonl
node build/headless/cli.js --seed 9 --night 2 --ticks 3700 --snapshot-every 100 --scenario scenarios/23_night2_drifter_schedule/scenario.json --out docs/proof/phase-3/runs/23_night2_drifter_schedule.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 100 --snapshot-every 10 --scenario scenarios/24_fuel_decay_out/scenario.json --out docs/proof/phase-3/runs/24_fuel_decay_out.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 30 --snapshot-every 10 --scenario scenarios/25_refuel/scenario.json --inputs scenarios/25_refuel/inputs.json --out docs/proof/phase-3/runs/25_refuel.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 20 --snapshot-every 10 --scenario scenarios/26_relight/scenario.json --inputs scenarios/26_relight/inputs.json --out docs/proof/phase-3/runs/26_relight.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 130 --snapshot-every 10 --scenario scenarios/27_drain/scenario.json --out docs/proof/phase-3/runs/27_drain.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 20 --snapshot-every 10 --scenario scenarios/28_pulse_drain_bonus/scenario.json --inputs scenarios/28_pulse_drain_bonus/inputs.json --out docs/proof/phase-3/runs/28_pulse_drain_bonus.jsonl
node build/headless/cli.js --seed 1 --night 2 --ticks 120 --snapshot-every 10 --scenario scenarios/29_win_threshold_night2/scenario.json --out docs/proof/phase-3/runs/29_win_threshold_night2.jsonl
node build/headless/cli.js --seed 1 --night 3 --ticks 120 --snapshot-every 10 --scenario scenarios/29b_lose_threshold_night3/scenario.json --out docs/proof/phase-3/runs/29b_lose_threshold_night3.jsonl
node build/headless/cli.js --seed 1 --night 1 --ticks 60 --snapshot-every 10 --scenario scenarios/30_refuel_evict/scenario.json --inputs scenarios/30_refuel_evict/inputs.json --out docs/proof/phase-3/runs/30_refuel_evict.jsonl
```
