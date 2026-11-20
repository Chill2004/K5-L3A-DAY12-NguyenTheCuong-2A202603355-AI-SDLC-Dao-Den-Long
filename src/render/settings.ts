// Cài đặt (âm lượng, độ nhạy chuột), lưu giữa các lần mở game bằng localStorage.
export interface Settings { volume: number; sensitivity: number }
const KEY = 'dao-den-long.settings';
const DEFAULTS: Settings = { volume: 0.6, sensitivity: 1 };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        volume: typeof s.volume === 'number' ? Math.min(1, Math.max(0, s.volume)) : DEFAULTS.volume,
        sensitivity: typeof s.sensitivity === 'number' ? Math.min(3, Math.max(0.2, s.sensitivity)) : DEFAULTS.sensitivity,
      };
    }
  } catch { /* trình duyệt chặn storage: dùng mặc định */ }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* bỏ qua */ }
}
