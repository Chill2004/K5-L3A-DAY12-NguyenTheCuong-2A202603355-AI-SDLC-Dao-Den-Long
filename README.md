# Đảo Đèn Lồng

> **Video demo:** _(sẽ thêm ở Phase 4, đính kèm Release `v1.0.0`)_
> Bài Lab Day 12 AI SDLC: Nguyễn Thế Cường, 2A202603355. Đề bài: [docs/lab/](docs/lab/README.md).

Game 3D góc nhìn thứ ba: Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại các Đèn Lồng Lớn trên **ba hòn đảo**
(Đảo Bến, Đảo Cau, Đảo Chuông) và né Bóng Mực, Gió Lạc trong sương đen.
Viết bằng TypeScript + Three.js; logic game tách riêng nên chạy được headless theo **Test Contract v1.1**.

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
| Shift | Lướt (14 m/s trong 0.2 s, hồi chiêu 1.5 s) |
| E | Nạp đom đóm vào Đèn Lồng chưa sáng ở gần (≤ 2 m) |
| F | Tỏa Sáng: tốn 3 đom đóm, làm choáng và đẩy lùi Bóng Mực trong 5 m |
| Kéo chuột / ← → | Xoay camera |
| Esc / P | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt (âm lượng, độ nhạy chuột) / Về menu |

## Luật chơi (số chuẩn Ticket-02)

- **3 Đêm** nối tiếp: Đảo Bến (5 đèn, 300 s), Đảo Cau (6 đèn, 330 s, hai đảo nối cầu tre, có bục nhảy), Đảo Chuông (7 đèn, 360 s, 3 tầng, dốc, bục nhảy, gió mạnh).
  Thắng Đêm 3 thì tới màn Bình Minh với tổng điểm; thua thì chơi lại Đêm đó.
- Đom đóm nhặt tự động (≤ 1 m), mang tối đa 10. Mỗi đèn cần **10 đom đóm**, nạp nhiều lần được.
- Bóng Mực phát hiện trong 12 m, bỏ đuổi khi xa hơn 18 m. Chạm vào: −1 Ngọn Lửa (có 3), rơi một nửa số đom đóm xuống đất (nhặt lại được trong 8 s), bất tử 1.5 s.
- Đèn đã sáng tạo vùng an toàn 6 m mà Bóng Mực không vào được.
- **Gió Lạc** (Đêm 2, 3) đuổi khi bạn mang ≥ 5 đom đóm và cướp 3 con; Tỏa Sáng trúng nó thì nó thả lại.
- **Bùa Gió** (lá bùa đỏ): 10 s chạy nhanh 7.2 m/s và lướt không hồi chiêu.
- Rơi khỏi đảo: −1 Ngọn Lửa, mất hết đom đóm, hồi sinh ở điểm xuất phát.

| Điểm | |
|---|---:|
| Mỗi đom đóm nạp vào đèn | +10 |
| Mỗi đèn thắp | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng | +5 |
| Khi thắng Đêm: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng Đêm: mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm game là tổng điểm các Đêm đã thắng.

## Chế độ headless (Test Contract v1.1)

Khai báo ở [`game.contract.json`](game.contract.json). Sau `npm ci && npm run build`:

```bash
node build/headless/cli.js --seed 1 --night 2 --ticks 600 --out out.jsonl \
  [--scenario scenarios/17_charm/scenario.json] [--inputs scenarios/17_charm/inputs.json] [--snapshot-every 10]
```

60 tick/giây cố định, không cần cửa sổ; một Đêm đầy đủ chạy khoảng 0.3 s. Mã thoát: `0` ổn, `2` file scenario/inputs sai định dạng, `1` lỗi tham số.
Hằng số chuẩn ngoài tuning nằm trong [`src/core/constants.ts`](src/core/constants.ts), bản đồ chuẩn trong [`src/core/maps.ts`](src/core/maps.ts).
Giả định cho chỗ ticket chưa nói (điểm xuất phát Đêm 3, trạng thái `spawning`...) ở [assumptions.md](docs/notes/assumptions.md).

## Test và kiểm chứng

```bash
npm test                     # unit + 24 scenario headless + tất định (Vitest)
npm run verify -- phase-2    # chạy CLI thật cho mọi scenario 2 lần, mã thoát, hiệu năng; ghi docs/proof/phase-2/
npm run fps                  # (cần `npx vite preview --port 4173`) đo FPS 3 Đêm ở 1280×720 bằng Chrome
```

CI (GitHub Actions) chạy build, test và verify trên Ubuntu và macOS mỗi lần push.
Bằng chứng: [Phase 1](docs/proof/phase-1/README.md) · [Phase 2](docs/proof/phase-2/README.md). Nhật ký AI: [ai-log.md](docs/notes/ai-log.md).

## Cấu trúc

```text
src/core/       logic game thuần (tick 60 Hz, RNG có seed, 3 bản đồ chuẩn), dùng chung cho headless và đồ họa
src/headless/   CLI, kiểm tra đầu vào, ghi JSONL
src/render/     Three.js (world.ts), luồng 3 Đêm + HUD (main.ts), âm thanh WebAudio, cài đặt
scenarios/      scenario headless (sinh bởi scripts/gen-scenarios.mjs; kỳ vọng tính tay)
tests/          Vitest
scripts/        verify.mjs, gen-scenarios.mjs, measure-fps.mjs
CLAUDE.md, .claude/   harness AI: hướng dẫn, hook Stop chặn khi test đỏ, skill verify
```

## Sáng tạo của tôi

Tất cả chỉ nằm ở phần hiển thị (`src/render/`), không có trong core, nên output headless không đổi: `npm test` vẫn đạt toàn bộ scenario.

- **Đom đóm bay quanh Mây:** số đom đóm đang mang hiện thành các đốm sáng bay vòng quanh người Mây.
- **Vòng sáng an toàn:** đèn đã sáng có vòng quầng trên mặt đất đúng bằng bán kính vùng an toàn (6 m).
- **Lời Ông Đăng** riêng cho từng Đêm ở màn giới thiệu; nhạc nền ngũ cung tự tổng hợp bằng WebAudio.
- Đom đóm bị rơi nhấp nháy trong 2 s cuối trước khi biến mất.

Ảnh: [docs/proof/phase-2/img/](docs/proof/phase-2/img/).

## Giấy phép

Mã nguồn: [MIT](LICENSE). Nguồn thư viện và công cụ: [CREDITS.md](CREDITS.md).
