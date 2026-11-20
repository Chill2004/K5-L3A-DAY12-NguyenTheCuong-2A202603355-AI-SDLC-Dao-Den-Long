// Bảng xếp hạng ở bản thường: lưu qua server (đĩa: .data/leaderboard.json). Khi không có server (npm run dev, mở
// thư mục web tĩnh), dùng localStorage làm dự phòng để game vẫn chạy.
import { insertEntry, entryError, type LeaderboardEntry } from '../core/leaderboard.js';

const LOCAL = 'dao-den-long.leaderboard';
const readLocal = (): LeaderboardEntry[] => { try { return JSON.parse(localStorage.getItem(LOCAL) ?? '[]'); } catch { return []; } };
const writeLocal = (e: LeaderboardEntry[]) => { try { localStorage.setItem(LOCAL, JSON.stringify(e)); } catch { /* bỏ qua */ } };

export async function fetchLeaderboard(): Promise<{ entries: LeaderboardEntry[]; where: 'disk' | 'local' }> {
  try {
    const r = await fetch('/api/leaderboard');
    if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) return { entries: (await r.json()).entries, where: 'disk' };
  } catch { /* không có server */ }
  return { entries: readLocal(), where: 'local' };
}

export async function submitScore(e: LeaderboardEntry): Promise<{ entries: LeaderboardEntry[]; where: 'disk' | 'local' }> {
  const err = entryError(e);
  if (err) throw new Error(err);
  try {
    const r = await fetch('/api/leaderboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(e) });
    if ((r.headers.get('content-type') ?? '').includes('json')) {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Lưu thất bại');
      return { entries: data.entries, where: 'disk' };
    }
  } catch (x) {
    if (x instanceof Error && x.message && !/fetch|network/i.test(x.message)) throw x;
  }
  const entries = insertEntry(readLocal(), e);
  writeLocal(entries);
  return { entries, where: 'local' };
}
