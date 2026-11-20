// Kiểu dữ liệu dùng chung cho logic game (không phụ thuộc DOM/Three.js).

export type Vec3 = [number, number, number];

export interface ScoreTuning {
  per_mote: number;
  per_lantern: number;
  per_stun: number;
  per_second_left: number;
  per_flame_left: number;
}

/** Khớp 1-1 với `tuning` trong game.contract.json (Contract v1.1). */
export interface Tuning {
  player_speed: number;
  carry_capacity: number;
  lantern_cost: number;
  lantern_count_night1: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
  night2_duration_s: number;
  night3_duration_s: number;
  flames: number;
  invuln_s: number;
  hit_drop_ratio: number;
  pulse_stun_s: number;
  pulse_push_m: number;
  pulse_cooldown_s: number;
  safe_radius: number;
  shade_speed: number;
  shade_hit_radius: number;
  dash_speed: number;
  dash_duration_s: number;
  dash_cooldown_s: number;
  fall_enabled: boolean;
  score: ScoreTuning;
}

export type MoteKind = 'random' | 'dropped';
export interface Mote { id: string; pos: Vec3; kind: MoteKind; ttl: number; spawnIdx: number }

export type ShadeState = 'spawning' | 'wander' | 'chase' | 'recoil' | 'stunned';
export interface Shade {
  id: string;
  pos: Vec3;
  hover: number;
  state: ShadeState;
  stateTicks: number;
  pushTicks: number;
  dir: [number, number]; // hướng đẩy lùi / lùi lại
  evictTicks: number;
  evictFrom: number; // index đèn đang đẩy ra
  home: [number, number];
  target: [number, number];
}

export type DrifterState = 'idle' | 'chase' | 'flee' | 'removed';
export interface Drifter {
  id: string;
  pos: Vec3;
  hover: number;
  state: DrifterState;
  stolen: number;
  fleeTicks: number;
  home: [number, number];
  target: [number, number];
}

export interface Charm { id: string; pos: Vec3; available: boolean; respawnTicks: number }

export interface Lantern { id: string; pos: Vec3; lit: boolean; deposited: number }

export interface Player {
  pos: Vec3;
  vel: Vec3;
  grounded: boolean;
  facing: [number, number];
  flames: number;
  carried: number;
  invulnTicks: number;
  pulseCdTicks: number;
  dashCdTicks: number;
  dashTicks: number;
  dashDir: [number, number];
  charmTicks: number;
  launched: [number, number] | null; // vận tốc ngang do bục nhảy, giữ tới khi chạm đất
  fallWait: number; // > 0: đang chờ hồi sinh sau khi rơi
}

export type GameState = 'playing' | 'won' | 'lost';

/** Input của một tick, sau khi đã gộp các frame (trường vắng giữ giá trị cũ). */
export interface Input {
  move: [number, number];
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
  pause: boolean;
}

export interface GameEvent { tick: number; name: string; data: Record<string, unknown> }

/** Scenario theo Test Contract mục D (v1.1, đã kiểm tra hợp lệ). */
export interface Scenario {
  player?: {
    pos?: Vec3; carried?: number; flames?: number;
    invuln_ticks?: number; dash_cd_ticks?: number; pulse_cd_ticks?: number; charm_ticks?: number;
  };
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: Vec3[];
  shades?: { id?: string; pos: Vec3; state?: ShadeState; state_ticks_left?: number }[];
  drifters?: { id?: string; pos: Vec3; state?: DrifterState; stolen?: number }[];
  charms?: { id?: string; pos?: Vec3; available?: boolean }[];
  lanterns?: { id: string; pos?: Vec3; lit?: boolean; deposited?: number }[];
  time_left_s?: number;
}

export const NEUTRAL_INPUT: Input = {
  move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false,
};
