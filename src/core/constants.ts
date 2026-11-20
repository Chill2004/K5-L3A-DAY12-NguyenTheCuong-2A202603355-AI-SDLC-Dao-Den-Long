// Hằng số chuẩn của Ticket-02 không nằm trong tuning của contract, và vài giả định riêng (đánh dấu GĐ).
export const TICK_RATE = 60;
export const JUMP_VELOCITY = 7;
export const GRAVITY = 20;
export const STEP_HEIGHT = 0.35; // GĐ: bậc cao tối đa đi bộ lên được (dốc 0.5 → 0.117 m/tick khi lướt)

export const CHARM_SPEED = 7.2;
export const CHARM_TICKS = 600;
export const CHARM_RESPAWN_TICKS = 2700;
export const PICKUP_DY = 1.5;

export const INITIAL_MOTES = 20;
export const MAX_MOTES = 30;
export const MOTE_RESPAWN_TICKS = 240;
export const DROPPED_TTL_TICKS = 480;
export const DROP_RING_MIN = 1.5;
export const DROP_RING_MAX = 2.5;

export const SAFE_EVICT_TICKS = 30;
export const PULSE_CENTER_Y = 0.8;
export const PULSE_PUSH_TICKS = 15;

export const SHADE_DETECT = 12;
export const SHADE_LOSE = 18;
export const SHADE_HIT_DY = 1.5;
export const SHADE_FIRST_SPAWN_TICK = 300;
export const SHADE_SPAWN_MIN_DIST = 15;
export const SHADE_SPAWNING_TICKS = 60; // GĐ: thời gian trạng thái spawning (vô hại, đứng yên)
export const SHADE_WANDER_SPEED = 1.5; // GĐ
export const WANDER_RADIUS = 6; // GĐ: lượn quanh điểm sinh
export const RECOIL_TICKS = 60;
export const RECOIL_DIST = 2;

export const DRIFTER_SPEED = 7;
export const DRIFTER_IDLE_SPEED = 2;
export const DRIFTER_MAX = 2;
export const DRIFTER_SPAWN_TICKS = 1200;
export const DRIFTER_DETECT = 15;
export const DRIFTER_MIN_CARRY = 5;
export const DRIFTER_HIT = 1.2;
export const DRIFTER_STEAL = 3;
export const DRIFTER_FLEE_TICKS = 240;
export const DRIFTER_DROP_VANISH_TICKS = 120;

export const FALL_Y = -10;
export const FALL_WAIT_TICKS = 60;
export const RESPAWN_INVULN_TICKS = 90;

export const WIND_PERIOD_TICKS = 1800;
export const WIND_DURATION_TICKS = 300;
export const WIND_SPEED = 2;
export const WIND_WARN_TICKS = 120;

export const EPS = 1e-9;

// Ticket-03 (dầu đèn)
export const FUEL_UNIT = 60; // 1 dầu = 60 đơn vị nguyên (1/60)
export const RELIGHT_SCORE = 40;
export const DRAIN_STUN_SCORE = 15; // tổng điểm khi Tỏa Sáng trúng bóng đang drain
export const DAWN_LANTERN_BONUS = 50; // + floor(fuel) mỗi đèn đang sáng khi thắng
export const DRAIN_RANGE = 2;
export const DRAIN_CHASE_RANGE = 6;
export const DRAIN_EVENT_TICKS = 60;
export const UNLIT_ARRIVE = 2; // GĐ: bóng wander tới đèn tắt thì dừng trong 2 m
