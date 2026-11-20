# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Phase 4, đính kèm Release `v1.0.0`)_
> Bài Lab Day 12 AI SDLC: Nguyễn Thế Cường, 2A202603355. Đề bài: [docs/lab/](docs/lab/README.md).

Game 3D góc nhìn thứ ba: Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại 5 Đèn Lồng Lớn trên Đảo Bến và né Bóng Mực trong sương đen.
Viết bằng TypeScript + Three.js; logic game tách riêng nên chạy được headless theo **Test Contract v1.0**.

## Cài đặt và chạy (macOS / Linux / Windows, cần Node.js ≥ 20)

```bash
git clone https://github.com/Chill2004/K5-L3A-DAY12-NguyenTheCuong-2A202603355-AI-SDLC-Dao-Den-Long.git && cd K5-L3A-DAY12-NguyenTheCuong-2A202603355-AI-SDLC-Dao-Den-Long
npm ci && npm run build
npm run preview          # mở http://localhost:4173
```

## Điều khiển

| Phím | Hành động |
|---|---|
| W A S D | Di chuyển (theo hướng camera) |
| Space | Nhảy |
| E | Nạp đom đóm vào Đèn Lồng chưa sáng ở gần |
| F | Xung sáng: tốn 1 đom đóm, làm choáng và đẩy lùi Bóng Mực xung quanh |
| Kéo chuột / ← → | Xoay camera |
| R | Chơi lại · Enter: bắt đầu |

## Luật chơi và cách tính điểm

- Đom đóm được **nhặt tự động** khi đi tới gần (≤ 1.5 m), mang tối đa 10 con.
- Mỗi Đèn Lồng cần **5 đom đóm**; đứng gần (≤ 3 m) và bấm E để nạp. Thắp đủ 5 đèn thì **thắng**.
- Bóng Mực đuổi theo; chạm vào thì mất 1 lửa (có 3 lửa), rơi mất một nửa số đom đóm đang mang, rồi được bất tử 1.5 s. Hết lửa thì **thua**.
- Bóng Mực không vào được vòng 5 m quanh **đèn đã sáng**. Đứng trong vòng đó là an toàn.
- Hết 5 phút (bình minh) mà chưa thắp đủ đèn thì **thua**.

| Hành động | Điểm |
|---|---:|
| Nhặt 1 đom đóm | +10 |
| Thắp 1 đèn | +100 |
| Làm choáng 1 Bóng Mực bằng xung sáng | +25 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +1 |
| Khi thắng: mỗi lửa còn lại | +50 |

## Chế độ headless (Test Contract v1.0)

Khai báo ở [`game.contract.json`](game.contract.json). Sau `npm ci && npm run build`:

```bash
node build/headless/cli.js --seed 1 --night 1 --ticks 600 --out out.jsonl \
  [--scenario scenarios/05_pulse_stun/scenario.json] [--inputs scenarios/05_pulse_stun/inputs.json] [--snapshot-every 10]
```

60 tick/giây cố định, không cần cửa sổ. Mã thoát: `0` ổn, `2` file scenario/inputs sai định dạng, `1` lỗi tham số.
Khái niệm có trong contract nhưng không có trong game: `fall_enabled = false` (đảo có biên vô hình, không rơi được, nên không bao giờ có `player_hit` với `by: "fall"`). `dash` không có (input `dash` bị bỏ qua).
Các hằng số ngoài contract (bán kính đảo 40 m, vị trí đèn, nhịp sinh đom đóm/Bóng Mực...) nằm trong [`src/core/constants.ts`](src/core/constants.ts).

## Test và kiểm chứng

```bash
npm test                 # unit + 13 scenario headless + tất định (Vitest)
npm run verify           # chạy CLI thật cho mọi scenario 2 lần, kiểm mã thoát, ghi docs/proof/phase-1/
```

CI (GitHub Actions) chạy build, test và verify trên Ubuntu và macOS mỗi lần push.
Bằng chứng từng phase: [docs/proof/](docs/proof/phase-1/README.md). Giả định: [docs/notes/assumptions.md](docs/notes/assumptions.md). Nhật ký AI: [docs/notes/ai-log.md](docs/notes/ai-log.md).

## Cấu trúc

```text
src/core/       logic game thuần (tick 60 Hz, RNG có seed), dùng chung cho headless và đồ họa
src/headless/   CLI, kiểm tra đầu vào, ghi JSONL
src/render/     Three.js: chỉ vẽ state và đọc bàn phím
scenarios/      scenario headless: scenario.json, inputs.json, expect.json (tính tay từ spec)
tests/          Vitest
scripts/        verify.mjs (kiểm chứng E2E + sinh báo cáo bằng chứng)
CLAUDE.md, .claude/   harness AI: hướng dẫn, hook Stop chặn khi test đỏ, skill verify
```

## Sáng tạo của tôi

- **Đom đóm bay quanh Mây:** số đom đóm đang mang hiện thành các đốm sáng bay vòng quanh người Mây, nhìn là biết mình đang mang bao nhiêu.
  Chỉ có ở phần hiển thị (`src/render/main.ts`), không có trong core, nên output headless không đổi: `npm test` vẫn đạt toàn bộ scenario.
- **Vòng sáng an toàn:** đèn đã sáng có vòng quầng vàng trên mặt đất đúng bằng `safe_radius`, giúp người chơi thấy chỗ trú. Bầu trời và sương chuyển ấm dần theo số đèn đã sáng.
  Ảnh: [docs/proof/phase-1/img/lanterns-lit.png](docs/proof/phase-1/img/lanterns-lit.png).

## Giấy phép

Mã nguồn: [MIT](LICENSE). Nguồn thư viện và công cụ: [CREDITS.md](CREDITS.md).
