// Kiểm tra file scenario / inputs (Contract v1.1). Sai định dạng -> InputError (CLI thoát mã 2).
import type { Scenario, Vec3, ShadeState, DrifterState } from '../core/types.js';

export class InputError extends Error {}

const SHADE_STATES: ShadeState[] = ['spawning', 'wander', 'chase', 'recoil', 'stunned'];
const DRIFTER_STATES: DrifterState[] = ['idle', 'chase', 'flee', 'removed'];

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
function arr(v: unknown, where: string): unknown[] {
  if (!Array.isArray(v)) throw new InputError(`${where}: cần mảng`);
  return v;
}
function uniqueId(v: unknown, ids: Set<string>, where: string): string {
  if (typeof v !== 'string' || v === '' || ids.has(v)) throw new InputError(`${where}: cần chuỗi không trùng`);
  ids.add(v);
  return v;
}
function oneOf<T extends string>(v: unknown, list: T[], where: string): T {
  if (!list.includes(v as T)) throw new InputError(`${where}: phải là ${list.join('/')}`);
  return v as T;
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
    for (const k of ['invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks'] as const) {
      if (p[k] !== undefined) sc.player[k] = int(p[k], `scenario.player.${k}`);
    }
  }
  for (const k of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled'] as const) {
    if (raw[k] !== undefined) sc[k] = bool(raw[k], `scenario.${k}`);
  }
  if (raw.motes !== undefined) {
    sc.motes = arr(raw.motes, 'scenario.motes').map((m, i) => vec3(isObj(m) ? m.pos : m, `scenario.motes[${i}]`));
  }
  if (raw.shades !== undefined) {
    const ids = new Set<string>();
    sc.shades = arr(raw.shades, 'scenario.shades').map((s, i) => {
      const w = `scenario.shades[${i}]`;
      if (!isObj(s)) throw new InputError(`${w}: cần object`);
      const out: NonNullable<Scenario['shades']>[number] = { pos: vec3(s.pos, `${w}.pos`) };
      if (s.id !== undefined) out.id = uniqueId(s.id, ids, `${w}.id`);
      if (s.state !== undefined) out.state = oneOf(s.state, SHADE_STATES, `${w}.state`);
      if (s.state_ticks_left !== undefined) out.state_ticks_left = int(s.state_ticks_left, `${w}.state_ticks_left`);
      return out;
    });
  }
  if (raw.drifters !== undefined) {
    const ids = new Set<string>();
    sc.drifters = arr(raw.drifters, 'scenario.drifters').map((d, i) => {
      const w = `scenario.drifters[${i}]`;
      if (!isObj(d)) throw new InputError(`${w}: cần object`);
      const out: NonNullable<Scenario['drifters']>[number] = { pos: vec3(d.pos, `${w}.pos`) };
      if (d.id !== undefined) out.id = uniqueId(d.id, ids, `${w}.id`);
      if (d.state !== undefined) out.state = oneOf(d.state, DRIFTER_STATES, `${w}.state`);
      if (d.stolen !== undefined) out.stolen = int(d.stolen, `${w}.stolen`);
      return out;
    });
  }
  if (raw.charms !== undefined) {
    const ids = new Set<string>();
    sc.charms = arr(raw.charms, 'scenario.charms').map((c, i) => {
      const w = `scenario.charms[${i}]`;
      if (!isObj(c)) throw new InputError(`${w}: cần object`);
      const out: NonNullable<Scenario['charms']>[number] = {};
      if (c.id !== undefined) out.id = uniqueId(c.id, ids, `${w}.id`);
      if (c.pos !== undefined) out.pos = vec3(c.pos, `${w}.pos`);
      if (c.available !== undefined) out.available = bool(c.available, `${w}.available`);
      return out;
    });
  }
  if (raw.lanterns !== undefined) {
    sc.lanterns = arr(raw.lanterns, 'scenario.lanterns').map((l, i) => {
      const w = `scenario.lanterns[${i}]`;
      if (!isObj(l)) throw new InputError(`${w}: cần object`);
      const n = typeof l.id === 'string' ? /^L(\d+)$/.exec(l.id) : null;
      if (!n || +n[1] < 1 || +n[1] > lanternCount) throw new InputError(`${w}.id: phải là L1..L${lanternCount}`);
      const out: NonNullable<Scenario['lanterns']>[number] = { id: l.id as string };
      if (l.pos !== undefined) out.pos = vec3(l.pos, `${w}.pos`);
      if (l.lit !== undefined) out.lit = bool(l.lit, `${w}.lit`);
      if (l.deposited !== undefined) out.deposited = int(l.deposited, `${w}.deposited`);
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
  pause?: boolean;
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
    for (const k of ['jump', 'interact', 'pulse', 'dash', 'pause'] as const) {
      if (f[k] !== undefined) out[k] = bool(f[k], `${w}.${k}`);
    }
    return out;
  });
}
