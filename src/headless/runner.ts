// Chạy mô phỏng headless và tạo các dòng JSONL theo Test Contract v1.1 mục E.
import { createGame, step, timeLeft, capacity, type Game } from '../core/sim.js';
import { NEUTRAL_INPUT, type Input, type Scenario, type Tuning, type Vec3 } from '../core/types.js';
import type { Frame } from './validate.js';

export interface RunOptions {
  tuning: Tuning;
  seed: number;
  night?: number;
  scenario?: Scenario;
  frames?: Frame[];
  ticks: number;
  snapshotEvery?: number;
}

const r3 = (n: number) => {
  const v = Math.round(n * 1000) / 1000;
  return Object.is(v, -0) ? 0 : v;
};
const v3 = (p: Vec3) => [r3(p[0]), r3(p[1]), r3(p[2])];
const sec = (ticks: number) => r3(ticks / 60);

export function snapshot(g: Game) {
  const p = g.player;
  return {
    type: 'snapshot',
    tick: g.tick,
    sim_tick: g.simTick,
    night: g.night,
    state: g.paused && g.state === 'playing' ? 'paused' : g.state,
    time_left_s: r3(Math.max(0, timeLeft(g))),
    score: g.score,
    wind: { active: g.wind.ticks > 0, dir_deg: g.wind.dirDeg },
    player: {
      pos: v3(p.pos), vel: v3(p.vel), grounded: p.grounded, flames: p.flames, carried: p.carried, capacity: capacity(g),
      invuln: p.invulnTicks > 0, dash_cd_s: sec(p.dashCdTicks), pulse_cd_s: sec(p.pulseCdTicks), charm_s: sec(p.charmTicks),
    },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: v3(l.pos), lit: l.lit, deposited: l.deposited,
      fuel: l.lit ? Math.round((l.fuel / 60) * 10) / 10 : 0, ever_lit: l.everLit, relit_count: l.relitCount })),
    shades: g.shades.map((s) => ({ id: s.id, pos: v3(s.pos), state: s.state })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: v3(m.pos), kind: m.kind, ttl_s: m.kind === 'dropped' ? sec(m.ttl) : null })),
    drifters: g.drifters.map((d) => ({ id: d.id, pos: v3(d.pos), state: d.state, stolen: d.stolen })),
    charms: g.charms.map((c) => ({ id: c.id, pos: v3(c.pos), available: c.available, respawn_s: sec(c.respawnTicks) })),
  };
}

export function runHeadless(o: RunOptions): string[] {
  const every = o.snapshotEvery ?? 10;
  const night = o.night ?? 1;
  const g = createGame(o.tuning, o.seed, night, o.scenario ?? {});
  const frames = o.frames ?? [];
  const input: Input = { ...NEUTRAL_INPUT, move: [0, 0] };
  const lines: string[] = [
    JSON.stringify(snapshot(g)),
    JSON.stringify({ type: 'event', tick: 0, name: 'night_start', data: { night } }),
  ];
  let fi = 0;
  for (let k = 0; k < o.ticks && g.state === 'playing'; k++) {
    while (fi < frames.length && frames[fi].tick <= k) {
      const f = frames[fi++];
      if (f.move) input.move = [f.move[0], f.move[1]];
      if (f.cam_yaw_deg !== undefined) input.cam_yaw_deg = f.cam_yaw_deg;
      for (const key of ['jump', 'interact', 'pulse', 'dash', 'pause'] as const) if (f[key] !== undefined) input[key] = f[key]!;
    }
    for (const e of step(g, input)) lines.push(JSON.stringify({ type: 'event', tick: e.tick, name: e.name, data: e.data }));
    if (g.tick % every === 0) lines.push(JSON.stringify(snapshot(g)));
  }
  lines.push(JSON.stringify({ type: 'end', ticks: g.tick, state: g.state, score: g.score }));
  return lines;
}
