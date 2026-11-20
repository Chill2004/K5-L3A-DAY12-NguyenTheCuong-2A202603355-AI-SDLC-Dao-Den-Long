// Sinh scenarios/<tên>/{scenario,inputs,expect}.json. Kỳ vọng TÍNH TAY từ Ticket-02 + tuning, ghi cách tính trong "requirement".
// Dùng: node scripts/gen-scenarios.mjs   (ghi đè các thư mục cùng tên)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = 'scenarios';
const S = (name, scenario, inputs, spec) => {
  const d = join(root, name);
  mkdirSync(d, { recursive: true });
  if (scenario) writeFileSync(join(d, 'scenario.json'), JSON.stringify(scenario, null, 2) + '\n');
  if (inputs) writeFileSync(join(d, 'inputs.json'), JSON.stringify(inputs, null, 2) + '\n');
  writeFileSync(join(d, 'expect.json'), JSON.stringify(spec, null, 2) + '\n');
};
const quiet = { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [], drifters: [] };
const press = (k, at, release = at + 1) => [{ tick: at, [k]: true }, { tick: release, [k]: false }];
const range = (lo, hi) => ({ $gte: lo, $lte: hi });

// ===== Phase 1 (cập nhật theo số chuẩn Ticket-02) =====
// 6 m/s = 0.1 m/tick; pickup 1.0 -> mote z=5.05 nhặt khi z>=4.05 -> tick 41. Điểm cộng khi NẠP, không phải khi nhặt.
S('01_pickup', { ...quiet, player: { pos: [0, 0, 0], carried: 0, flames: 3 }, motes: [[0, 0, 5.05]] },
  { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 0 }] },
  { requirement: 'R2 nhặt trong pickup_radius 1.0 (tick 41); điểm chưa cộng khi nhặt', seed: 1, ticks: 60, snapshot_every: 10,
    expect: {
      events: [{ tick: 41, name: 'mote_picked', data: { carried: 1 } }],
      event_count: { mote_picked: 1 },
      snapshots: [
        { tick: 40, match: { score: 0, motes_active: 1, player: { pos: [0, 0, 4], carried: 0, vel: [0, 0, 6], grounded: true } } },
        { tick: 50, match: { score: 0, motes_active: 0, player: { pos: [0, 0, 5], carried: 1 } } }],
      end: { ticks: 60, state: 'playing', score: 0 } } });

// L1 (0,0,25), đứng (0,0,23): khoảng cách 2.0 = interact_radius (biên <= r). 10 x 10 + 100 = 200.
S('02_deposit_light', { ...quiet, player: { pos: [0, 0, 23], carried: 10 } },
  { frames: press('interact', 0) },
  { requirement: 'R3 nạp ở biên interact_radius 2.0; đủ 10 thì thắp lần đầu; điểm (Ticket-03) 10 x 5 + 100 = 150', seed: 1, ticks: 20, snapshot_every: 10,
    expect: {
      events: [
        { tick: 1, name: 'deposit', data: { lantern_id: 'L1', amount: 10, deposited: 10 } },
        { tick: 1, name: 'lantern_lit', data: { lantern_id: 'L1', relight: false } }],
      no_events: ['game_over'],
      snapshots: [{ tick: 10, match: { score: 150, player: { carried: 0, capacity: 12 },
        lanterns: [{ id: 'L1', lit: true, deposited: 10, ever_lit: true, relit_count: 0 }, { lit: false, fuel: 0 }, { lit: false }, { lit: false }, { lit: false }] } }],
      end: { ticks: 20, state: 'playing', score: 150 } } });

// Hai đèn cách đều 2 m: chọn id nhỏ hơn (L1). Nạp một phần 3 -> 4/10, điểm 30.
S('03_partial_tiebreak', { ...quiet, player: { pos: [0, 0, 0], carried: 3 },
  lanterns: [{ id: 'L1', pos: [0, 0, 2], deposited: 1 }, { id: 'L2', pos: [0, 0, -2] }] },
  { frames: press('interact', 0) },
  { requirement: 'R3 nạp một phần, đèn nhớ tiến độ; hai đèn cách đều thì chọn id nhỏ hơn', seed: 1, ticks: 30, snapshot_every: 10,
    expect: {
      events: [{ tick: 1, name: 'deposit', data: { lantern_id: 'L1', amount: 3, deposited: 4 } }],
      event_count: { deposit: 1, lantern_lit: 0 },
      snapshots: [{ tick: 10, match: { lanterns: [{ deposited: 4 }, { deposited: 0 }, {}, {}, {}] } }],
      end: { ticks: 30, state: 'playing', score: 15 } } });

// [Ticket-03 THAY THẾ 04_win_all_lit] Không còn thắng sớm. Bình minh: đèn sáng >= ceil(0.6 x n).
// time_left 1 s, L1-L3 sáng (fuel 100 -> 99 sau 60 tick): điểm = 3 x (50 + 99) + 3 x 50 = 597.
S('04_win_dawn_survived', { ...quiet, time_left_s: 1, lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true }, { id: 'L3', lit: true }] }, null,
  { requirement: 'T3 thắng khi sống tới bình minh và >= 3/5 đèn sáng; điểm 3 x (50 + floor(99)) + 3 x 50 = 597', seed: 1, ticks: 600, snapshot_every: 10,
    expect: {
      events: [{ tick: 60, name: 'game_over', data: { result: 'won', reason: 'dawn_survived' } }],
      snapshots: [{ tick: 0, match: { score: 0, player: { capacity: 10 }, lanterns: [{ lit: true, fuel: 100, ever_lit: true }, {}, {}, { lit: false }, {}] } }],
      end: { ticks: 60, state: 'won', score: 597 } } });
S('04b_lose_dawn_below_threshold', { ...quiet, time_left_s: 1, lanterns: [{ id: 'L1', lit: true }, { id: 'L2', lit: true }] }, null,
  { requirement: 'T3 hết giờ mà chỉ 2/5 đèn sáng (< 3) thì thua dawn', seed: 1, ticks: 600, snapshot_every: 10,
    expect: { events: [{ tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } }], end: { ticks: 60, state: 'lost', score: 0 } } });
S('04c_all_lit_no_early_end', { ...quiet, player: { pos: [0, 0, 23], carried: 10 },
  lanterns: [{ id: 'L2', lit: true }, { id: 'L3', lit: true }, { id: 'L4', lit: true }, { id: 'L5', lit: true }] },
  { frames: [{ tick: 0, interact: true }] },
  { requirement: 'T3 thắp đủ 5/5 đèn không kết thúc Đêm; sức chứa 10 + 2 x 1 = 12 (đèn đặt sẵn không tính)', seed: 1, ticks: 120, snapshot_every: 10,
    expect: {
      events: [{ tick: 1, name: 'lantern_lit', data: { lantern_id: 'L1', relight: false } }],
      no_events: ['game_over'],
      snapshots: [{ tick: 10, match: { player: { capacity: 12 } } }],
      end: { ticks: 120, state: 'playing', score: 150 } } });

// Tâm pulse (0,0.8,0); S1 tâm (4,1,0): 3D 4.005 <= 5. Đẩy 4/15 m/tick trong tick 1..15 -> x=8; choáng tick 1..120, tick 121 về chase.
// Hồi chiêu 180 tick đặt ở tick 1, giảm ở tick 2..10 -> 171 -> 2.85 s.
S('05_pulse_stun', { ...quiet, player: { pos: [0, 0, 0], carried: 3 }, shades: [{ pos: [4, 1, 0] }, { id: 'far', pos: [-30, 1, 0] }] },
  { frames: press('pulse', 0) },
  { requirement: 'R4 Tỏa Sáng: tốn 3, bán kính 5 m (3D), choáng 120 tick, đẩy 4 m trong 15 tick, +5 điểm, hồi chiêu 3 s', seed: 1, ticks: 200, snapshot_every: 10,
    expect: {
      events: [{ tick: 1, name: 'pulse', data: { stunned_ids: ['S1'] } }],
      snapshots: [
        { tick: 0, match: { shades: [{ id: 'S1', state: 'chase' }, { id: 'far', state: 'wander' }] } },
        { tick: 10, match: { score: 5, player: { carried: 0, pulse_cd_s: 2.85 }, shades: [{ id: 'S1', pos: [6.667, 1, 0], state: 'stunned' }, { id: 'far' }] } },
        { tick: 120, match: { shades: [{ id: 'S1', pos: [8, 1, 0], state: 'stunned' }, {}] } },
        { tick: 130, match: { shades: [{ id: 'S1', pos: [7.333, 1, 0], state: 'chase' }, {}] } }],
      end: { ticks: 200, state: 'playing', score: 5 } } });

// Mang 9: pulse tick 1 (giữ nút tới 100 không kích hoạt lại), tick 102 còn hồi chiêu, tick 201 và 401 được; tick 601 hết đom đóm (0 < 3).
S('06_pulse_edge_cooldown_cost', { ...quiet, player: { pos: [0, 0, 0], carried: 9 } },
  { frames: [{ tick: 0, pulse: true }, { tick: 100, pulse: false }, ...press('pulse', 101), ...press('pulse', 200), ...press('pulse', 400), ...press('pulse', 600)] },
  { requirement: 'R4 kích hoạt khi false->true; hồi chiêu 180 tick; không đủ 3 đom đóm thì không kích hoạt', seed: 1, ticks: 700, snapshot_every: 10,
    expect: {
      events: [{ tick: 1, name: 'pulse' }, { tick: 201, name: 'pulse' }, { tick: 401, name: 'pulse' }],
      event_count: { pulse: 3 },
      snapshots: [{ tick: 700, match: { player: { carried: 0 } } }],
      end: { ticks: 700, state: 'playing', score: 0 } } });

// S1 từ x=3.05, 4 m/s = 1/15 m/tick -> d<=1 ở tick 31. Hit: -1 lửa, rơi floor(4/2)=2 ra vành, bất tử 90, bóng recoil 2 m/60 tick
// rồi đuổi lại 30 tick -> hit tick 121 (rơi 1), tick 211 (rơi 0) -> thua no_flames.
S('07_hit_recoil_no_flames', { ...quiet, player: { pos: [0, 0, 0], carried: 4, flames: 3 }, shades: [{ id: 'S1', pos: [3.05, 1, 0] }] }, null,
  { requirement: 'R4/R5 chạm XZ<=1: -1 lửa, rơi floor(n/2) đom đóm (vành 1.5-2.5 m, ttl 480), bất tử 90 tick, bóng recoil; hết lửa thua', seed: 1, ticks: 1000, snapshot_every: 10,
    expect: {
      events: [
        { tick: 31, name: 'player_hit', data: { by: 'shade', flames: 2, dropped: 2 } },
        { tick: 121, name: 'player_hit', data: { by: 'shade', flames: 1, dropped: 1 } },
        { tick: 211, name: 'player_hit', data: { by: 'shade', flames: 0, dropped: 0 } },
        { tick: 211, name: 'game_over', data: { result: 'lost', reason: 'no_flames' } }],
      event_count: { player_hit: 3 },
      snapshots: [
        { tick: 40, match: { motes_active: 2, motes: [{ kind: 'dropped', ttl_s: 7.85 }, { kind: 'dropped', ttl_s: 7.85 }],
          player: { invuln: true, carried: 2 }, shades: [{ state: 'recoil' }] } },
        { tick: 100, match: { shades: [{ state: 'chase' }] } }],
      end: { ticks: 211, state: 'lost', score: 0 } } });

S('08_dawn', { ...quiet, time_left_s: 1 }, null,
  { requirement: 'R5 hết giờ thì thua dawn', seed: 1, ticks: 600, snapshot_every: 30,
    expect: {
      events: [{ tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } }],
      snapshots: [{ tick: 30, match: { time_left_s: 0.5 } }],
      end: { ticks: 60, state: 'lost', score: 0 } } });

S('09_safe_radius_block', { ...quiet, player: { pos: [0, 0, 0] }, shades: [{ pos: [10, 1, 0] }], lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }] }, null,
  { requirement: 'R4 Bóng Mực ngoài vùng bị chặn ở mép 6 m của đèn đã sáng', seed: 1, ticks: 600, snapshot_every: 100,
    expect: {
      no_events: ['player_hit', 'game_over'],
      snapshots: [{ tick: 600, match: { shades: [{ pos: [6, 1, 0], state: 'chase' }] } }],
      end: { ticks: 600, state: 'playing' } } });

// Đèn L1 (0,0,1.5) thắp ở tick 1 khi S1 đang ở (0,1,0.5) (sát người chơi): S1 bị đẩy ra mép 6 m trong 30 tick -> (0,1,-4.5), không gây sát thương.
S('09b_safe_radius_evict', { ...quiet, player: { pos: [0, 0, 0], carried: 10 }, shades: [{ id: 'S1', pos: [0, 1, 0.5] }],
  lanterns: [{ id: 'L1', pos: [0, 0, 1.5] }] },
  { frames: press('interact', 0) },
  { requirement: 'R4 bóng ở trong lúc đèn vừa thắp bị đẩy ra mép trong 30 tick, không gây sát thương', seed: 1, ticks: 300, snapshot_every: 10,
    expect: {
      events: [{ tick: 1, name: 'lantern_lit', data: { lantern_id: 'L1' } }],
      no_events: ['player_hit'],
      snapshots: [{ tick: 30, match: { shades: [{ id: 'S1', pos: [0, 1, -4.5] }] } }],
      end: { ticks: 300, state: 'playing' } } });

S('10_cam_yaw', { ...quiet },
  { frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: 90 }, { tick: 60, move: [1, 1], cam_yaw_deg: 0 }, { tick: 120, move: [0, 0] }] },
  { requirement: 'R1 tốc độ 6 m/s; yaw 90 biến z thành +X; [1,1] chuẩn hóa', seed: 1, ticks: 130, snapshot_every: 60,
    expect: {
      snapshots: [
        { tick: 60, match: { player: { pos: [6, 0, 0] } } },
        { tick: 120, match: { player: { pos: [10.243, 0, 4.243] } } }],
      end: { ticks: 130, state: 'playing' } } });

S('11_jump', { ...quiet }, { frames: [{ tick: 0, jump: true }] },
  { requirement: 'R1 nhảy 7 m/s, trọng lực 20; về Y=0; giữ nút không nhảy lại', seed: 1, ticks: 120, snapshot_every: 10,
    expect: {
      snapshots: [
        { tick: 10, match: { player: { pos: [0, { $gt: 0.5 }, 0], grounded: false } } },
        { tick: 60, match: { player: { pos: [0, 0, 0], grounded: true } } },
        { tick: 120, match: { player: { pos: [0, 0, 0] } } }],
      end: { ticks: 120, state: 'playing' } } });

S('12_carry_capacity_height', { ...quiet, motes: [...Array(6).fill([0, 0, 0]), ...Array(6).fill([0.5, 0, 0])] }, null,
  { requirement: 'R2 không mang quá 10', seed: 1, ticks: 10, snapshot_every: 10,
    expect: {
      snapshots: [
        { tick: 0, match: { motes_active: 12, score: 0 } },
        { tick: 10, match: { motes_active: 2, score: 0, player: { carried: 10 } } }],
      event_count: { mote_picked: 10 },
      events: [{ tick: 1, name: 'mote_picked', data: { carried: 10 } }] } });

S('12b_pickup_height', { ...quiet, motes: [[0, 1.6, 0], [0.5, 1.4, 0]] }, null,
  { requirement: 'R2 chênh cao > 1.5 m thì không nhặt', seed: 1, ticks: 10, snapshot_every: 10,
    expect: { event_count: { mote_picked: 1 }, snapshots: [{ tick: 10, match: { motes_active: 1, player: { carried: 1 } } }] } });

// Đêm 1 ngẫu nhiên: 20 đom đóm; +1 ở tick 240,480,720,960 (24 điểm) rồi hết điểm trống; Bóng Mực 2 con tick 300, 1 con mỗi 480 tick, tối đa 6.
S('13_night1_random_schedule', null, null,
  { requirement: 'Đêm 1 chuẩn: 20 đom đóm, sinh thêm mỗi 240 tick tới hết 24 điểm; Bóng Mực tick 300 (2 con) rồi mỗi 480 tick, tối đa 6', seed: 42, ticks: 3500, snapshot_every: 60,
    expect: {
      snapshots: [
        { tick: 0, match: { night: 1, motes_active: 20, shades: [], drifters: [], charms: [], wind: { active: false } } },
        { tick: 240, match: { motes_active: 21 } },
        { tick: 960, match: { motes_active: 24 } },
        { tick: 1200, match: { motes_active: 24 } },
        { tick: 300, match: { shades: [{ id: 'S1', state: 'spawning' }, { id: 'S2', state: 'spawning' }] } }],
      events: [
        { tick: 0, name: 'night_start', data: { night: 1 } },
        { tick: 300, name: 'shade_spawned', data: { id: 'S1' } },
        { tick: 300, name: 'shade_spawned', data: { id: 'S2' } },
        { tick: 780, name: 'shade_spawned', data: { id: 'S3' } },
        { tick: 1260, name: 'shade_spawned', data: { id: 'S4' } }, { tick: 1740, name: 'shade_spawned', data: { id: 'S5' } }, { tick: 2220, name: 'shade_spawned', data: { id: 'S6' } }],
      event_count: { shade_spawned: 6 },
      end: { ticks: 3500 } } });

// ===== Phase 2: tính năng mới =====
// Lướt 14 m/s x 12 tick = 2.8 m theo hướng mặt (+Z khi đứng yên). Hồi chiêu 90 tick tính từ lúc bắt đầu: tick 31 bị bỏ qua, tick 101 được.
S('14_dash', { ...quiet },
  { frames: [...press('dash', 0), ...press('dash', 30), ...press('dash', 100)] },
  { requirement: 'P2 Lướt: 14 m/s, 0.2 s, hồi chiêu 1.5 s; hướng mặt khi đứng yên; event dash', seed: 1, ticks: 130, snapshot_every: 10,
    expect: {
      events: [{ tick: 1, name: 'dash', data: {} }, { tick: 101, name: 'dash' }],
      event_count: { dash: 2 },
      snapshots: [
        { tick: 10, match: { player: { vel: [0, 0, 14] } } },
        { tick: 20, match: { player: { pos: [0, 0, 2.8], dash_cd_s: 1.183 } } },
        { tick: 120, match: { player: { pos: [0, 0, 5.6] } } }],
      end: { ticks: 130 } } });

// Nhảy rồi lướt ở tick 6: y sau tick 5 = 0.5; lướt 12 tick giữ nguyên độ cao.
S('14b_dash_air_height', { ...quiet },
  { frames: [{ tick: 0, jump: true, move: [1, 0] }, { tick: 5, dash: true }] },
  { requirement: 'P2 lướt trên không giữ nguyên độ cao; hướng = hướng đang di chuyển (+X)', seed: 1, ticks: 40, snapshot_every: 5,
    expect: {
      snapshots: [
        { tick: 5, match: { player: { pos: [0.5, 0.5, 0] } } },
        { tick: 10, match: { player: { pos: [{ $gt: 1.6 }, 0.5, 0], vel: [14, 0, 0] } } },
        { tick: 15, match: { player: { pos: [{ $gt: 2.7 }, 0.5, 0] } } },
        { tick: 40, match: { player: { pos: [{ $gt: 3 }, 0, 0], grounded: true } } }],
      events: [{ tick: 6, name: 'dash' }] } });

// Từ x=39.45 (tránh biên 40.0) ra khỏi bán kính 40 ở tick 6, rơi 60 tick (y = -n(n+1)/360 < -10 khi n=60) -> tick 66.
// Chờ 60 tick -> hồi sinh (0,0,0) ở tick 126, bất tử 90 tick (hết ở tick 216).
S('15_fall_respawn', { ...quiet, player: { pos: [39.45, 0, 0], carried: 5 } },
  { frames: [{ tick: 0, move: [1, 0] }, { tick: 70, move: [0, 0] }] },
  { requirement: 'P2 rơi (Y<-10): -1 lửa, mất toàn bộ đom đóm, chờ 60 tick, hồi sinh ở xuất phát, bất tử 90 tick', seed: 1, ticks: 300, snapshot_every: 10,
    expect: {
      events: [{ tick: 66, name: 'player_hit', data: { by: 'fall', flames: 2, dropped: 0, lost: 5 } }],
      event_count: { player_hit: 1 },
      snapshots: [
        { tick: 120, match: { player: { carried: 0, flames: 2 } } },
        { tick: 130, match: { player: { pos: [0, 0, 0], vel: [0, 0, 0], invuln: true, grounded: true } } },
        { tick: 220, match: { player: { invuln: false } } }],
      end: { ticks: 300, state: 'playing' } } });

S('15b_fall_last_flame', { ...quiet, player: { pos: [39.45, 0, 0], flames: 1 } },
  { frames: [{ tick: 0, move: [1, 0] }] },
  { requirement: 'P2 rơi khi còn 1 lửa thì thua ngay, không hồi sinh', seed: 1, ticks: 300, snapshot_every: 10,
    expect: {
      events: [{ tick: 66, name: 'player_hit', data: { by: 'fall', flames: 0 } }, { tick: 66, name: 'game_over', data: { result: 'lost', reason: 'no_flames' } }],
      end: { ticks: 66, state: 'lost' } } });

// Tạm dừng ở tick 11, tiếp tục ở tick 31: sim_tick, thời gian, vị trí đứng yên trong lúc dừng.
S('16_pause', { ...quiet },
  { frames: [{ tick: 0, move: [0, 1] }, ...press('pause', 10), ...press('pause', 30)] },
  { requirement: 'P2 tạm dừng: tick tăng, sim_tick/thời gian đứng yên, state paused; event paused/resumed', seed: 1, ticks: 60, snapshot_every: 10,
    expect: {
      events: [{ tick: 11, name: 'paused', data: {} }, { tick: 31, name: 'resumed', data: {} }],
      snapshots: [
        { tick: 20, match: { state: 'paused', sim_tick: 10, time_left_s: 239.833, player: { pos: [0, 0, 1] } } },
        { tick: 30, match: { state: 'paused', sim_tick: 10 } },
        { tick: 40, match: { state: 'playing', sim_tick: 20, player: { pos: [0, 0, 2] } } }],
      end: { ticks: 60, state: 'playing' } } });

// Đêm 2, Bùa Gió C1 tại (35,0,0). Nhặt ở tick 1 -> 600 tick, chạy 7.2 m/s (0.12 m/tick từ tick 2): x(10) = 34.9 - 0.12*9 = 33.82.
// Lướt không hồi chiêu: nhấn ở tick 21 và 41 đều lướt; nhấn ở tick 23 (đang lướt) bị bỏ qua.
S('17_charm', { ...quiet, player: { pos: [35, 0, 0] } },
  { frames: [{ tick: 0, move: [-1, 0] }, ...press('dash', 20), ...press('dash', 22), ...press('dash', 40)] },
  { requirement: 'P2 Bùa Gió: nhặt như đom đóm, 600 tick, 7.2 m/s, lướt không hồi chiêu, xuất hiện lại sau 2700 tick', seed: 1, night: 2, ticks: 60, snapshot_every: 10,
    expect: {
      events: [{ tick: 1, name: 'charm_picked', data: { charm_id: 'C1', charm_ticks: 600 } }, { tick: 21, name: 'dash' }, { tick: 41, name: 'dash' }],
      event_count: { dash: 2, charm_picked: 1 },
      snapshots: [
        { tick: 0, match: { night: 2, charms: [{ id: 'C1', available: true, respawn_s: 0 }] } },
        { tick: 10, match: { player: { pos: [33.82, 0, 0], charm_s: 9.85 }, charms: [{ id: 'C1', available: false, respawn_s: 44.85 }] } }],
      end: { ticks: 60, state: 'playing' } } });

// Đêm 2, D1 idle ở (5,1,0); Mây mang 6 (>=5, <=15 m) -> chase 7 m/s, chạm 1.2 m ở tick 33, cướp 3, flee 240 tick -> removed ở tick 273.
S('18_drifter_steal', { ...quiet, player: { pos: [0, 0, 0], carried: 6 }, drifters: [{ id: 'D1', pos: [5, 1, 0] }] }, null,
  { requirement: 'P2 Gió Lạc: idle->chase khi mang >=5 và <=15 m; chạm 1.2 m cướp min(3, n); flee 240 tick rồi removed', seed: 1, night: 2, ticks: 300, snapshot_every: 10,
    expect: {
      events: [{ tick: 33, name: 'drifter_steal', data: { drifter_id: 'D1', amount: 3, carried: 3 } }],
      event_count: { drifter_steal: 1 },
      snapshots: [
        { tick: 0, match: { drifters: [{ id: 'D1', state: 'idle', stolen: 0 }] } },
        { tick: 10, match: { drifters: [{ state: 'chase' }] } },
        { tick: 40, match: { drifters: [{ state: 'flee', stolen: 3 }], player: { carried: 3 } } },
        { tick: 280, match: { drifters: [{ state: 'removed', stolen: 3 }] } }],
      end: { ticks: 300 } } });

// Tỏa Sáng trúng D1 đang flee mang 3 -> thả 3 đom đóm rơi tại chỗ, biến mất sau 120 tick; trúng D2 đang chase -> flee không cướp.
S('19_drifter_pulse', { ...quiet, player: { pos: [0, 0, 0], carried: 9 },
  drifters: [{ id: 'D1', pos: [3, 1, 0], state: 'flee', stolen: 3 }, { id: 'D2', pos: [-3, 1, 0], state: 'chase' }] },
  { frames: press('pulse', 0) },
  { requirement: 'P2 Tỏa Sáng với Gió Lạc: chase->flee không cướp; flee có đồ -> thả lại (drifter_drop), biến mất sau 120 tick', seed: 1, night: 2, ticks: 300, snapshot_every: 10,
    expect: {
      events: [{ tick: 1, name: 'pulse', data: { stunned_ids: [] } }, { tick: 1, name: 'drifter_drop', data: { drifter_id: 'D1', amount: 3 } }],
      no_events: ['drifter_steal'],
      snapshots: [
        { tick: 10, match: { motes_active: 3, motes: [{ kind: 'dropped' }, { kind: 'dropped' }, { kind: 'dropped' }],
          drifters: [{ id: 'D1', state: 'flee', stolen: 0 }, { id: 'D2', state: 'flee', stolen: 0 }], player: { carried: 6, flames: 3 } } },
        { tick: 130, match: { drifters: [{ id: 'D1', state: 'removed' }, { id: 'D2', state: 'flee' }] } },
        { tick: 250, match: { drifters: [{ state: 'removed' }, { state: 'removed' }] } }],
      end: { ticks: 300 } } });

// Đêm 2: đứng trên bục (20,0,18) -> vy 14, ngang 24 m/s về tâm B (70,0,0); bay 83 tick, đáp ~(51.24, 0, 6.75) trên đảo B.
S('20_night2_jump_pad', { ...quiet, player: { pos: [20, 0, 18] } }, null,
  { requirement: 'P2 Đêm 2 bục nhảy: vy 14, ngang 24 m/s về tâm đảo kia, bay ~1.4 s, đáp trong đảo đích; cầu tre nối hai đảo', seed: 1, night: 2, ticks: 120, snapshot_every: 10,
    expect: {
      no_events: ['player_hit'],
      snapshots: [
        { tick: 40, match: { player: { pos: [range(34, 36), range(4.7, 4.8), range(12, 13)], grounded: false } } },
        { tick: 100, match: { player: { pos: [range(51.2, 51.7), 0, range(6.5, 6.8)], grounded: true } } }],
      end: { ticks: 120, state: 'playing' } } });

// Đêm 3: đi về tâm từ (0,0,-11) bị vách tầng 2 (r=8) chặn ở z=-8.05 (tránh biên r=8 đúng bằng số thực). Đi lên dốc 30° từ r=31: r=27 -> y=1.5; r=19 -> tầng 1, y=3.
S('21_night3_cliff_ramp', { ...quiet, player: { pos: [0, 0, -11.05] } },
  { frames: [{ tick: 0, move: [0, 1] }] },
  { requirement: 'P2 Đêm 3: mép tầng là vách đứng, không đi lên được', seed: 1, night: 3, ticks: 60, snapshot_every: 60,
    expect: { snapshots: [{ tick: 60, match: { night: 3, player: { pos: [0, 0, -8.05] } } }], end: { ticks: 60 } } });
S('21b_night3_ramp', { ...quiet, player: { pos: [26.846097, 0, 15.5] } },
  { frames: [{ tick: 0, move: [-0.8660254, -0.5] }] },
  { requirement: 'P2 Đêm 3: dốc 30° từ r=30 (Y=0) lên r=24 (Y=3), tới tầng 1', seed: 1, night: 3, ticks: 120, snapshot_every: 40,
    expect: { snapshots: [
      { tick: 40, match: { player: { pos: [23.382, 1.5, 13.5] } } },
      { tick: 120, match: { player: { pos: [16.454, 3, 9.5], grounded: true } } }] } });

// Đêm 3 gió: cơn gió bắt đầu ở sim_tick 1800, kéo dài 300 tick.
S('22_night3_wind', { ...quiet, wind_enabled: true, player: { pos: [0, 0, -30] } }, null,
  { requirement: 'P2 Đêm 3 gió mạnh: mỗi 30 s một cơn 5 s, đẩy người chơi 2 m/s', seed: 5, night: 3, ticks: 2200, snapshot_every: 10,
    expect: { snapshots: [
      { tick: 1790, match: { wind: { active: false }, player: { pos: [0, 0, -30] } } },
      { tick: 1800, match: { wind: { active: true } } },
      { tick: 2090, match: { wind: { active: true } } },
      { tick: 2100, match: { wind: { active: false } } }],
      no_events: ['player_hit'] } });

// Đêm 2/3 lịch Gió Lạc: tick 1200, 2400 (tối đa 2), id D1, D2.
S('23_night2_drifter_schedule', { random_motes: false, random_shades: false, player: { pos: [0, 0, 0] } }, null,
  { requirement: 'P2 Gió Lạc sinh ở tick 1200, 2400... tối đa 2, id D1, D2', seed: 9, night: 2, ticks: 3700, snapshot_every: 100,
    expect: { snapshots: [
      { tick: 1100, match: { drifters: [] } },
      { tick: 1200, match: { drifters: [{ id: 'D1', state: 'idle' }] } },
      { tick: 2400, match: { drifters: [{ id: 'D1' }, { id: 'D2' }] } },
      { tick: 3600, match: { drifters: [{ id: 'D1' }, { id: 'D2' }] } }] } });

// ===== Phase 3: dầu đèn, hút dầu, luật thắng mới =====
// fuel 1 = 60 đơn vị, hao 1 đơn vị/tick -> tắt ở tick 60: lantern_out, deposited 0, ever_lit vẫn true.
S('24_fuel_decay_out', { ...quiet, lanterns: [{ id: 'L1', lit: true, fuel: 1, deposited: 10 }] }, null,
  { requirement: 'T3 dầu hao 1/s; fuel <= 0 thì tắt, deposited = 0, lantern_out, ever_lit = true', seed: 1, ticks: 100, snapshot_every: 10,
    expect: {
      events: [{ tick: 60, name: 'lantern_out', data: { lantern_id: 'L1' } }],
      snapshots: [
        { tick: 30, match: { lanterns: [{ lit: true, fuel: 0.5 }, {}, {}, {}, {}] } },
        { tick: 60, match: { lanterns: [{ lit: false, fuel: 0, deposited: 0, ever_lit: true }, {}, {}, {}, {}] } }] } });

// fuel 55 -> 54.983 ở tick 1: used = min(10, ceil(45.017/10)=5) = 5 -> fuel 100 (chặn trần); tick 11: 99.833 -> used 1.
S('25_refuel', { ...quiet, player: { pos: [0, 0, 0], carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: true, fuel: 55 }] },
  { frames: [...press('interact', 0), ...press('interact', 10)] },
  { requirement: 'T3 châm dầu: used = min(mang, ceil((100-fuel)/10)), fuel = min(100, fuel + 10 x used), +5/đom đóm', seed: 1, ticks: 30, snapshot_every: 10,
    expect: {
      events: [{ tick: 1, name: 'refuel', data: { lantern_id: 'L1', amount: 5, fuel: 100 } }, { tick: 11, name: 'refuel', data: { lantern_id: 'L1', amount: 1, fuel: 100 } }],
      event_count: { refuel: 2, lantern_lit: 0, deposit: 0 },
      snapshots: [{ tick: 20, match: { player: { carried: 4 } } }],
      end: { ticks: 30, score: 30 } } });

// Đèn đã từng sáng chỉ cần 5 để thắp lại: +25 + 40 = 65; relit_count 1; sức chứa 12.
S('26_relight', { ...quiet, player: { pos: [0, 0, 0], carried: 5 }, lanterns: [{ id: 'L1', pos: [0, 0, 1], lit: false, ever_lit: true }] },
  { frames: press('interact', 0) },
  { requirement: 'T3 thắp lại đèn ever_lit chỉ cần 5; lantern_lit relight: true; +40; relit_count; sức chứa tăng', seed: 1, ticks: 20, snapshot_every: 10,
    expect: {
      events: [{ tick: 1, name: 'deposit', data: { lantern_id: 'L1', amount: 5, deposited: 5 } }, { tick: 1, name: 'lantern_lit', data: { lantern_id: 'L1', relight: true } }],
      snapshots: [{ tick: 10, match: { player: { carried: 0, capacity: 12 }, lanterns: [{ lit: true, relit_count: 1, ever_lit: true }, {}, {}, {}, {}] } }],
      end: { ticks: 20, score: 65 } } });

// S1 wander tới đèn yếu L1 (fuel 29 < 30): 0.025 m/tick, tới 2 m ở tick 41 -> drain. Hút từ tick 42; fuel_drain ở tick 101:
// fuel = (1740 - 101 - 300)/60 = 22.3. Mây ở xa (48 m) nên không chase.
S('27_drain', { ...quiet, player: { pos: [0, 0, -35] }, lanterns: [{ id: 'L1', pos: [0, 0, 10], lit: true, fuel: 29 }], shades: [{ id: 'S1', pos: [0, 1, 13.01], state: 'wander' }] }, null,
  { requirement: 'T3 bóng wander tới đèn fuel < 30 (mất vùng an toàn), cách <= 2 m thì drain, hút 5/s + hao 1/s, fuel_drain mỗi 60 tick', seed: 1, ticks: 130, snapshot_every: 10,
    expect: {
      events: [{ tick: 101, name: 'fuel_drain', data: { lantern_id: 'L1', shade_id: 'S1', fuel: 22.3 } }],
      event_count: { fuel_drain: 1 },
      snapshots: [{ tick: 40, match: { shades: [{ state: 'wander' }] } }, { tick: 50, match: { shades: [{ state: 'drain', pos: [0, 1, 12] }] } }] } });

// Tỏa Sáng trúng bóng đang drain: tổng +15.
S('28_pulse_drain_bonus', { ...quiet, player: { pos: [0, 0, 7], carried: 3 }, lanterns: [{ id: 'L1', pos: [0, 0, 10], lit: true, fuel: 20 }],
  shades: [{ id: 'S1', pos: [0, 1, 11.5], state: 'drain', target_lantern_id: 'L1' }] },
  { frames: press('pulse', 0) },
  { requirement: 'T3 Tỏa Sáng trúng bóng đang drain: stunned, tổng +15', seed: 1, ticks: 20, snapshot_every: 10,
    expect: {
      events: [{ tick: 1, name: 'pulse', data: { stunned_ids: ['S1'] } }],
      snapshots: [{ tick: 0, match: { shades: [{ state: 'drain' }] } }, { tick: 10, match: { score: 15, shades: [{ state: 'stunned' }] } }] } });

// Đêm 2 cần ceil(0.6 x 6) = 4; Đêm 3 cần ceil(0.6 x 7) = 5.
S('29_win_threshold_night2', { ...quiet, time_left_s: 1, lanterns: ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true })) }, null,
  { requirement: 'T3 Đêm 2 thắng với 4/6 đèn sáng; điểm 4 x 149 + 150 = 746', seed: 1, night: 2, ticks: 120, snapshot_every: 10,
    expect: { events: [{ tick: 60, name: 'game_over', data: { result: 'won', reason: 'dawn_survived' } }], end: { state: 'won', score: 746 } } });
S('29b_lose_threshold_night3', { ...quiet, time_left_s: 1, player: { pos: [0, 0, -30] }, lanterns: ['L1', 'L2', 'L3', 'L4'].map((id) => ({ id, lit: true })) }, null,
  { requirement: 'T3 Đêm 3 chỉ 4/7 đèn sáng (< 5) thì thua dawn', seed: 1, night: 3, ticks: 120, snapshot_every: 10,
    expect: { events: [{ tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } }], end: { state: 'lost' } } });

// Châm đèn yếu (20) lên >= 30 khi có bóng trong vùng 6 m: bóng bị đẩy ra mép trong 30 tick -> (0,1,-4.5).
S('30_refuel_evict', { ...quiet, player: { pos: [0, 0, 0], carried: 10 }, lanterns: [{ id: 'L1', pos: [0, 0, 1.5], lit: true, fuel: 20 }],
  shades: [{ id: 'S1', pos: [0, 1, 0.5], state: 'stunned', state_ticks_left: 300 }] },
  { frames: press('interact', 0) },
  { requirement: 'T3 châm dầu lên >= 30 khi có bóng trong vùng: đẩy ra mép trong 30 tick, không gây sát thương', seed: 1, ticks: 60, snapshot_every: 10,
    expect: {
      events: [{ tick: 1, name: 'refuel', data: { lantern_id: 'L1', amount: 9, fuel: 100 } }],
      no_events: ['player_hit'],
      snapshots: [{ tick: 30, match: { shades: [{ pos: [0, 1, -4.5] }] } }] } });
console.log('ok');
