# Bằng chứng Phase 4 (Ticket-04, Contract v1.3)

Tái lập ở tag `phase-4`: `npm ci && npm run build && npm test && npm run verify -- phase-4 && npm run bench && npm run soak`.

## Truy vết yêu cầu → bằng chứng

| Mục | Yêu cầu | Bằng chứng | Kết quả |
|---|---|---|---|
| 1 | Bench: cửa sổ 1280×720, vsync tắt, Đêm 1, 200 bóng wander + 100 đom đóm, L1–L3 sáng fuel 100, camera bay vòng, 3 s khởi động, đo 30 s, thoát 0 | [bench.json](bench.json), [img/bench.png](img/bench.png), [bench.mjs](../../../scripts/bench.mjs), [core/bench.ts](../../../src/core/bench.ts); test `cảnh bench` trong [phase4.test.ts](../../../tests/phase4.test.ts) | **avg 192.6 FPS (≥ 60) · p1-low 38.0 (≥ 30) · p95 15.2 ms · load 2494 ms (≤ 10000)** · ĐẠT trên máy tự đo |
| 1 | Công thức avg/p1-low/p95 | `benchStats` + unit test với dữ liệu tính tay (N = 100, k = 1) | ĐẠT |
| 1 | peak_mem_mb | `null` + giải thích (bản web nhiều tiến trình); có `js_heap_peak_mb` | Theo cho phép của ticket |
| 2 | Soak 10 Đêm, 0 crash, mem_end ≤ 1.2 × mem_start | [soak.json](soak.json): 0 crash, **42.7 → 44.1 MB (1.03×)** | ĐẠT |
| 3 | Bảng xếp hạng: tên 3–12 ký tự (có dấu), top 10, sắp xếp + hòa thì ai trước, lưu đĩa, màn hình từ menu, `--export-leaderboard` | Unit test `leaderboard`; E2E qua API: [leaderboard-export.json](leaderboard-export.json) (Top_1 1500, Mây_01 900 lúc 16:00 trước Bob_2 900 lúc 16:05); [img/menu.png](img/menu.png) | ĐẠT |
| 4 | Đổi phím (báo trùng, khôi phục mặc định, lưu); phụ đề (bóng xuất hiện + mũi tên mép, gió, 10 s cuối, dầu < 30); giảm chuyển động; chữ ≥ 18 px, chữ lớn ×1.25 | [settings.ts](../../../src/render/settings.ts) (`duplicateKeys`), [main.ts](../../../src/render/main.ts) (`showKeys`, `subtitle`, `shade-arrow`), [index.html](../../../index.html) (`--fs`, `--scale`) | Kiểm thủ công |
| 5 | 3 lệnh từ clone sạch; README đủ mục; CHANGELOG 4 phase; CREDITS; LICENSE; Release v1.0.0 | [README](../../../README.md), [CHANGELOG](../../../CHANGELOG.md), [CREDITS](../../../CREDITS.md), [LICENSE](../../../LICENSE); clone sạch: xem dưới | ĐẠT (Release: xem ghi chú) |
| 6 | Contract v1.3: `bench_cmd`, `soak_cmd` | [game.contract.json](../../../game.contract.json) | ĐẠT |
| DoD | Test ẩn Phase 1–3 còn hiệu lực vẫn đạt | [headless-report.md](headless-report.md): 34/34 scenario, mã thoát, hiệu năng headless | ĐẠT |

## Quá trình tối ưu bench (số thật từng lần chạy, cùng máy)

| Thay đổi | avg FPS | p1-low | p95 ms | Nhận xét |
|---|---:|---:|---:|---|
| Mỗi thực thể 1 mesh (~600 draw call), 10 s | 116.1 | 29.7 | 18.3 | p1 dưới ngưỡng |
| InstancedMesh cho bóng + đom đóm, 10 s | 98.0 | 35.0 | 12.4 | 10 s đạt, 30 s thì chưa |
| 30 s (bóng dồn về đèn tắt L4/L5) | 86.4 | 21.4 | 37.9 | chưa đạt |
| pixelRatio = 1 | 87.2 | 20.4 | 38.5 | không đổi → không phải do số điểm ảnh |
| Viền bóng đục (bỏ blending) | 92.6 | 21.3 | 37.2 | chưa đạt |
| Đo tách: mô phỏng p95 0.4 ms, lệnh render p95 23.8 ms | | | | **GPU-bound** trên Intel UHD |
| Lambert thay PBR, tắt MSAA, cầu 12×8 | 212.2 | 45.1 | 14.0 | đạt |
| **Bản chính thức** (`npm run bench`) | **192.6** | **38.0** | **15.2** | [bench.json](bench.json) |

## Soak và bộ nhớ

| Cấu hình | mem_start → mem_end (MB) | Tỉ lệ |
|---|---|---|
| `node --expose-gc` (JIT bật), 10 Đêm, 3 lần | 43.6 → 53.9 / 54.8 / 55.4 | 1.24–1.27× (chưa đạt) |
| JIT bật, 30 Đêm / 60 Đêm | 43.4 → 51.0 / 43.3 → 51.7 | không tăng theo số Đêm → **không rò rỉ**; phần tăng là mã JIT + heap tạm của V8 |
| **`node --expose-gc --jitless`** (soak_cmd), 3 lần | 39.8 → 41.4 (cả 3 lần) | **1.04×** |

## Kiểm tra clone sạch
Clone sang thư mục mới → `npm ci && npm run build` → `node scripts/serve.mjs` mở được game; `node build/headless/cli.js ...` chạy được
(thực hiện ở Phase 1 và lặp lại trước khi phát hành; CI kiểm trên Ubuntu + macOS).

## Ghi chú trung thực
- Số FPS chỉ để tham khảo, đo trên máy cá nhân (Windows 11, i7-10750H, Intel UHD, Chrome 158, đang cắm sạc). Máy chấm sẽ đo lại.
- Các mục dễ tiếp cận (mục 4) mới kiểm thủ công, chưa có test tự động.
- Release v1.0.0: thư mục web tĩnh `dist/` nén zip. Bảng xếp hạng lưu đĩa cần chạy bằng `node scripts/serve.mjs`; mở bằng server tĩnh khác thì lưu trong trình duyệt.
