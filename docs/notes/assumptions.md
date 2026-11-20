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
