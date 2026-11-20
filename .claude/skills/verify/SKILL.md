---
name: verify
description: Chạy kiểm chứng đầy đủ cho game (unit test, scenario headless qua CLI thật, tất định, mã thoát) và lưu bằng chứng vào docs/proof/phase-N/. Dùng trước khi báo "xong", trước khi gắn tag phase, hoặc sau khi đổi luật game.
---

# Skill: verify

1. `npm test`: phải xanh. Nếu đỏ: sửa code, KHÔNG sửa `expect.json` để lách.
2. `npm run verify -- phase-N` (N = phase hiện tại): chạy `headless_cmd` trong `game.contract.json`
   với mọi `scenarios/*/`, chạy 2 lần so byte-by-byte, kiểm mã thoát 2 khi đầu vào sai.
   Kết quả: `docs/proof/phase-N/headless-report.md` + `docs/proof/phase-N/runs/*.jsonl`.
3. Mở `headless-report.md`, đối chiếu từng dòng với bảng truy vết trong `docs/proof/phase-N/README.md`;
   cập nhật cột Kết quả (ĐẠT / CHƯA ĐẠT + lý do).
4. Thêm yêu cầu mới → thêm một lời gọi `S(...)` trong `scripts/gen-scenarios.mjs` rồi `npm run gen:scenarios`
   (sinh `scenarios/NN_ten/{scenario,inputs,expect}.json`). `expect.json`: `requirement`, `seed`, `night` (1–3, mặc định 1),
   `ticks`, `snapshot_every`, `expect`: `end`, `events` (dãy con có thứ tự), `event_count`, `no_events`,
   `snapshots[{tick, match}]`, toán tử `$gt/$gte/$lt/$lte`.
   Giá trị mong đợi phải **tính tay từ spec + tuning**, không chép từ output. Tránh điểm đúng biên (xem CLAUDE.md).
5. Phase có yêu cầu FPS: `npx vite preview --port 4173` rồi `OUT=docs/proof/phase-N/fps.json npm run fps`.
   Ảnh: Chrome headless `--screenshot` với `?autostart&night=N` (thêm `&lit=K` để thắp sẵn K đèn).
6. Báo cáo cho người dùng: số đạt/chưa đạt, đường dẫn bằng chứng.
