// Logic game thuần, chạy theo tick cố định 60 Hz. Dùng chung cho headless và bản có đồ họa.
import { Rng } from './rng.js';
import {
  TICK_RATE, ISLAND_RADIUS, LANTERN_RING_RADIUS, JUMP_VELOCITY, GRAVITY, SHADE_HEIGHT,
  INITIAL_MOTES, MAX_MOTES, MOTE_RESPAWN_S, MOTE_MIN_R, MOTE_MAX_R,
  INITIAL_SHADES, MAX_SHADES, SHADE_SPAWN_S, SHADE_SPAWN_R, SHADE_SPAWN_MIN_DIST, EPS,
} from './constants.js';
import type {
  Tuning, Scenario, Player, Lantern, Shade, Mote, GameState, Input, GameEvent, Vec3,
} from './types.js';

export interface Game {
  tuning: Tuning;
  rng: Rng;
  /** Số bước đã chạy (= sim_tick). */
  tick: number;
  state: GameState;
  score: number;
  startTimeLeft: number;
  player: Player;
  lanterns: Lantern[];
  shades: Shade[];
  motes: Mote[];
  randomMotes: boolean;
  randomShades: boolean;
  nextMoteId: number;
  nextShadeId: number;
  moteTimer: number;
  shadeTimer: number;
  prev: { jump: boolean; interact: boolean; pulse: boolean; dash: boolean };
}

const secToTicks = (s: number) => Math.max(0, Math.round(s * TICK_RATE));
export const distXZ = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

function clampToIsland(p: Vec3, r = ISLAND_RADIUS) {
  const d = Math.hypot(p[0], p[2]);
  if (d > r) { p[0] *= r / d; p[2] *= r / d; }
}

export function defaultLanternPos(i: number): Vec3 {
  const a = (i * 2 * Math.PI) / 5;
  return [LANTERN_RING_RADIUS * Math.sin(a), 0, LANTERN_RING_RADIUS * Math.cos(a)];
}

function randomMotePos(rng: Rng): Vec3 {
  const a = rng.range(0, Math.PI * 2);
  const r = Math.sqrt(rng.range(MOTE_MIN_R ** 2, MOTE_MAX_R ** 2));
  return [r * Math.sin(a), 0, r * Math.cos(a)];
}

function isSafeFromShades(g: Game, p: Vec3): boolean {
  return g.lanterns.some((l) => l.lit && distXZ(l.pos, p) <= g.tuning.safe_radius);
}

function randomShadePos(g: Game): Vec3 {
  let pos: Vec3 = [0, SHADE_HEIGHT, SHADE_SPAWN_R];
  for (let i = 0; i < 8; i++) {
    const a = g.rng.range(0, Math.PI * 2);
    pos = [SHADE_SPAWN_R * Math.sin(a), SHADE_HEIGHT, SHADE_SPAWN_R * Math.cos(a)];
    if (distXZ(pos, g.player.pos) >= SHADE_SPAWN_MIN_DIST && !isSafeFromShades(g, pos)) break;
  }
  return pos;
}

function newShade(g: Game, pos: Vec3, id?: string): Shade {
  return { id: id ?? `S${g.nextShadeId++}`, pos: [...pos] as Vec3, state: 'chase', stunTicks: 0 };
}

export function createGame(tuning: Tuning, seed: number, sc: Scenario = {}): Game {
  const g: Game = {
    tuning,
    rng: new Rng(seed),
    tick: 0,
    state: 'playing',
    score: 0,
    startTimeLeft: sc.time_left_s ?? tuning.night1_duration_s,
    player: {
      pos: [...(sc.player?.pos ?? [0, 0, 0])] as Vec3,
      vy: 0,
      grounded: true,
      flames: sc.player?.flames ?? tuning.flames,
      carried: sc.player?.carried ?? 0,
      invulnTicks: 0,
      pulseCooldownTicks: 0,
    },
    lanterns: [],
    shades: [],
    motes: [],
    randomMotes: sc.random_motes ?? true,
    randomShades: sc.random_shades ?? true,
    nextMoteId: 1,
    nextShadeId: 1,
    moteTimer: 0,
    shadeTimer: 0,
    prev: { jump: false, interact: false, pulse: false, dash: false },
  };
  g.player.grounded = g.player.pos[1] <= 0;

  for (let i = 0; i < tuning.lantern_count_night1; i++) {
    g.lanterns.push({ id: `L${i + 1}`, pos: defaultLanternPos(i), lit: false, deposited: 0 });
  }
  for (const l of sc.lanterns ?? []) {
    const t = g.lanterns.find((x) => x.id === l.id)!;
    if (l.pos) t.pos = [...l.pos] as Vec3;
    if (l.deposited !== undefined) t.deposited = l.deposited;
    if (l.lit !== undefined) t.lit = l.lit;
  }

  if (sc.motes) {
    for (const p of sc.motes) g.motes.push({ id: `M${g.nextMoteId++}`, pos: [...p] as Vec3 });
  } else if (g.randomMotes) {
    for (let i = 0; i < INITIAL_MOTES; i++) g.motes.push({ id: `M${g.nextMoteId++}`, pos: randomMotePos(g.rng) });
  }

  if (sc.shades) {
    // id do scenario đặt được giữ nguyên; id tự sinh không trùng với chúng.
    const used = new Set(sc.shades.map((s) => s.id).filter(Boolean));
    for (const s of sc.shades) {
      let id = s.id;
      if (!id) { do { id = `S${g.nextShadeId++}`; } while (used.has(id)); used.add(id); }
      g.shades.push(newShade(g, s.pos, id));
    }
    let n = g.nextShadeId;
    while (used.has(`S${n}`)) n++;
    g.nextShadeId = n;
  } else if (g.randomShades) {
    for (let i = 0; i < INITIAL_SHADES; i++) g.shades.push(newShade(g, randomShadePos(g)));
  }
  return g;
}

export function timeLeft(g: Game): number {
  return g.startTimeLeft - g.tick / TICK_RATE;
}

function endGame(g: Game, result: 'won' | 'lost', reason: string, ev: (n: string, d: Record<string, unknown>) => void) {
  g.state = result;
  if (result === 'won') {
    const s = g.tuning.score;
    g.score += s.per_second_left * Math.floor(Math.max(0, timeLeft(g)) + EPS) + s.per_flame_left * g.player.flames;
  }
  ev('game_over', { result, reason });
}

/**
 * Chạy đúng một bước: đọc input của tick k, tạo trạng thái k+1.
 * Trả về các sự kiện (tick = k+1). Thứ tự xử lý cố định, xem docs/notes/assumptions.md.
 */
export function step(g: Game, input: Input): GameEvent[] {
  const events: GameEvent[] = [];
  if (g.state !== 'playing') return events;
  g.tick += 1;
  const T = g.tuning;
  const p = g.player;
  const ev = (name: string, data: Record<string, unknown>) => events.push({ tick: g.tick, name, data });

  // 1. Nút: kích hoạt khi false -> true
  const pressed = (k: 'jump' | 'interact' | 'pulse' | 'dash') => input[k] && !g.prev[k];
  const jumpP = pressed('jump'), interactP = pressed('interact'), pulseP = pressed('pulse');
  g.prev = { jump: input.jump, interact: input.interact, pulse: input.pulse, dash: input.dash };

  // 2. Bộ đếm thời gian
  if (p.invulnTicks > 0) p.invulnTicks--;
  if (p.pulseCooldownTicks > 0) p.pulseCooldownTicks--;
  for (const s of g.shades) {
    if (s.state === 'stunned' && --s.stunTicks <= 0) { s.stunTicks = 0; s.state = 'chase'; }
  }

  // 3. Di chuyển theo camera yaw
  let [mx, mz] = input.move;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const th = (input.cam_yaw_deg * Math.PI) / 180;
  const wx = mx * Math.cos(th) + mz * Math.sin(th);
  const wz = -mx * Math.sin(th) + mz * Math.cos(th);
  p.pos[0] += (wx * T.player_speed) / TICK_RATE;
  p.pos[2] += (wz * T.player_speed) / TICK_RATE;
  clampToIsland(p.pos);

  // 4. Nhảy
  if (jumpP && p.grounded) { p.vy = JUMP_VELOCITY; p.grounded = false; }
  if (!p.grounded) {
    p.vy -= GRAVITY / TICK_RATE;
    p.pos[1] += p.vy / TICK_RATE;
    if (p.pos[1] <= 0) { p.pos[1] = 0; p.vy = 0; p.grounded = true; }
  }

  // 5. Nhặt đom đóm (tự động trong pickup_radius, đến khi đầy carry_capacity)
  for (let i = 0; i < g.motes.length && p.carried < T.carry_capacity; ) {
    if (distXZ(g.motes[i].pos, p.pos) <= T.pickup_radius) {
      g.motes.splice(i, 1);
      p.carried++;
      g.score += T.score.per_mote;
      ev('mote_picked', { carried: p.carried });
    } else i++;
  }

  // 6. Tương tác: nạp đom đóm vào đèn chưa sáng gần nhất trong interact_radius
  if (interactP && p.carried > 0) {
    let best: Lantern | null = null;
    let bestD = Infinity;
    for (const l of g.lanterns) {
      if (l.lit) continue;
      const d = distXZ(l.pos, p.pos);
      if (d <= T.interact_radius && d < bestD) { best = l; bestD = d; }
    }
    if (best) {
      const amount = Math.min(p.carried, Math.max(0, T.lantern_cost - best.deposited));
      if (amount > 0) {
        p.carried -= amount;
        best.deposited += amount;
        ev('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      }
      if (best.deposited >= T.lantern_cost) {
        best.lit = true;
        g.score += T.score.per_lantern;
        ev('lantern_lit', { lantern_id: best.id });
        if (g.lanterns.every((l) => l.lit)) { endGame(g, 'won', 'all_lit', ev); return events; }
      }
    }
  }

  // 7. Xung sáng: tốn pulse_cost đom đóm đang mang, có cooldown
  if (pulseP && p.pulseCooldownTicks === 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCooldownTicks = secToTicks(T.pulse_cooldown_s);
    const ids: string[] = [];
    for (const s of g.shades) {
      const d = distXZ(s.pos, p.pos);
      if (d > T.pulse_radius) continue;
      s.state = 'stunned';
      s.stunTicks = secToTicks(T.pulse_stun_s);
      const dx = d > EPS ? (s.pos[0] - p.pos[0]) / d : 1;
      const dz = d > EPS ? (s.pos[2] - p.pos[2]) / d : 0;
      s.pos[0] += dx * T.pulse_push_m;
      s.pos[2] += dz * T.pulse_push_m;
      clampToIsland(s.pos);
      g.score += T.score.per_stun;
      ids.push(s.id);
    }
    ev('pulse', { stunned_ids: ids });
  }

  // 8. Bóng Mực di chuyển: đuổi theo người chơi, không vào safe_radius của đèn đã sáng
  const sp = T.shade_speed / TICK_RATE;
  for (const s of g.shades) {
    if (s.state === 'stunned') continue;
    const d = distXZ(s.pos, p.pos);
    if (d > EPS) {
      const m = Math.min(sp, d);
      s.pos[0] += ((p.pos[0] - s.pos[0]) / d) * m;
      s.pos[2] += ((p.pos[2] - s.pos[2]) / d) * m;
    }
    for (const l of g.lanterns) {
      if (!l.lit) continue;
      const dl = distXZ(s.pos, l.pos);
      if (dl <= T.safe_radius) {
        const r = T.safe_radius + 1e-3;
        const ux = dl > EPS ? (s.pos[0] - l.pos[0]) / dl : 1;
        const uz = dl > EPS ? (s.pos[2] - l.pos[2]) / dl : 0;
        s.pos[0] = l.pos[0] + ux * r;
        s.pos[2] = l.pos[2] + uz * r;
      }
    }
    clampToIsland(s.pos);
  }

  // 9. Va chạm: mất 1 flame, rơi floor(carried * hit_drop_ratio) đom đóm, bất tử invuln_s
  if (p.invulnTicks === 0 && !isSafeFromShades(g, p.pos)) {
    const hitter = g.shades.find((s) => s.state !== 'stunned' && distXZ(s.pos, p.pos) <= T.shade_hit_radius);
    if (hitter) {
      p.flames = Math.max(0, p.flames - 1);
      const dropped = Math.floor(p.carried * T.hit_drop_ratio + EPS);
      p.carried -= dropped;
      p.invulnTicks = secToTicks(T.invuln_s);
      ev('player_hit', { by: 'shade', flames: p.flames, dropped });
      if (p.flames <= 0) { endGame(g, 'lost', 'no_flames', ev); return events; }
    }
  }

  // 10. Bình minh
  if (timeLeft(g) <= EPS) { endGame(g, 'lost', 'dawn', ev); return events; }

  // 11. Sinh thêm (chỉ khi bật random)
  if (g.randomMotes && ++g.moteTimer >= secToTicks(MOTE_RESPAWN_S)) {
    g.moteTimer = 0;
    if (g.motes.length < MAX_MOTES) g.motes.push({ id: `M${g.nextMoteId++}`, pos: randomMotePos(g.rng) });
  }
  if (g.randomShades && ++g.shadeTimer >= secToTicks(SHADE_SPAWN_S)) {
    g.shadeTimer = 0;
    if (g.shades.length < MAX_SHADES) {
      const s = newShade(g, randomShadePos(g));
      g.shades.push(s);
      ev('shade_spawned', { id: s.id });
    }
  }
  return events;
}
