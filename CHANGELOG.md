# Changelog

## [phase-4 / v1.0.0] Contract v1.3: hoàn thiện và phát hành (Ticket-04)

### Thêm
- **Benchmark** `bench_cmd` = `node scripts/bench.mjs`: Chrome cửa sổ 1280×720, vsync tắt, cảnh chuẩn 200 Bóng Mực + 100 đom đóm, camera bay vòng; ghi `bench.json` (avg/p1-low/p95/frames/load_ms...).
- **Soak** `soak_cmd` = `node --expose-gc --jitless build/headless/soak.js`: 10 Đêm liên tiếp, input ngẫu nhiên theo seed, đo RSS.
- **Bảng xếp hạng** top 10 lưu đĩa (`.data/leaderboard.json`), màn hình từ menu, nhập tên sau Bình Minh/khi thua (hỗ trợ tiếng Việt có dấu), `node scripts/serve.mjs --export-leaderboard out.json`.
- **Dễ tiếp cận:** đổi phím mọi hành động (báo trùng, khôi phục mặc định, lưu), phụ đề + mũi tên mép màn hình, giảm chuyển động, chữ ≥ 18 px và chữ lớn ×1.25.
- Unit test: leaderboard, thống kê bench, cảnh bench (`tests/phase4.test.ts`).

### Thay đổi
- `run_cmd` đổi từ `npm run preview` sang `node scripts/serve.mjs` (phục vụ `dist/` + API bảng xếp hạng).
- Render tối ưu cho iGPU: InstancedMesh cho Bóng Mực/đom đóm, vật liệu Lambert, tắt MSAA, pixelRatio = 1 (avg FPS bench 116 → 192, p1-low 29.7 → 38).
- `contract_version` 1.2 → 1.3 (thêm `bench_cmd`, `soak_cmd`; v1.0–v1.2 giữ nguyên, toàn bộ 34 scenario vẫn đạt).

## [phase-3] Contract v1.2: "Đèn cạn dầu" (Ticket-03)

### Breaking changes
- `contract_version` `1.1` → `1.2`. Thời lượng Đêm **300/330/360 → 240/270/300 s**.
- **Không còn thắng sớm**: `game_over.reason = "all_lit"` bị bỏ. Thắng là `dawn_survived` (còn sống khi hết giờ và đèn đang sáng ≥ ceil(0.6 × tổng)).
- **Điểm**: 10 → **5** mỗi đom đóm nạp (cả châm dầu); thắp lần đầu +100, **thắp lại +40**; Tỏa Sáng +5 (+15 nếu bóng đang `drain`); thắng: mỗi đèn sáng +50 + floor(fuel), mỗi Ngọn Lửa +50; **bỏ thưởng thời gian** (`per_second_left = 0`).
- Đèn sáng **có thể tắt** (hết dầu) và **nhận thêm đom đóm** (châm dầu). Thắp lại đèn đã từng sáng tốn 5.
- **Vùng an toàn chỉ còn ở đèn có dầu ≥ 30.**
- Bóng Mực thêm trạng thái **`drain`**; hết choáng thì về **`wander`** (trước: `chase` nếu ≤ 18 m); `wander` đi tới đèn yếu / đèn tắt gần nhất.
- Sức chứa không cố định 10: `10 + 2 × successful_lights`, tối đa 20.
- Snapshot: đèn thêm `fuel`, `ever_lit`, `relit_count`; player thêm `capacity`.
- Scenario: đèn thêm `fuel`, `ever_lit` (`lit: true` không có `fuel` → 100); player thêm `successful_lights`; shades thêm `target_lantern_id`.
- Sự kiện mới: `refuel`, `lantern_out`, `fuel_drain` (mỗi 60 tick đang hút); `lantern_lit` thêm `relight`.
- `tuning` thêm `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`.

### Test thay đổi
- **Xóa** `04_win_all_lit`: luật thắng sớm bị thay. Thay bằng `04_win_dawn_survived`, `04b_lose_dawn_below_threshold`, `04c_all_lit_no_early_end`.
- **Cập nhật** `02_deposit_light` (điểm 200 → 150, kiểm `relight: false`, `capacity 12`), `03_partial_tiebreak` (30 → 15), `16_pause` (`time_left_s` 299.833 → 239.833).
- **Thêm** `24_fuel_decay_out`, `25_refuel`, `26_relight`, `27_drain`, `28_pulse_drain_bonus`, `29_win_threshold_night2`, `29b_lose_threshold_night3`, `30_refuel_evict`.

### Khác
- Bản thường: thanh dầu trên đèn sáng, nhấp nháy 1 Hz khi dầu < 30; đèn tắt xẹp 20% và có vết rách; HUD hiện đang mang / sức chứa; câu nhắc "E — Châm dầu".
- Cài đặt **"Bảng màu dễ phân biệt"** (lưu): viền Bóng Mực #00B3FF, cảnh báo UI #FFFFFF kèm ⚠.
- Quyết định thiết kế: [docs/adr/0001-lantern-fuel-and-dawn-win.md](docs/adr/0001-lantern-fuel-and-dawn-win.md).

## [phase-2] Contract v1.1: "Ba hòn đảo" (Ticket-02)
- Số liệu chuẩn thay mọi số tự chọn; 3 Đêm; Lướt, rơi khỏi đảo, Gió Lạc, Bùa Gió, tạm dừng, gió mạnh; menu, âm thanh, HUD. Xem [docs/proof/phase-2](docs/proof/phase-2/README.md).

## [phase-1] Contract v1.0: PRD-0
- Đêm 1 chơi được, headless theo Test Contract v1.0.
