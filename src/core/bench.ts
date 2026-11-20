// Cảnh benchmark chuẩn (Ticket-04 mục 1): Đêm 1, 200 Bóng Mực wander + 100 đom đóm rải đều theo seed, L1–L3 sáng fuel 100.
import { Rng } from './rng.js';
import { createGame, type Game } from './sim.js';
import type { Tuning, Vec3 } from './types.js';

export const BENCH_SHADES = 200;
export const BENCH_MOTES = 100;
const SPREAD_R = 38; // rải đều trên đĩa bán kính 38 m (trong đảo 40 m)

function uniformDisc(rng: Rng, y: number): Vec3 {
  const a = rng.range(0, Math.PI * 2);
  const r = SPREAD_R * Math.sqrt(rng.next()); // phân bố đều theo diện tích
  return [r * Math.cos(a), y, r * Math.sin(a)];
}

export function createBenchGame(tuning: Tuning, seed = 42): Game {
  const rng = new Rng(seed ^ 0x5eed);
  const shades = Array.from({ length: BENCH_SHADES }, () => ({ pos: uniformDisc(rng, 1), state: 'wander' as const }));
  const motes = Array.from({ length: BENCH_MOTES }, () => uniformDisc(rng, 0));
  const g = createGame(tuning, seed, 1, {
    random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
    player: { pos: [0, 0, 0] },
    shades, motes,
    lanterns: [{ id: 'L1', lit: true, fuel: 100 }, { id: 'L2', lit: true, fuel: 100 }, { id: 'L3', lit: true, fuel: 100 }],
  });
  g.bench = true;
  return g;
}

/** Thống kê theo định nghĩa của Ticket-04 từ danh sách dt (ms). */
export function benchStats(dts: number[]) {
  const n = dts.length;
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * n));
  const worst = sorted.slice(n - k);
  const p95idx = Math.min(n - 1, Math.max(0, Math.ceil(0.95 * n) - 1)); // phân vị 95 (nearest-rank)
  return {
    frames: n,
    avg_fps: n ? round1((1000 * n) / sum) : 0,
    p1_low_fps: n ? round1(1000 / (worst.reduce((a, b) => a + b, 0) / k)) : 0,
    frame_ms_p95: n ? round1(sorted[p95idx]) : 0,
  };
}
const round1 = (v: number) => Math.round(v * 10) / 10;
