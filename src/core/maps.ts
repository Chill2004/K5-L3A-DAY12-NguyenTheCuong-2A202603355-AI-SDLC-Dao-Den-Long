// Bản đồ chuẩn của 3 Đêm (Ticket-02 Phần 2). Góc đo từ +X: điểm = (r·cosθ, y, r·sinθ).
import type { Vec3 } from './types.js';

export interface Pad { pos: Vec3; r: number; vy: number; vh: number; dir: [number, number] }
export interface MapDef {
  night: number;
  name: string;
  start: Vec3;
  lanterns: Vec3[];
  moteSpawns: Vec3[];
  shadeSpawns: Vec3[]; // tâm Bóng Mực (mặt đất + 1 m); cũng là "điểm sương" cho Gió Lạc
  shadeIntervalTicks: number;
  shadeMax: number;
  shadeSpeed: number | null; // null = dùng tuning.shade_speed
  pads: Pad[];
  charms: Vec3[];
  drifters: boolean;
  wind: boolean;
  tower: { x: number; z: number; r: number; top: number } | null;
  /** Độ cao mặt đất tại (x, z); null = biển mây (rơi). */
  ground(x: number, z: number): number | null;
}

const deg = (d: number) => (d * Math.PI) / 180;
const ring = (cx: number, cz: number, r: number, angles: number[], y = 0): Vec3[] =>
  angles.map((a) => [round(cx + r * Math.cos(deg(a))), y, round(cz + r * Math.sin(deg(a)))] as Vec3);
const round = (v: number) => Math.round(v * 1e6) / 1e6;
const steps = (start: number, step: number, n: number) => Array.from({ length: n }, (_, i) => start + i * step);

function unit(dx: number, dz: number): [number, number] {
  const l = Math.hypot(dx, dz);
  return [dx / l, dz / l];
}

const night1: MapDef = {
  night: 1,
  name: 'Đảo Bến',
  start: [0, 0, 0],
  lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
  moteSpawns: [...ring(0, 0, 12, steps(0, 45, 8)), ...ring(0, 0, 33, steps(0, 22.5, 16))],
  shadeSpawns: ring(0, 0, 37, steps(15, 30, 12), 1),
  shadeIntervalTicks: 480,
  shadeMax: 6,
  shadeSpeed: null,
  pads: [],
  charms: [],
  drifters: false,
  wind: false,
  tower: null,
  ground: (x, z) => (Math.hypot(x, z) <= 40 ? 0 : null),
};

const night2: MapDef = {
  night: 2,
  name: 'Đảo Cau',
  start: [0, 0, 0],
  lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
  moteSpawns: [0, 70].flatMap((cx) => [...ring(cx, 0, 10, [0, 90, 180, 270]), ...ring(cx, 0, 22, steps(0, 45, 8))]),
  shadeSpawns: [0, 70].flatMap((cx) => ring(cx, 0, 26, steps(22.5, 45, 8), 1)),
  shadeIntervalTicks: 420,
  shadeMax: 8,
  shadeSpeed: null,
  pads: [
    { pos: [20, 0, 18], r: 1, vy: 14, vh: 24, dir: unit(70 - 20, 0 - 18) },
    { pos: [50, 0, -18], r: 1, vy: 14, vh: 24, dir: unit(0 - 50, 0 + 18) },
  ],
  charms: [[35, 0, 0]],
  drifters: true,
  wind: false,
  tower: null,
  ground: (x, z) => {
    if (Math.hypot(x, z) <= 28 || Math.hypot(x - 70, z) <= 28) return 0;
    if (x >= 26 && x <= 44 && z >= -2 && z <= 2) return 0;
    return null;
  },
};

function ramp3(x: number, z: number): number | null {
  for (const a of [30, 150]) {
    const ux = Math.cos(deg(a)), uz = Math.sin(deg(a));
    const s = x * ux + z * uz; // khoảng cách dọc bán kính
    const t = Math.abs(-x * uz + z * ux); // lệch ngang
    if (t <= 1.5 && s >= 24 && s <= 30) return (3 * (30 - s)) / 6;
  }
  return null;
}

const night3: MapDef = {
  night: 3,
  name: 'Đảo Chuông',
  start: [0, 0, -30], // GĐ: ticket không nêu; (0,0,0) nằm trong tháp chuông

  lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
  moteSpawns: [
    ...ring(0, 0, 34, steps(0, 20, 18), 0),
    ...ring(0, 0, 18, steps(20, 20, 8), 3),
    ...ring(0, 0, 5, [45, 135, 225, 315], 6),
  ],
  shadeSpawns: ring(0, 0, 43, steps(0, 22.5, 16), 1),
  shadeIntervalTicks: 360,
  shadeMax: 10,
  shadeSpeed: 4.5,
  pads: [{ pos: [0, 3, 13], r: 1, vy: 12, vh: 8, dir: [0, -1] }],
  charms: [[30, 0, 25], [-30, 0, 25]],
  drifters: true,
  wind: true,
  tower: { x: 0, z: 0, r: 2, top: 14 },
  ground: (x, z) => {
    const r = Math.hypot(x, z);
    if (r > 45) return null;
    if (r <= 8) return 6;
    if (r >= 12 && r <= 24 && z > 0) return 3;
    const rp = ramp3(x, z);
    return rp ?? 0;
  },
};

export const MAPS: Record<number, MapDef> = { 1: night1, 2: night2, 3: night3 };
