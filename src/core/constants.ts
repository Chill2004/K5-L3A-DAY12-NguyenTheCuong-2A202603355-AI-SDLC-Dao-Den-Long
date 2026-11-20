// Hằng số của game KHÔNG có trong tuning của contract (xem docs/notes/assumptions.md).
export const TICK_RATE = 60;
export const ISLAND_RADIUS = 40; // đảo tròn, tâm (0,0,0); không rơi được (fall_enabled=false)
export const LANTERN_RING_RADIUS = 25; // L1..L5 đặt đều trên vòng tròn này, L1 tại (0,0,25)
export const JUMP_VELOCITY = 7; // m/s
export const GRAVITY = 20; // m/s^2
export const SHADE_HEIGHT = 1; // tâm Bóng Mực tự sinh ở y = 1

export const INITIAL_MOTES = 30;
export const MAX_MOTES = 30;
export const MOTE_RESPAWN_S = 4; // mỗi 4 s sinh thêm 1 đom đóm nếu còn < MAX_MOTES
export const MOTE_MIN_R = 4;
export const MOTE_MAX_R = 37;

export const INITIAL_SHADES = 2;
export const MAX_SHADES = 6;
export const SHADE_SPAWN_S = 25; // mỗi 25 s sinh thêm 1 Bóng Mực nếu còn < MAX_SHADES
export const SHADE_SPAWN_R = 35;
export const SHADE_SPAWN_MIN_DIST = 15; // không sinh trong vòng 15 m quanh người chơi

export const EPS = 1e-9;
