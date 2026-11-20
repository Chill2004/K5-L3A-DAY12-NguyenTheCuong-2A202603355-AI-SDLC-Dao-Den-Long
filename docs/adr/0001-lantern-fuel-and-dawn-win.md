# ADR 0001: Mô hình dầu đèn và luật thắng lúc bình minh (Ticket-03)

- **Trạng thái:** Chấp nhận (Phase 3, Contract v1.2)
- **Bối cảnh:** Ticket-03 "Đèn cạn dầu" đổi mục tiêu từ "thắp hết đèn" sang "giữ đảo sáng tới bình minh". Ticket thay 4 luật cũ: đèn sáng là xong, vùng an toàn tuyệt đối, thắng ngay khi đủ đèn, và công thức điểm.

## Quyết định

### 1. Trạng thái đèn: từ 2 trạng thái thành vòng đời có dầu

Trước đây: `lit: boolean` và `deposited`, một chiều (tắt → sáng).
Bây giờ mỗi đèn có `lit`, `deposited`, `fuel`, `everLit`, `relitCount`, đi theo vòng:

```
chưa sáng (cost 10) --nạp đủ--> sáng, fuel=100 --hao 1/s + hút 5/s mỗi bóng--> fuel<=0 --> tắt (deposited=0, everLit=true)
      ^                                  |  ^                                                   |
      |                                  |  +--châm dầu: +10/đom đóm, tối đa 100                  |
      +----------------------------------+------------- thắp lại (cost 5, +40 điểm) <--------------+
```

- **Dầu lưu bằng số nguyên đơn vị 1/60** (100 dầu = 6000). Hao = 1 đơn vị/tick, hút = 5 đơn vị/tick, châm = 600/đom đóm. Như vậy không có sai số số thực khi so `fuel <= 0` hay `fuel >= 30`; chỉ làm tròn khi xuất ra (1 chữ số thập phân).
- Hao và hút chạy ở **bước 2** (bộ đếm); đèn hết dầu tắt **ngay sau bước 2**, trước khi Mây di chuyển và tương tác.
- `hasSafeZone(l) = lit && fuel >= 30`. Mọi chỗ dùng vùng an toàn (chặn bóng, điểm sinh hợp lệ, đẩy bóng ra) đi qua một hàm này. Đúng 30 vẫn còn vùng.
- Chọn đèn khi tương tác: chỉ xét đèn chưa sáng hoặc sáng nhưng `ceil((6000 − fuel)/600) > 0`; gần nhất, bằng nhau thì id nhỏ hơn.

### 2. Bóng Mực: thêm trạng thái `drain`

- `wander` không còn lượn quanh điểm sinh mà đi tới **đèn sáng có dầu < 30 gần nhất**; không có thì tới **đèn tắt gần nhất**; không có cả hai thì lượn như cũ.
- Tới ≤ 2 m đèn yếu → `drain` (đứng yên, hút). Rời `drain` khi: Mây ≤ 6 m → `chase`; trúng Tỏa Sáng → `stunned`; đèn tắt, được châm lên ≥ 30, hoặc cách > 2 m → `wander`.
- Hết choáng → `wander` (trước đây: `chase` nếu ≤ 18 m). Bóng `drain` không gây sát thương (chỉ `chase`/`wander` gây hit).
- Châm dầu làm đèn từ yếu thành ≥ 30 thì xử lý giống "đèn vừa thắp": đẩy bóng trong 6 m ra mép trong 30 tick, vô hại trong lúc đó. Dùng lại cơ chế `evictTicks` có sẵn.

### 3. Luật thắng

- Bỏ thắng sớm `all_lit`. Bước 11 (cuối tick): hết Ngọn Lửa → thua `no_flames` (luôn xét trước); hết giờ → thắng `dawn_survived` nếu số đèn đang sáng ≥ `ceil(0.6 × n)`, ngược lại thua `dawn`.
- Điểm bình minh (chỉ khi thắng): mỗi đèn đang sáng `50 + floor(fuel)`, mỗi Ngọn Lửa `50`. Bỏ thưởng thời gian (`per_second_left = 0`).

### 4. Sức chứa tăng dần

`capacity = min(20, 10 + 2 × successful_lights)`; `successful_lights` đếm cả thắp lại, không đếm đèn đặt sẵn bằng scenario.

## Hệ quả

- Test bị thay: `04_win_all_lit` bị xóa (luật bị thay), thay bằng `04_win_dawn_survived`, `04b_lose_dawn_below_threshold`, `04c_all_lit_no_early_end`. `02`, `03`, `16` cập nhật số (điểm, thời lượng Đêm). Chi tiết ở [CHANGELOG](../../CHANGELOG.md).
- Phần còn lại của thiết kế Phase 2 giữ nguyên: thứ tự 12 bước, headless, render chỉ đọc state.
- Rủi ro: luật "wander về đèn tắt gần nhất như trước" không có ở Ticket-02. Mình hiểu "như trước" là hành vi mặc định mới. Đã ghi thành giả định C3.
