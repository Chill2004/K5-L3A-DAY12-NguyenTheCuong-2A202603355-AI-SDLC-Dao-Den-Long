// Bảng xếp hạng cục bộ (Ticket-04 mục 3): logic thuần, dùng chung cho server (lưu đĩa), bản web và test.
export interface LeaderboardEntry {
  name: string;
  score: number; // tổng điểm các Đêm đã thắng
  nights_won: number; // 0–3
  achieved_at: string; // ISO 8601 có múi giờ
  seed: number;
}

export const MAX_ENTRIES = 10;
// 3–12 ký tự; hỗ trợ chữ có dấu tiếng Việt (chữ cái Unicode + dấu kết hợp), số và "_".
const NAME_RE = /^[\p{L}\p{M}\p{N}_]+$/u;

export function normalizeName(raw: string): string {
  return raw.normalize('NFC').trim();
}

export function nameError(raw: string): string | null {
  const name = normalizeName(raw);
  const len = [...name].length;
  if (len < 3 || len > 12) return 'Tên cần 3–12 ký tự';
  if (!NAME_RE.test(name)) return 'Tên chỉ gồm chữ (có thể có dấu), số và dấu _';
  return null;
}

/** ISO 8601 theo giờ địa phương, kèm múi giờ (vd. 2026-11-20T16:05:09+07:00). */
export function isoWithOffset(d: Date): string {
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(off / 60)}:${pad(off % 60)}`;
}

export function entryError(e: Partial<LeaderboardEntry>): string | null {
  const n = nameError(String(e.name ?? ''));
  if (n) return n;
  if (!Number.isInteger(e.score) || (e.score as number) < 0) return 'score phải là số nguyên >= 0';
  if (!Number.isInteger(e.nights_won) || (e.nights_won as number) < 0 || (e.nights_won as number) > 3) return 'nights_won phải trong 0–3';
  if (typeof e.achieved_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(e.achieved_at)) return 'achieved_at phải là ISO 8601 có múi giờ';
  if (!Number.isInteger(e.seed)) return 'seed phải là số nguyên';
  return null;
}

/** Thêm một mục, sắp xếp điểm giảm dần (bằng điểm: ai đạt trước đứng trên), giữ top 10. */
export function insertEntry(entries: LeaderboardEntry[], e: LeaderboardEntry): LeaderboardEntry[] {
  const all = [...entries, { ...e, name: normalizeName(e.name) }];
  all.sort((a, b) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at));
  return all.slice(0, MAX_ENTRIES);
}
