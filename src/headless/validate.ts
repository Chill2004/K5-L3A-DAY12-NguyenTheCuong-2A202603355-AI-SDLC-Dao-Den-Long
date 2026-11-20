// Kiểm tra file scenario / inputs. Sai định dạng -> InputError (CLI thoát mã 2).
import type { Scenario, Vec3 } from '../core/types.js';

export class InputError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function vec3(v: unknown, where: string): Vec3 {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) throw new InputError(`${where}: cần mảng 3 số [x, y, z]`);
  return [v[0], v[1], v[2]];
}
function bool(v: unknown, where: string): boolean {
  if (typeof v !== 'boolean') throw new InputError(`${where}: cần boolean`);
  return v;
}
function int(v: unknown, where: string, min = 0): number {
  if (!isNum(v) || !Number.isInteger(v) || v < min) throw new InputError(`${where}: cần số nguyên >= ${min}`);
  return v;
}

export function parseScenario(raw: unknown, lanternCount: number): Scenario {
  if (!isObj(raw)) throw new InputError('scenario: cần một object JSON');
  const sc: Scenario = {};
  if (raw.player !== undefined) {
    if (!isObj(raw.player)) throw new InputError('scenario.player: cần object');
    const p = raw.player;
    sc.player = {};
    if (p.pos !== undefined) sc.player.pos = vec3(p.pos, 'scenario.player.pos');
    if (p.carried !== undefined) sc.player.carried = int(p.carried, 'scenario.player.carried');
    if (p.flames !== undefined) sc.player.flames = int(p.flames, 'scenario.player.flames', 1);
  }
  if (raw.random_motes !== undefined) sc.random_motes = bool(raw.random_motes, 'scenario.random_motes');
  if (raw.random_shades !== undefined) sc.random_shades = bool(raw.random_shades, 'scenario.random_shades');
  if (raw.motes !== undefined) {
    if (!Array.isArray(raw.motes)) throw new InputError('scenario.motes: cần mảng');
    sc.motes = raw.motes.map((m, i) => vec3(isObj(m) ? m.pos : m, `scenario.motes[${i}]`));
  }
  if (raw.shades !== undefined) {
    if (!Array.isArray(raw.shades)) throw new InputError('scenario.shades: cần mảng');
    const ids = new Set<string>();
    sc.shades = raw.shades.map((s, i) => {
      if (!isObj(s)) throw new InputError(`scenario.shades[${i}]: cần object`);
      const out: { id?: string; pos: Vec3 } = { pos: vec3(s.pos, `scenario.shades[${i}].pos`) };
      if (s.id !== undefined) {
        if (typeof s.id !== 'string' || s.id === '' || ids.has(s.id)) throw new InputError(`scenario.shades[${i}].id: cần chuỗi không trùng`);
        ids.add(s.id);
        out.id = s.id;
      }
      return out;
    });
  }
  if (raw.lanterns !== undefined) {
    if (!Array.isArray(raw.lanterns)) throw new InputError('scenario.lanterns: cần mảng');
    sc.lanterns = raw.lanterns.map((l, i) => {
      if (!isObj(l)) throw new InputError(`scenario.lanterns[${i}]: cần object`);
      const n = typeof l.id === 'string' ? /^L(\d+)$/.exec(l.id) : null;
      if (!n || +n[1] < 1 || +n[1] > lanternCount) throw new InputError(`scenario.lanterns[${i}].id: phải là L1..L${lanternCount}`);
      const out: { id: string; pos?: Vec3; lit?: boolean; deposited?: number } = { id: l.id as string };
      if (l.pos !== undefined) out.pos = vec3(l.pos, `scenario.lanterns[${i}].pos`);
      if (l.lit !== undefined) out.lit = bool(l.lit, `scenario.lanterns[${i}].lit`);
      if (l.deposited !== undefined) out.deposited = int(l.deposited, `scenario.lanterns[${i}].deposited`);
      return out;
    });
  }
  if (raw.time_left_s !== undefined) {
    if (!isNum(raw.time_left_s) || raw.time_left_s <= 0) throw new InputError('scenario.time_left_s: cần số > 0');
    sc.time_left_s = raw.time_left_s;
  }
  return sc;
}

export interface Frame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
}

export function parseInputs(raw: unknown): Frame[] {
  const list = Array.isArray(raw) ? raw : isObj(raw) ? raw.frames : undefined;
  if (!Array.isArray(list)) throw new InputError('inputs: cần object có mảng "frames"');
  let last = -1;
  return list.map((f, i) => {
    const w = `inputs.frames[${i}]`;
    if (!isObj(f)) throw new InputError(`${w}: cần object`);
    const tick = int(f.tick, `${w}.tick`);
    if (tick <= last) throw new InputError(`${w}.tick: phải tăng nghiêm ngặt`);
    last = tick;
    const out: Frame = { tick };
    if (f.move !== undefined) {
      if (!Array.isArray(f.move) || f.move.length !== 2 || !f.move.every(isNum)) throw new InputError(`${w}.move: cần [x, z]`);
      // Giả định: thành phần ngoài [-1, 1] được kẹp lại (không coi là lỗi).
      out.move = [Math.max(-1, Math.min(1, f.move[0])), Math.max(-1, Math.min(1, f.move[1]))];
    }
    if (f.cam_yaw_deg !== undefined) {
      if (!isNum(f.cam_yaw_deg)) throw new InputError(`${w}.cam_yaw_deg: cần số`);
      out.cam_yaw_deg = f.cam_yaw_deg;
    }
    for (const k of ['jump', 'interact', 'pulse', 'dash'] as const) {
      if (f[k] !== undefined) out[k] = bool(f[k], `${w}.${k}`);
    }
    return out;
  });
}
