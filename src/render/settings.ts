// Cài đặt (âm lượng, độ nhạy chuột, mù màu, đổi phím, giảm chuyển động, chữ lớn), lưu giữa các lần mở game bằng localStorage.
export type Action = 'up' | 'down' | 'left' | 'right' | 'jump' | 'dash' | 'interact' | 'pulse' | 'pause';
export const ACTIONS: Action[] = ['up', 'down', 'left', 'right', 'jump', 'dash', 'interact', 'pulse', 'pause'];
export const ACTION_LABEL: Record<Action, string> = {
  up: 'Đi tới', down: 'Đi lùi', left: 'Sang trái', right: 'Sang phải', jump: 'Nhảy', dash: 'Lướt',
  interact: 'Tương tác (nạp / châm dầu)', pulse: 'Tỏa Sáng', pause: 'Tạm dừng',
};
export const DEFAULT_KEYS: Record<Action, string> = {
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyF', pause: 'Escape',
};

export interface Settings {
  volume: number;
  sensitivity: number;
  colorblind: boolean;
  reducedMotion: boolean;
  largeText: boolean;
  keys: Record<Action, string>;
}
const KEY = 'dao-den-long.settings';
const DEFAULTS: Settings = { volume: 0.6, sensitivity: 1, colorblind: false, reducedMotion: false, largeText: false, keys: { ...DEFAULT_KEYS } };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const keys = { ...DEFAULT_KEYS };
      if (s.keys && typeof s.keys === 'object') for (const a of ACTIONS) if (typeof s.keys[a] === 'string') keys[a] = s.keys[a];
      return {
        volume: typeof s.volume === 'number' ? Math.min(1, Math.max(0, s.volume)) : DEFAULTS.volume,
        sensitivity: typeof s.sensitivity === 'number' ? Math.min(3, Math.max(0.2, s.sensitivity)) : DEFAULTS.sensitivity,
        colorblind: s.colorblind === true,
        reducedMotion: s.reducedMotion === true,
        largeText: s.largeText === true,
        keys,
      };
    }
  } catch { /* trình duyệt chặn storage: dùng mặc định */ }
  return { ...DEFAULTS, keys: { ...DEFAULT_KEYS } };
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* bỏ qua */ }
}

/** Các phím bị gán cho nhiều hành động: code -> danh sách hành động. */
export function duplicateKeys(keys: Record<Action, string>): Map<string, Action[]> {
  const by = new Map<string, Action[]>();
  for (const a of ACTIONS) by.set(keys[a], [...(by.get(keys[a]) ?? []), a]);
  for (const [k, v] of [...by]) if (v.length < 2) by.delete(k);
  return by;
}

export function keyName(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = { Space: 'Space', ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải', Escape: 'Esc',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', ControlLeft: 'Ctrl trái', Enter: 'Enter', Tab: 'Tab' };
  return map[code] ?? code;
}
