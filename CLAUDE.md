# CLAUDE.md: Đảo Đèn Lồng

Game 3D (TypeScript + Three.js + Vite) có chế độ headless theo **Test Contract v1.1** (Ticket-02; đề ở `docs/lab/`).

## Lệnh
- Cài: `npm ci` · Build: `npm run build` (tsc headless → `build/`, Vite web → `dist/`)
- Test: `npm test` (Vitest: unit + mọi scenario trong `scenarios/` + tất định)
- Kiểm chứng E2E + lưu bằng chứng: `npm run verify -- phase-N` → `docs/proof/phase-N/` (skill `verify`)
- Sinh lại scenario: `npm run gen:scenarios` (sửa `scripts/gen-scenarios.mjs`, KHÔNG sửa tay JSON)
- Đo FPS: `npx vite preview --port 4173` rồi `npm run fps` (Chrome, 1280×720, 3 Đêm)
- Headless: `node build/headless/cli.js --seed 1 --night 1|2|3 --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`
- Chơi: `npm run dev` · `?autostart&night=N` vào thẳng Đêm N · `?fps` hiện FPS

## Kiến trúc (bắt buộc giữ)
- `src/core/`: logic thuần, KHÔNG import DOM/Three.js, KHÔNG `Math.random`/`Date` (dùng `Rng` có seed).
  `maps.ts` = bản đồ chuẩn 3 Đêm; `constants.ts` = hằng số chuẩn Ticket-02 (GĐ = giả định riêng); `sim.ts` = thứ tự 12 bước/tick của Ticket-02.
- `src/headless/`: CLI + validate (sai định dạng → `InputError` → exit 2) + runner JSONL.
- `src/render/`: chỉ đọc state và gửi `Input`; tạm dừng ở bản thường = ngừng gọi `step`.
- Tuning đọc từ `game.contract.json`; số chuẩn ngoài tuning nằm ở `constants.ts`, không rải số ở chỗ khác.
- Phần sáng tạo thêm chỉ ở `src/render/` (không đổi output headless).

## Quy tắc làm việc
- Đổi luật → sửa/thêm scenario trong `scripts/gen-scenarios.mjs` (kỳ vọng tính tay, ghi cách tính trong comment).
- Tránh đặt kỳ vọng đúng biên số thực (vd. x = 40.0, r = 8.0): lệch 1 tick do làm tròn. Dịch điểm xuất phát 0.05 m.
- KHÔNG sửa kỳ vọng chỉ để test qua; test bị yêu cầu mới thay thế thì ghi lý do trong `docs/notes/assumptions.md`.
- Giả định mới → `docs/notes/assumptions.md`; lỗi của AI → `docs/notes/ai-log.md`.
- Commit nhỏ, mỗi commit một việc. Hook Stop chặn kết thúc khi `npm test` đỏ.
