// Chạy mô phỏng headless và tạo các dòng JSONL theo Test Contract v1.0 mục E.
import { createGame, step, timeLeft, type Game } from '../core/sim.js';
import { NEUTRAL_INPUT, type Input, type Scenario, type Tuning, type Vec3 } from '../core/types.js';
import type { Frame } from './validate.js';

export interface RunOptions {
  tuning: Tuning;
  seed: number;
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

export function snapshot(g: Game) {
  return {
    type: 'snapshot',
    tick: g.tick,
    sim_tick: g.tick,
    state: g.state,
    time_left_s: r3(Math.max(0, timeLeft(g))),
    score: g.score,
    player: { pos: v3(g.player.pos), flames: g.player.flames, carried: g.player.carried },
    lanterns: g.lanterns.map((l) => ({ id: l.id, pos: v3(l.pos), lit: l.lit, deposited: l.deposited })),
    shades: g.shades.map((s) => ({ id: s.id, pos: v3(s.pos), state: s.state })),
    motes_active: g.motes.length,
    motes: g.motes.map((m) => ({ id: m.id, pos: v3(m.pos) })),
  };
}

export function runHeadless(o: RunOptions): string[] {
  const every = o.snapshotEvery ?? 10;
  const g = createGame(o.tuning, o.seed, o.scenario ?? {});
  const frames = o.frames ?? [];
  const input: Input = { ...NEUTRAL_INPUT, move: [0, 0] };
  const lines: string[] = [JSON.stringify(snapshot(g))];
  let fi = 0;
  for (let k = 0; k < o.ticks && g.state === 'playing'; k++) {
    while (fi < frames.length && frames[fi].tick <= k) {
      const f = frames[fi++];
      if (f.move) input.move = [f.move[0], f.move[1]];
      if (f.cam_yaw_deg !== undefined) input.cam_yaw_deg = f.cam_yaw_deg;
      for (const key of ['jump', 'interact', 'pulse', 'dash'] as const) if (f[key] !== undefined) input[key] = f[key]!;
    }
    for (const e of step(g, input)) lines.push(JSON.stringify({ type: 'event', tick: e.tick, name: e.name, data: e.data }));
    if (g.tick % every === 0) lines.push(JSON.stringify(snapshot(g)));
  }
  lines.push(JSON.stringify({ type: 'end', ticks: g.tick, state: g.state, score: g.score }));
  return lines;
}
