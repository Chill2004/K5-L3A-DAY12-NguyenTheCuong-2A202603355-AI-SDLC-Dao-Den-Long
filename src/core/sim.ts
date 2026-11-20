// Logic game thuần, 60 tick/giây cố định. Thứ tự xử lý trong một tick theo Ticket-02 (bắt buộc).
import { Rng } from './rng.js';
import * as C from './constants.js';
import { MAPS, type MapDef } from './maps.js';
import type {
  Tuning, Scenario, Player, Lantern, Shade, Drifter, Mote, Charm, GameState, Input, GameEvent, Vec3, ShadeState,
} from './types.js';

export interface Game {
  tuning: Tuning;
  map: MapDef;
  night: number;
  rng: Rng;
  tick: number; // số bước đã chạy, kể cả lúc tạm dừng
  simTick: number; // số bước gameplay
  paused: boolean;
  state: GameState;
  score: number;
  startTimeLeft: number;
  player: Player;
  lanterns: Lantern[];
  shades: Shade[];
  drifters: Drifter[];
  motes: Mote[];
  charms: Charm[];
  randomMotes: boolean;
  randomShades: boolean;
  randomDrifters: boolean;
  windEnabled: boolean;
  wind: { ticks: number; dirDeg: number };
  nextMoteId: number;
  nextShadeId: number;
  nextDrifterId: number;
  prev: { jump: boolean; interact: boolean; pulse: boolean; dash: boolean; pause: boolean };
}

type Ev = (name: string, data: Record<string, unknown>) => void;

export const secToTicks = (s: number) => Math.max(0, Math.round(s * C.TICK_RATE));
export const distXZ = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function unitXZ(from: Vec3, to: Vec3): [number, number] {
  const dx = to[0] - from[0], dz = to[2] - from[2];
  const l = Math.hypot(dx, dz);
  return l > C.EPS ? [dx / l, dz / l] : [1, 0];
}

export function nightDuration(t: Tuning, night: number): number {
  return night === 3 ? t.night3_duration_s : night === 2 ? t.night2_duration_s : t.night1_duration_s;
}

export function timeLeft(g: Game): number {
  return g.startTimeLeft - g.simTick / C.TICK_RATE;
}

function hoverOf(map: MapDef, pos: Vec3): number {
  const gr = map.ground(pos[0], pos[2]);
  return gr === null ? 0 : pos[1] - gr;
}

function defaultTicks(state: ShadeState, t: Tuning): number {
  if (state === 'spawning') return C.SHADE_SPAWNING_TICKS;
  if (state === 'stunned') return secToTicks(t.pulse_stun_s);
  if (state === 'recoil') return C.RECOIL_TICKS + 1;
  return 0;
}

function makeShade(g: Game, id: string, pos: Vec3, state: ShadeState, ticks?: number): Shade {
  return {
    id, pos: [...pos] as Vec3, hover: hoverOf(g.map, pos), state, stateTicks: ticks ?? defaultTicks(state, g.tuning),
    pushTicks: 0, dir: unitXZ(g.player.pos, pos), evictTicks: 0, evictFrom: -1,
    home: [pos[0], pos[2]], target: [pos[0], pos[2]],
  };
}

function makeDrifter(g: Game, id: string, pos: Vec3, state: Drifter['state'] = 'idle', stolen = 0): Drifter {
  return {
    id, pos: [...pos] as Vec3, hover: hoverOf(g.map, pos), state, stolen,
    fleeTicks: state === 'flee' ? C.DRIFTER_FLEE_TICKS : 0, home: [pos[0], pos[2]], target: [pos[0], pos[2]],
  };
}

function pickIndex(rng: Rng, n: number): number {
  return Math.min(n - 1, Math.floor(rng.next() * n));
}

export function createGame(tuning: Tuning, seed: number, night = 1, sc: Scenario = {}): Game {
  const map = MAPS[night];
  const sp = sc.player ?? {};
  const g: Game = {
    tuning, map, night, rng: new Rng(seed),
    tick: 0, simTick: 0, paused: false, state: 'playing', score: 0,
    startTimeLeft: sc.time_left_s ?? nightDuration(tuning, night),
    player: {
      pos: [...(sp.pos ?? map.start)] as Vec3, vel: [0, 0, 0], grounded: true, facing: [0, 1],
      flames: sp.flames ?? tuning.flames, carried: sp.carried ?? 0,
      invulnTicks: sp.invuln_ticks ?? 0, pulseCdTicks: sp.pulse_cd_ticks ?? 0, dashCdTicks: sp.dash_cd_ticks ?? 0,
      dashTicks: 0, dashDir: [0, 1], charmTicks: sp.charm_ticks ?? 0, launched: null, fallWait: 0,
    },
    lanterns: map.lanterns.map((pos, i) => ({ id: `L${i + 1}`, pos: [...pos] as Vec3, lit: false, deposited: 0 })),
    shades: [], drifters: [], motes: [], charms: [],
    randomMotes: sc.random_motes ?? true,
    randomShades: sc.random_shades ?? true,
    randomDrifters: sc.random_drifters ?? true,
    windEnabled: sc.wind_enabled ?? true,
    wind: { ticks: 0, dirDeg: 0 },
    nextMoteId: 1, nextShadeId: 1, nextDrifterId: 1,
    prev: { jump: false, interact: false, pulse: false, dash: false, pause: false },
  };
  const p = g.player;
  const gr = map.ground(p.pos[0], p.pos[2]);
  p.grounded = gr !== null && Math.abs(p.pos[1] - gr) <= C.EPS;

  for (const l of sc.lanterns ?? []) {
    const t = g.lanterns.find((x) => x.id === l.id)!;
    if (l.pos) t.pos = [...l.pos] as Vec3;
    if (l.deposited !== undefined) t.deposited = l.deposited;
    if (l.lit !== undefined) t.lit = l.lit;
  }

  if (sc.motes) {
    for (const pos of sc.motes) g.motes.push({ id: `M${g.nextMoteId++}`, pos: [...pos] as Vec3, kind: 'random', ttl: 0, spawnIdx: -1 });
  } else if (g.randomMotes) {
    const idx = map.moteSpawns.map((_, i) => i);
    for (let i = 0; i < C.INITIAL_MOTES && idx.length; i++) {
      const k = idx.splice(pickIndex(g.rng, idx.length), 1)[0];
      g.motes.push({ id: `M${g.nextMoteId++}`, pos: [...map.moteSpawns[k]] as Vec3, kind: 'random', ttl: 0, spawnIdx: k });
    }
  }

  if (sc.shades) {
    const used = new Set(sc.shades.map((s) => s.id).filter(Boolean));
    for (const s of sc.shades) {
      let id = s.id;
      if (!id) { do { id = `S${g.nextShadeId++}`; } while (used.has(id)); used.add(id); }
      const state = s.state ?? (distXZ(s.pos, p.pos) <= C.SHADE_DETECT ? 'chase' : 'wander');
      g.shades.push(makeShade(g, id, s.pos, state, s.state_ticks_left));
    }
    while (used.has(`S${g.nextShadeId}`)) g.nextShadeId++;
  }

  if (sc.drifters) {
    const used = new Set(sc.drifters.map((d) => d.id).filter(Boolean));
    for (const d of sc.drifters) {
      let id = d.id;
      if (!id) { do { id = `D${g.nextDrifterId++}`; } while (used.has(id)); used.add(id); }
      g.drifters.push(makeDrifter(g, id, d.pos, d.state ?? 'idle', d.stolen ?? 0));
    }
    while (used.has(`D${g.nextDrifterId}`)) g.nextDrifterId++;
  }

  if (sc.charms) {
    sc.charms.forEach((c, i) => g.charms.push({
      id: c.id ?? `C${i + 1}`, pos: [...(c.pos ?? map.charms[i] ?? [0, 0, 0])] as Vec3, available: c.available ?? true, respawnTicks: 0,
    }));
  } else {
    map.charms.forEach((pos, i) => g.charms.push({ id: `C${i + 1}`, pos: [...pos] as Vec3, available: true, respawnTicks: 0 }));
  }
  return g;
}

// ---------- Mây ----------
function blockedForPlayer(g: Game, x: number, z: number): boolean {
  const gr = g.map.ground(x, z);
  if (gr !== null && gr > g.player.pos[1] + C.STEP_HEIGHT) return true; // vách đứng
  const t = g.map.tower;
  return !!t && Math.hypot(x - t.x, z - t.z) < t.r && g.player.pos[1] < t.top;
}

function movePlayer(g: Game, input: Input, P: Record<string, boolean>, ev: Ev) {
  const p = g.player, T = g.tuning, map = g.map;
  if (p.fallWait > 0) {
    p.fallWait--;
    if (p.fallWait === 0) {
      p.pos = [...map.start] as Vec3;
      p.vel = [0, 0, 0];
      p.grounded = true;
      p.launched = null;
      p.dashTicks = 0;
      p.invulnTicks = C.RESPAWN_INVULN_TICKS;
    }
    return;
  }

  let [mx, mz] = input.move;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  const th = (input.cam_yaw_deg * Math.PI) / 180;
  const wx = mx * Math.cos(th) + mz * Math.sin(th);
  const wz = -mx * Math.sin(th) + mz * Math.cos(th);
  const wl = Math.hypot(wx, wz);
  if (wl > C.EPS) p.facing = [wx / wl, wz / wl];

  if (P.dash && p.dashTicks === 0 && (p.dashCdTicks === 0 || p.charmTicks > 0)) {
    p.dashTicks = secToTicks(T.dash_duration_s);
    p.dashDir = wl > C.EPS ? [wx / wl, wz / wl] : [p.facing[0], p.facing[1]];
    p.dashCdTicks = p.charmTicks > 0 ? 0 : secToTicks(T.dash_cooldown_s);
    ev('dash', {});
  }
  if (P.jump && p.grounded && p.dashTicks === 0) { p.vel[1] = C.JUMP_VELOCITY; p.grounded = false; }

  let vx: number, vz: number;
  const dashing = p.dashTicks > 0;
  if (dashing) {
    vx = p.dashDir[0] * T.dash_speed;
    vz = p.dashDir[1] * T.dash_speed;
    p.dashTicks--;
    p.vel[1] = 0; // lướt trên không giữ nguyên độ cao
  } else {
    if (p.launched) { [vx, vz] = p.launched; } else {
      const sp = p.charmTicks > 0 ? C.CHARM_SPEED : T.player_speed;
      vx = wx * sp;
      vz = wz * sp;
    }
    if (!p.grounded) p.vel[1] -= C.GRAVITY / C.TICK_RATE;
  }
  if (g.wind.ticks > 0) {
    const a = (g.wind.dirDeg * Math.PI) / 180;
    vx += Math.cos(a) * C.WIND_SPEED;
    vz += Math.sin(a) * C.WIND_SPEED;
  }
  p.vel[0] = vx;
  p.vel[2] = vz;

  const nx = p.pos[0] + vx / C.TICK_RATE, nz = p.pos[2] + vz / C.TICK_RATE;
  if (!blockedForPlayer(g, nx, nz)) { p.pos[0] = nx; p.pos[2] = nz; }
  else if (!blockedForPlayer(g, nx, p.pos[2])) p.pos[0] = nx;
  else if (!blockedForPlayer(g, p.pos[0], nz)) p.pos[2] = nz;

  if (!p.grounded) p.pos[1] += p.vel[1] / C.TICK_RATE;
  const gr = map.ground(p.pos[0], p.pos[2]);
  if (p.grounded) {
    if (gr === null || gr < p.pos[1] - C.STEP_HEIGHT) p.grounded = false; // bước ra mép
    else p.pos[1] = gr;
  } else if (gr !== null && p.pos[1] <= gr && p.vel[1] <= 0) {
    p.pos[1] = gr; p.vel[1] = 0; p.grounded = true; p.launched = null;
  }

  if (p.grounded && !p.launched) {
    for (const pad of map.pads) {
      if (distXZ(pad.pos, p.pos) <= pad.r && Math.abs(p.pos[1] - pad.pos[1]) <= C.STEP_HEIGHT) {
        p.launched = [pad.dir[0] * pad.vh, pad.dir[1] * pad.vh];
        p.vel[1] = pad.vy;
        p.grounded = false;
        break;
      }
    }
  }

  if (T.fall_enabled && p.pos[1] < C.FALL_Y) {
    const lost = p.carried;
    p.carried = 0;
    p.flames = Math.max(0, p.flames - 1);
    p.fallWait = C.FALL_WAIT_TICKS;
    p.vel = [0, 0, 0];
    p.dashTicks = 0;
    p.launched = null;
    ev('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
  }
}

// ---------- Thực thể khác ----------
function inLitZone(g: Game, pos: Vec3, except = -1): number {
  const R = g.tuning.safe_radius;
  for (let i = 0; i < g.lanterns.length; i++) {
    const l = g.lanterns[i];
    if (i !== except && l.lit && distXZ(l.pos, pos) < R - 1e-9) return i;
  }
  return -1;
}

function settleY(g: Game, e: { pos: Vec3; hover: number }) {
  const gr = g.map.ground(e.pos[0], e.pos[2]);
  if (gr !== null) e.pos[1] = gr + e.hover;
}

function towerPush(g: Game, pos: Vec3) {
  const t = g.map.tower;
  if (!t) return;
  const d = Math.hypot(pos[0] - t.x, pos[2] - t.z);
  if (d < t.r) {
    const u = d > C.EPS ? [(pos[0] - t.x) / d, (pos[2] - t.z) / d] : [1, 0];
    pos[0] = t.x + u[0] * t.r;
    pos[2] = t.z + u[1] * t.r;
  }
}

function wanderStep(g: Game, e: { pos: Vec3; home: [number, number]; target: [number, number] }, speed: number) {
  const dx = e.target[0] - e.pos[0], dz = e.target[1] - e.pos[2];
  const d = Math.hypot(dx, dz);
  const st = speed / C.TICK_RATE;
  if (d <= st) {
    e.pos[0] = e.target[0];
    e.pos[2] = e.target[1];
    const a = g.rng.range(0, Math.PI * 2), r = g.rng.range(0, C.WANDER_RADIUS);
    e.target = [e.home[0] + r * Math.cos(a), e.home[1] + r * Math.sin(a)];
  } else {
    e.pos[0] += (dx / d) * st;
    e.pos[2] += (dz / d) * st;
  }
}

function dropMotes(g: Game, at: Vec3, n: number, ring: boolean) {
  for (let i = 0; i < n; i++) {
    let x = at[0], z = at[2];
    if (ring) {
      const a = g.rng.range(0, Math.PI * 2), r = g.rng.range(C.DROP_RING_MIN, C.DROP_RING_MAX);
      x += r * Math.cos(a);
      z += r * Math.sin(a);
    }
    const gr = g.map.ground(x, z);
    g.motes.push({ id: `M${g.nextMoteId++}`, pos: [x, gr ?? at[1], z], kind: 'dropped', ttl: C.DROPPED_TTL_TICKS, spawnIdx: -1 });
  }
}

function endGame(g: Game, result: 'won' | 'lost', reason: string, ev: Ev) {
  g.state = result;
  if (result === 'won') {
    const s = g.tuning.score;
    g.score += s.per_second_left * Math.floor(Math.max(0, timeLeft(g)) + C.EPS) + s.per_flame_left * g.player.flames;
  }
  ev('game_over', { result, reason });
}

/** Một bước: đọc input tick k, tạo trạng thái k+1. Sự kiện ghi tick = k+1. */
export function step(g: Game, input: Input): GameEvent[] {
  const events: GameEvent[] = [];
  if (g.state !== 'playing') return events;
  g.tick += 1;
  const T = g.tuning, p = g.player;
  const ev: Ev = (name, data) => events.push({ tick: g.tick, name, data });

  // 1. Input (pause trước)
  const P: Record<string, boolean> = {};
  for (const k of ['jump', 'interact', 'pulse', 'dash', 'pause'] as const) P[k] = input[k] && !g.prev[k];
  g.prev = { jump: input.jump, interact: input.interact, pulse: input.pulse, dash: input.dash, pause: input.pause };
  if (P.pause) {
    if (!g.paused) { g.paused = true; ev('paused', {}); return events; }
    g.paused = false;
    ev('resumed', {});
  } else if (g.paused) return events;
  g.simTick += 1;

  // 2. Bộ đếm
  if (p.invulnTicks > 0) p.invulnTicks--;
  if (p.pulseCdTicks > 0) p.pulseCdTicks--;
  if (p.dashCdTicks > 0) p.dashCdTicks--;
  if (p.charmTicks > 0) p.charmTicks--;
  for (const s of g.shades) {
    if ((s.state === 'spawning' || s.state === 'stunned' || s.state === 'recoil') && --s.stateTicks <= 0) {
      s.stateTicks = 0;
      const d = distXZ(s.pos, p.pos);
      const lim = s.state === 'spawning' ? C.SHADE_DETECT : C.SHADE_LOSE;
      s.state = p.fallWait === 0 && d <= lim ? 'chase' : 'wander';
      s.pushTicks = 0;
    }
  }
  for (let i = g.motes.length - 1; i >= 0; i--) {
    const m = g.motes[i];
    if (m.kind === 'dropped' && --m.ttl <= 0) g.motes.splice(i, 1);
  }
  for (const c of g.charms) if (!c.available && --c.respawnTicks <= 0) { c.available = true; c.respawnTicks = 0; }
  for (const d of g.drifters) if (d.state === 'flee' && --d.fleeTicks <= 0) { d.state = 'removed'; d.fleeTicks = 0; }
  if (g.wind.ticks > 0) g.wind.ticks--;

  // 3. Di chuyển Mây + rơi
  movePlayer(g, input, P, ev);
  const active = p.fallWait === 0;

  // 4. Nhặt đom đóm và bùa
  if (active) {
    for (let i = 0; i < g.motes.length && p.carried < T.carry_capacity; ) {
      const m = g.motes[i];
      if (distXZ(m.pos, p.pos) <= T.pickup_radius && Math.abs(p.pos[1] - m.pos[1]) <= C.PICKUP_DY) {
        g.motes.splice(i, 1);
        p.carried++;
        ev('mote_picked', { carried: p.carried });
      } else i++;
    }
    for (const c of g.charms) {
      if (c.available && distXZ(c.pos, p.pos) <= T.pickup_radius && Math.abs(p.pos[1] - c.pos[1]) <= C.PICKUP_DY) {
        c.available = false;
        c.respawnTicks = C.CHARM_RESPAWN_TICKS;
        p.charmTicks = C.CHARM_TICKS;
        ev('charm_picked', { charm_id: c.id, charm_ticks: C.CHARM_TICKS });
      }
    }
  }

  // 5. Tương tác với đèn
  const newlyLit: number[] = [];
  if (active && P.interact && p.carried > 0) {
    let best = -1, bestD = Infinity;
    g.lanterns.forEach((l, i) => {
      if (l.lit) return;
      const d = distXZ(l.pos, p.pos);
      if (d <= T.interact_radius && d < bestD) { best = i; bestD = d; } // bằng nhau giữ id nhỏ hơn
    });
    if (best >= 0) {
      const l = g.lanterns[best];
      const amount = Math.min(p.carried, Math.max(0, T.lantern_cost - l.deposited));
      if (amount > 0) {
        p.carried -= amount;
        l.deposited += amount;
        g.score += T.score.per_mote * amount;
        ev('deposit', { lantern_id: l.id, amount, deposited: l.deposited });
      }
      if (l.deposited >= T.lantern_cost) {
        l.lit = true;
        g.score += T.score.per_lantern;
        ev('lantern_lit', { lantern_id: l.id });
        newlyLit.push(best);
      }
    }
  }

  // 6. Vùng an toàn: Bóng Mực đang ở trong đèn vừa thắp bị đẩy ra trong tối đa 30 tick
  for (const i of newlyLit) {
    for (const s of g.shades) {
      if (distXZ(s.pos, g.lanterns[i].pos) < T.safe_radius) { s.evictTicks = C.SAFE_EVICT_TICKS; s.evictFrom = i; }
    }
  }

  // 7. Tỏa Sáng
  if (active && P.pulse && p.pulseCdTicks === 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCdTicks = secToTicks(T.pulse_cooldown_s);
    const c: Vec3 = [p.pos[0], p.pos[1] + C.PULSE_CENTER_Y, p.pos[2]];
    const ids: string[] = [];
    for (const s of g.shades) {
      if (dist3(c, s.pos) > T.pulse_radius) continue;
      s.state = 'stunned';
      s.stateTicks = secToTicks(T.pulse_stun_s);
      s.pushTicks = C.PULSE_PUSH_TICKS;
      s.dir = unitXZ(p.pos, s.pos);
      g.score += T.score.per_stun;
      ids.push(s.id);
    }
    ev('pulse', { stunned_ids: ids });
    for (const d of g.drifters) {
      if (dist3(c, d.pos) > T.pulse_radius) continue;
      if (d.state === 'chase') { d.state = 'flee'; d.fleeTicks = C.DRIFTER_FLEE_TICKS; }
      else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        dropMotes(g, d.pos, amount, false);
        d.stolen = 0;
        d.fleeTicks = C.DRIFTER_DROP_VANISH_TICKS;
        ev('drifter_drop', { drifter_id: d.id, amount });
      }
    }
  }

  // 8. Bóng Mực và Gió Lạc di chuyển
  const R = T.safe_radius;
  const shadeSpeed = (g.map.shadeSpeed ?? T.shade_speed) / C.TICK_RATE;
  for (const s of g.shades) {
    const d = distXZ(s.pos, p.pos);
    if (s.evictTicks > 0) {
      const L = g.lanterns[s.evictFrom].pos;
      const need = R - distXZ(s.pos, L);
      if (need > 0) {
        const u = unitXZ(L, s.pos);
        s.pos[0] += (u[0] * need) / s.evictTicks;
        s.pos[2] += (u[1] * need) / s.evictTicks;
      }
      s.evictTicks--;
      settleY(g, s);
      continue;
    }
    if (s.state === 'stunned' || s.state === 'recoil') {
      const moving = s.state === 'stunned' ? s.pushTicks > 0 : true;
      if (moving) {
        const stepLen = s.state === 'stunned' ? T.pulse_push_m / C.PULSE_PUSH_TICKS : C.RECOIL_DIST / C.RECOIL_TICKS;
        const np: Vec3 = [s.pos[0] + s.dir[0] * stepLen, s.pos[1], s.pos[2] + s.dir[1] * stepLen];
        const t = g.map.tower;
        const hitsTower = !!t && Math.hypot(np[0] - t.x, np[2] - t.z) < t.r;
        if (inLitZone(g, np) >= 0 || hitsTower) s.pushTicks = 0; // gặp vật cản thì dừng
        else { s.pos[0] = np[0]; s.pos[2] = np[2]; if (s.state === 'stunned') s.pushTicks--; }
      }
    } else if (s.state === 'wander' || s.state === 'chase') {
      if (s.state === 'wander' && active && d <= C.SHADE_DETECT) s.state = 'chase';
      else if (s.state === 'chase' && (!active || d > C.SHADE_LOSE)) s.state = 'wander';
      if (s.state === 'chase') {
        if (d > C.EPS) {
          const m = Math.min(shadeSpeed, d);
          s.pos[0] += ((p.pos[0] - s.pos[0]) / d) * m;
          s.pos[2] += ((p.pos[2] - s.pos[2]) / d) * m;
        }
      } else wanderStep(g, s, C.SHADE_WANDER_SPEED);
      // bị chặn ở mép vùng an toàn
      for (const l of g.lanterns) {
        if (!l.lit) continue;
        const dl = distXZ(s.pos, l.pos);
        if (dl < R) {
          const u = unitXZ(l.pos, s.pos);
          s.pos[0] = l.pos[0] + u[0] * R;
          s.pos[2] = l.pos[2] + u[1] * R;
        }
      }
    }
    towerPush(g, s.pos);
    settleY(g, s);
  }
  for (const dr of g.drifters) {
    if (dr.state === 'removed') continue;
    const d = distXZ(dr.pos, p.pos);
    const wants = active && p.carried >= C.DRIFTER_MIN_CARRY && d <= C.DRIFTER_DETECT;
    if (dr.state === 'idle' && wants) dr.state = 'chase';
    else if (dr.state === 'chase' && !wants) dr.state = 'idle';
    const st = C.DRIFTER_SPEED / C.TICK_RATE;
    if (dr.state === 'idle') wanderStep(g, dr, C.DRIFTER_IDLE_SPEED);
    else if (dr.state === 'chase' && d > C.EPS) {
      const m = Math.min(st, d);
      dr.pos[0] += ((p.pos[0] - dr.pos[0]) / d) * m;
      dr.pos[2] += ((p.pos[2] - dr.pos[2]) / d) * m;
    } else if (dr.state === 'flee') {
      const u = unitXZ(p.pos, dr.pos);
      dr.pos[0] += u[0] * st;
      dr.pos[2] += u[1] * st;
    }
    settleY(g, dr);
  }

  // 9. Chạm: Gió Lạc cướp trước, rồi Bóng Mực
  if (active) {
    for (const dr of g.drifters) {
      if (dr.state !== 'chase' || p.carried <= 0 || distXZ(dr.pos, p.pos) > C.DRIFTER_HIT) continue;
      const amount = Math.min(C.DRIFTER_STEAL, p.carried);
      p.carried -= amount;
      dr.stolen = amount;
      dr.state = 'flee';
      dr.fleeTicks = C.DRIFTER_FLEE_TICKS;
      ev('drifter_steal', { drifter_id: dr.id, amount, carried: p.carried });
    }
    if (p.invulnTicks === 0) {
      for (const s of g.shades) {
        if ((s.state !== 'chase' && s.state !== 'wander') || s.evictTicks > 0) continue;
        if (distXZ(s.pos, p.pos) > T.shade_hit_radius || Math.abs(p.pos[1] - s.pos[1]) > C.SHADE_HIT_DY) continue;
        p.flames = Math.max(0, p.flames - 1);
        const dropped = Math.floor(p.carried * T.hit_drop_ratio + C.EPS);
        p.carried -= dropped;
        dropMotes(g, p.pos, dropped, true);
        p.invulnTicks = secToTicks(T.invuln_s);
        s.state = 'recoil';
        s.stateTicks = C.RECOIL_TICKS + 1;
        s.dir = unitXZ(p.pos, s.pos);
        ev('player_hit', { by: 'shade', flames: p.flames, dropped });
        break;
      }
    }
  }

  // 10. Sinh theo lịch (thực thể mới tương tác từ tick sau)
  const st = g.simTick;
  if (g.randomMotes && st % C.MOTE_RESPAWN_TICKS === 0 && g.motes.length < C.MAX_MOTES) {
    const used = new Set(g.motes.filter((m) => m.kind === 'random').map((m) => m.spawnIdx));
    const free = g.map.moteSpawns.map((_, i) => i).filter((i) => !used.has(i));
    if (free.length) {
      const k = free[pickIndex(g.rng, free.length)];
      g.motes.push({ id: `M${g.nextMoteId++}`, pos: [...g.map.moteSpawns[k]] as Vec3, kind: 'random', ttl: 0, spawnIdx: k });
    }
  }
  if (g.randomShades) {
    let n = 0;
    if (st === C.SHADE_FIRST_SPAWN_TICK) n = 2;
    else if (st > C.SHADE_FIRST_SPAWN_TICK && (st - C.SHADE_FIRST_SPAWN_TICK) % g.map.shadeIntervalTicks === 0) n = 1;
    const valid = g.map.shadeSpawns.filter((pt) => distXZ(pt, p.pos) >= C.SHADE_SPAWN_MIN_DIST && inLitZone(g, pt) < 0);
    for (let i = 0; i < n && g.shades.length < g.map.shadeMax && valid.length; i++) {
      const pt = valid.splice(pickIndex(g.rng, valid.length), 1)[0];
      const s = makeShade(g, `S${g.nextShadeId++}`, pt, 'spawning');
      g.shades.push(s);
      ev('shade_spawned', { id: s.id });
    }
  }
  if (g.map.drifters && g.randomDrifters && st % C.DRIFTER_SPAWN_TICKS === 0) {
    if (g.drifters.filter((d) => d.state !== 'removed').length < C.DRIFTER_MAX) {
      const pts = g.map.shadeSpawns;
      g.drifters.push(makeDrifter(g, `D${g.nextDrifterId++}`, pts[pickIndex(g.rng, pts.length)]));
    }
  }
  if (g.map.wind && g.windEnabled && st % C.WIND_PERIOD_TICKS === 0) {
    g.wind = { ticks: C.WIND_DURATION_TICKS, dirDeg: Math.floor(g.rng.next() * 360) };
  }

  // 11. Thắng / thua
  if (p.flames <= 0) endGame(g, 'lost', 'no_flames', ev);
  else if (g.lanterns.every((l) => l.lit)) endGame(g, 'won', 'all_lit', ev);
  else if (timeLeft(g) <= C.EPS) endGame(g, 'lost', 'dawn', ev);
  return events;
}

/** Số tick còn tới cơn gió kế tiếp (cho phần hiển thị báo trước). */
export function ticksToNextWind(g: Game): number {
  if (!g.map.wind || !g.windEnabled) return Infinity;
  return C.WIND_PERIOD_TICKS - (g.simTick % C.WIND_PERIOD_TICKS);
}
