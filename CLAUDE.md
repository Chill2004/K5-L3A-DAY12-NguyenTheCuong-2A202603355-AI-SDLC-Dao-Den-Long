# CLAUDE.md: Đảo Đèn Lồng

Game 3D (TypeScript + Three.js + Vite) có chế độ headless theo Test Contract v1.0 (`docs/lab/`, lab board).

## Lệnh
- Cài: `npm ci` · Build: `npm run build` (tsc headless → `build/`, Vite web → `dist/`)
- Test: `npm test` (Vitest: unit + mọi scenario trong `scenarios/` + tất định)
- Kiểm chứng E2E + lưu bằng chứng: `npm run verify` → `docs/proof/phase-N/` (skill `verify`)
- Headless: `node build/headless/cli.js --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f] [--inputs f]`
- Chơi: `npm run dev` hoặc `npm start`

## Kiến trúc (bắt buộc giữ)
- `src/core/`: logic thuần, KHÔNG import DOM/Three.js, KHÔNG `Math.random`/`Date` (dùng `Rng` có seed).
- `src/headless/`: CLI + validate (sai định dạng → `InputError` → exit 2) + runner JSONL.
- `src/render/`: chỉ đọc state từ core và gửi `Input`; mọi luật game nằm trong core.
- Tuning đọc từ `game.contract.json`; KHÔNG hard-code số tuning ở chỗ khác.
- Phần sáng tạo thêm phải tắt hoặc không ảnh hưởng output headless.

## Quy tắc làm việc
- Đổi luật game → thêm/sửa scenario trong `scenarios/<tên>/` (expect.json tính tay từ spec, KHÔNG copy từ output).
- KHÔNG sửa expect.json chỉ để test qua; test cũ bị yêu cầu mới thay thì ghi lý do trong `docs/notes/assumptions.md`.
- Mọi giả định mới ghi vào `docs/notes/assumptions.md`; lỗi của AI ghi vào `docs/notes/ai-log.md`.
- Commit nhỏ, mỗi commit một việc. Hook Stop chặn kết thúc khi `npm test` đỏ.
