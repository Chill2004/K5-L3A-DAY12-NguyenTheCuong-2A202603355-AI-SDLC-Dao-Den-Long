# Giả định và tiêu chí nghiệm thu

## Phase 1 (PRD-0, Contract v1.0)

### Yêu cầu bắt buộc (trích PRD-0) → tiêu chí nghiệm thu

| ID | Yêu cầu | Tiêu chí kiểm chứng được |
|---|---|---|
| R1 | Di chuyển, nhảy, camera 3D | `move` × `player_speed` m/s theo yaw (công thức contract), vector > 1 chuẩn hóa; nhảy rồi về Y=0 |
| R2 | Đom đóm rải trên đảo, nhặt được | Trong `pickup_radius` thì nhặt, phát `mote_picked`; không vượt `carry_capacity` |
| R3 | Nạp ánh sáng để thắp đèn | E trong `interact_radius` thì `deposit`; đủ `lantern_cost` thì `lantern_lit` |
| R4 | Bóng Mực xuất hiện, đuổi; xung sáng xua đuổi | Bóng Mực đuổi theo; pulse làm `stunned` + đẩy; chạm thì `player_hit`; không vào `safe_radius` |
| R5 | Thắng, thua | 5 đèn sáng thì `won/all_lit`; hết giờ thì `lost/dawn`; hết lửa thì `lost/no_flames` |
| R6 | Điểm, HUD | Điểm theo bảng `score` trong contract; HUD hiện đèn, lửa, đom đóm, thời gian, điểm |
| R7 | Chơi lại sau thắng/thua | Màn kết thúc có nút/phím R tạo ván mới |
| R8 | Headless theo Test Contract v1.0 | Tham số, mô hình tick, JSONL, mã thoát 2, tất định |
| R9 | `game.contract.json` khai đúng số đang dùng | Code đọc tuning **trực tiếp** từ file này (không có bản sao số) |
| R10 | Chạy được trên macOS/Linux | Node + bản web tĩnh; CI chạy trên ubuntu-latest và macos-latest |

### Giả định cho chỗ mơ hồ

| # | Chỗ mơ hồ | Giả định của tôi | Lý do |
|---|---|---|---|
| A1 | Nhặt đom đóm thế nào | Tự động khi trong `pickup_radius`; nhiều con trong cùng tick nhặt theo thứ tự danh sách | Đơn giản, không cần nút |
| A2 | Đầy túi | Đom đóm vượt `carry_capacity` vẫn nằm yên trên đất | |
| A3 | Nạp đèn | Bấm interact (false→true), chọn **đèn chưa sáng gần nhất** trong `interact_radius`; nạp `min(carried, lantern_cost − deposited)`. Cùng tick: `deposit` rồi `lantern_lit` | |
| A4 | `per_mote` tính khi nào | Khi **nhặt** (khớp ví dụ snapshot: carried 2 → score 20) | |
| A5 | Xung sáng "tốn ánh sáng" | Tốn `pulse_cost` (=1) đom đóm đang mang; không đủ hoặc đang hồi chiêu thì không có gì xảy ra (không event). Pulse hợp lệ luôn phát event `pulse`, kể cả `stunned_ids: []` | Đom đóm là "ánh sáng" duy nhất Mây có |
| A6 | Pulse tác động | Mọi Bóng Mực trong `pulse_radius` (kể cả đang choáng: làm mới thời gian choáng) → `stunned` `pulse_stun_s`, bị đẩy `pulse_push_m` ra xa người chơi theo XZ; mỗi con +`per_stun` | |
| A7 | Thời gian choáng | Choáng từ tick bị pulse, trạng thái `stunned` hiện ở đúng `pulse_stun_s × 60` snapshot tick liên tiếp, rồi về `chase` | |
| A8 | Bị chạm | Bóng Mực không choáng trong `shade_hit_radius` → mất 1 flame, rơi `floor(carried × hit_drop_ratio)` đom đóm (biến mất, không rơi xuống đất), bất tử `invuln_s`. Tối đa 1 lần chạm mỗi tick | Rơi xuống đất sẽ làm đổi `motes_active` khó đoán |
| A9 | `safe_radius` | Chỉ áp cho **đèn đã sáng** ("Bóng Mực sợ đèn"; đèn tắt không có ánh sáng). Bóng Mực bị đẩy ra biên `safe_radius + 0.001`; người chơi đứng trong vòng này không bị chạm | |
| A10 | Điểm thời gian/lửa còn lại | Chỉ cộng **khi thắng**: `per_second_left × floor(time_left_s)` + `per_flame_left × flames` | Thua thì không có "còn lại" để thưởng |
| A11 | Rơi khỏi đảo | Không có: `fall_enabled=false`, đảo bán kính 40 m có biên vô hình | Giảm phạm vi |
| A12 | Vị trí đèn | L1..L5 trên vòng tròn bán kính 25 m, L1 tại (0,0,25), mỗi đèn cách nhau 72° | Khớp ví dụ scenario |
| A13 | Sinh ngẫu nhiên | 30 đom đóm ban đầu (bán kính 4–37 m), mỗi 4 s sinh thêm nếu < 30; 2 Bóng Mực ban đầu ở bán kính 35 m (y=1), mỗi 25 s thêm 1 con (tối đa 6), phát `shade_spawned`. Bóng Mực ban đầu không phát event (là phần dựng màn) | |
| A14 | Thứ tự trong một tick | Nút → bộ đếm (bất tử, hồi chiêu, choáng) → di chuyển → nhảy → nhặt → nạp đèn (có thể thắng) → pulse → Bóng Mực di chuyển → va chạm (có thể thua) → bình minh → sinh thêm | Cố định để tất định |
| A15 | `move` ngoài [-1, 1] | Kẹp về [-1, 1], không coi là lỗi định dạng | |
| A16 | Mã thoát | Sai định dạng hoặc không đọc được file scenario/inputs → 2; thiếu/sai tham số dòng lệnh → 1 | |
| A17 | Snapshot | Chỉ ghi ở tick chia hết cho `--snapshot-every` (không thêm snapshot ở tick kết thúc); có thêm mảng `motes` (khuyến nghị) | |
| A18 | `shade.pos` y | Giữ nguyên y từ scenario; Bóng Mực tự sinh ở y = 1 | Khoảng cách chỉ tính theo XZ |

### Bộ số tuning (đã khai trong `game.contract.json`)

`player_speed 6` (nhanh hơn Bóng Mực `3.5`, chạy thoát được) · `carry_capacity 10` · `lantern_cost 5` (25 đom đóm cho 5 đèn, có 30 + sinh thêm) ·
`pickup_radius 1.5` · `interact_radius 3` · `pulse_cost 1` · `pulse_radius 6` · `night1_duration_s 300` · `flames 3` · `invuln_s 1.5` ·
`hit_drop_ratio 0.5` · `pulse_stun_s 3` · `pulse_push_m 4` · `pulse_cooldown_s 1` · `safe_radius 5` · `shade_hit_radius 1`.

---

## Phase 2 (Ticket-02 "Ba hòn đảo", Contract v1.1)

### Ticket thay thế giả định nào của Phase 1 (đổi hướng thiết kế)

Ticket-02 chuẩn hóa toàn bộ số liệu, nên mọi số tự chọn ở Phase 1 bị thay. Thiết kế giữ nguyên (core thuần + headless + render chỉ đọc state),
nhưng `sim.ts` được viết lại theo **thứ tự 12 bước bắt buộc** và thắng/thua chuyển xuống cuối tick.

| Phase 1 | Thay bằng (Ticket-02) | Test cũ bị ảnh hưởng → xử lý |
|---|---|---|
| A4 `per_mote` khi nhặt | +10 mỗi đom đóm **nạp** | `01_pickup`, `12_carry_capacity`: sửa điểm kỳ vọng thành 0 khi nhặt |
| A5 pulse tốn 1, r=6 XZ, cd 1 s | tốn 3, r=5 **3D** từ chân+0.8 m, cd 3 s | `05`, `06_pulse_edge_cost` → `06_pulse_edge_cooldown_cost` (viết lại) |
| A6/A7 choáng 180, đẩy 4 m ngay | choáng 120, đẩy 4 m trong 15 tick, +5 điểm | `05_pulse_stun` sửa vị trí theo tick |
| A8 đom đóm rơi biến mất | rơi ra vành 1.5–2.5 m, ttl 480, nhặt lại được; bóng recoil 2 m/60 tick | `07_hit_no_flames` → `07_hit_recoil_no_flames` (viết lại, tick 31/121/211) |
| A9 đứng trong vùng an toàn thì không bị chạm; r=5 | r=6, chỉ chặn bóng ở mép; bóng ở trong lúc đèn vừa thắp bị đẩy ra ≤ 30 tick, vô hại | bỏ luật miễn nhiễm; `09_safe_radius` → `09_safe_radius_block` + thêm `09b_safe_radius_evict` |
| A10 thưởng giây ×1 | ×2 | `04_win_all_lit`: 549 → 948 |
| A11 không rơi | rơi khi Y < −10 | thêm `15_fall_respawn`, `15b_fall_last_flame` |
| A12 vị trí đèn tự tính | tọa độ chuẩn (L2 = (23.8, 0, 7.7)...) | không test nào phụ thuộc |
| A13 30 đom đóm, 2 bóng từ tick 0 | 20 đom đóm ở điểm chuẩn, +1 mỗi 240 tick; bóng 2 con ở tick 300 rồi mỗi 480 tick, trạng thái `spawning` | `13_random_idle` → `13_night1_random_schedule` (viết lại) |
| A14 thứ tự tick, thắng ngay khi thắp | thứ tự 12 bước; xét thắng/thua cuối tick | `04` vẫn đạt (thắng ở cùng tick) |
| interact 3 m, pickup 1.5 m, cost 5 | 2 m, 1.0 m (+ chênh cao ≤ 1.5), cost 10, hòa thì id nhỏ | `02`, `03_partial_deposit` → `03_partial_tiebreak` |

### Tiêu chí nghiệm thu cho từng mục Phần 3 (và các mục chuẩn hóa mới)

| ID | Mục | Tiêu chí kiểm chứng được | Scenario / bằng chứng |
|---|---|---|---|
| P2-1 | Lướt | 14 m/s × 12 tick = 2.8 m; hướng di chuyển, đứng yên thì hướng mặt; hồi chiêu 90 tick từ lúc bắt đầu; trên không giữ độ cao; event `dash` | `14_dash`, `14b_dash_air_height` |
| P2-2 | Rơi khỏi đảo | Y < −10: −1 lửa, mất hết đom đóm (`lost`), chờ 60 tick, hồi sinh ở xuất phát, bất tử 90; hết lửa thì thua ngay | `15_fall_respawn`, `15b_fall_last_flame` |
| P2-3 | Tạm dừng | `pause` false→true: event `paused`, tick tăng nhưng sim_tick/thời gian/vị trí đứng yên, snapshot `state: "paused"`; nhấn lại → `resumed` | `16_pause`; bản thường: Esc/P mở menu Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |
| P2-4 | Bùa Gió | Nhặt như đom đóm → `charm_picked {charm_ticks: 600}`; 7.2 m/s; lướt không hồi chiêu (nhấn khi đang lướt bị bỏ qua); xuất hiện lại sau 2700 tick | `17_charm` |
| P2-5 | Gió Lạc | idle → chase khi mang ≥ 5 và ≤ 15 m; chạm 1.2 m cướp min(3, n) → flee 240 tick → removed; Tỏa Sáng: chase → flee không cướp, flee có đồ → thả lại (`drifter_drop`), biến mất sau 120 tick; lịch tick 1200, 2400, tối đa 2 | `18_drifter_steal`, `19_drifter_pulse`, `23_night2_drifter_schedule` |
| P2-6 | Đêm 2 Đảo Cau | 2 đảo r=28 + cầu tre; bục nhảy vy 14, ngang 24 m/s về tâm đảo kia, bay ≈ 1.4 s, đáp trong đảo đích; 6 đèn | `20_night2_jump_pad`, ảnh `night2.png` |
| P2-7 | Đêm 3 Đảo Chuông | 3 tầng, mép là vách đứng, 2 dốc 30°/150°, tháp không leo được, bục (0,3,13); 7 đèn; bóng 4.5 m/s | `21_night3_cliff_ramp`, `21b_night3_ramp`, ảnh `night3*.png` |
| P2-8 | Gió mạnh | Mỗi 30 s một cơn 5 s, hướng ngẫu nhiên, đẩy 2 m/s; báo trước 2 s bằng lá bay + âm thanh | `22_night3_wind`; render: lá bay khi còn ≤ 120 tick |
| P2-9 | Chuỗi 3 Đêm | Menu → giới thiệu (tên đảo + lời Ông Đăng) → chơi → kết quả → Đêm kế; thắng Đêm 3 → Bình Minh + tổng điểm; thua → chơi lại Đêm đó | chơi thử thủ công, ảnh `menu.png` |
| P2-10 | Cài đặt | Âm lượng + độ nhạy chuột, lưu localStorage | `src/render/settings.ts`, chơi thử |
| P2-11 | Âm thanh | Nhạc nền + SFX cho nhặt, thắp, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, bóng xuất hiện, đếm ngược 10 s | `src/render/audio.ts` (WebAudio), chơi thử |
| P2-12 | HUD | Lửa trên trái, đồng hồ trên giữa (đỏ + nhấp nháy ≤ 30 s), đèn k/n + điểm trên phải, thanh 10 ô dưới giữa, hồi chiêu Lướt/Tỏa Sáng dưới phải, "E — Nạp ánh sáng (x/10)", mũi tên tới đèn gần nhất ngoài màn hình | ảnh `night*.png` |
| P2-13 | Bảng màu + ánh sáng | Màu đúng bảng chuẩn (`PAL` trong `world.ts`); cường độ môi trường = 0.15 + 0.55 × tỉ lệ đèn sáng | `src/render/world.ts` |
| P2-14 | Contract v1.1 | `--night 1..3`; snapshot có `night`, `wind`, player `vel/grounded/invuln/dash_cd_s/pulse_cd_s/charm_s`, mảng `motes/drifters/charms`; event mới; trạng thái bóng đúng 5 tên | `checkOutput` kiểm cấu trúc cho mọi scenario |
| P2-15 | Hiệu năng | Headless 1 Đêm đầy đủ ≤ 30 s; bản thường ≥ 30 FPS ở 1280×720 | `headless-report.md` (cột thời gian), `fps.json` |

### Giả định mới cho chỗ ticket chưa nói

| # | Chỗ mơ hồ | Giả định |
|---|---|---|
| B1 | Điểm xuất phát Đêm 3 | (0, 0, −30) trên tầng 0, quay mặt +Z. (0,0,0) nằm trong tháp chuông. Đêm 2: (0,0,0) tâm đảo A |
| B2 | Thời gian trạng thái `spawning` | 60 tick, đứng yên, vô hại, sau đó `chase` nếu ≤ 12 m, ngược lại `wander` |
| B3 | `wander` | Lượn 1.5 m/s quanh điểm sinh (bán kính 6 m), điểm đích ngẫu nhiên theo seed. Gió Lạc idle lượn 2 m/s cùng cách |
| B4 | Bóng Mực trong scenario không ghi `state` | `chase` nếu ≤ 12 m tới Mây, ngược lại `wander` |
| B5 | Hết choáng / hết recoil | Về `chase` nếu ≤ 18 m (bán kính bỏ đuổi), ngược lại `wander` |
| B6 | Recoil 2 m / 60 tick | Bóng lùi đúng 60 tick × 2/60 m bắt đầu từ tick sau cú chạm; trạng thái `recoil` hiện 61 snapshot tick |
| B7 | Snapshot `player.invuln` | boolean (đang bất tử hay không); các trường `_s` là giây làm tròn 3 chữ số |
| B8 | `night_start` | Ghi ngay sau snapshot tick 0, `tick: 0` |
| B9 | `score` khi thua trong headless | Giữ điểm của Đêm đang chơi (dòng end vẫn ghi điểm đã kiếm). "Tổng điểm game" (chỉ cộng Đêm đã thắng) áp dụng ở bản thường |
| B10 | `motes[].ttl_s` đom đóm random | `null` |
| B11 | Bóng Mực / Gió Lạc theo địa hình | Bay ở độ cao cố định trên mặt đất (lấy từ vị trí sinh), đi qua vách và biển mây; bị chặn bởi tháp chuông và vùng an toàn |
| B12 | Chạm Gió Lạc | Chỉ Gió Lạc ở `chase` và Mây đang mang > 0 mới cướp; Gió Lạc `removed` vẫn nằm trong mảng `drifters` |
| B13 | Đi lên dốc / bậc | Bậc ≤ 0.35 m đi lên được; cao hơn là vách (chặn ngang). Nhảy 7 m/s chỉ cao 1.225 m nên không lên tầng được |
| B14 | Gió | Cơn gió bắt đầu ở sim_tick 1800k (30 s, 60 s...), `dir_deg` nguyên 0–359 theo seed, đo từ +X; báo trước 120 tick chỉ ở phần hiển thị |
| B15 | Tạm dừng ở bản thường | Ngừng gọi `step` (logic dừng hoàn toàn); input `pause` của contract dùng cho headless |
| B16 | Điểm sinh Gió Lạc ("điểm sương") | Dùng chung danh sách điểm sinh Bóng Mực của Đêm đó |
