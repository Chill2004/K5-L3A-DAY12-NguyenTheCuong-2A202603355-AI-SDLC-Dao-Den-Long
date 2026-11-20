// Ticket-04: bảng xếp hạng, thống kê bench, cảnh bench chuẩn.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { insertEntry, nameError, entryError, isoWithOffset, type LeaderboardEntry } from '../src/core/leaderboard.js';
import { benchStats, createBenchGame } from '../src/core/bench.js';
import { step } from '../src/core/sim.js';
import { NEUTRAL_INPUT, type Tuning } from '../src/core/types.js';

const tuning = JSON.parse(readFileSync('game.contract.json', 'utf8')).tuning as Tuning;
const E = (name: string, score: number, at: string): LeaderboardEntry => ({ name, score, nights_won: 1, achieved_at: at, seed: 1 });

describe('leaderboard', () => {
  it('tên 3–12 ký tự [A-Za-z0-9_], hỗ trợ tiếng Việt có dấu', () => {
    expect(nameError('ab')).not.toBeNull();
    expect(nameError('abc')).toBeNull();
    expect(nameError('a'.repeat(12))).toBeNull();
    expect(nameError('a'.repeat(13))).not.toBeNull();
    expect(nameError('May_01')).toBeNull();
    expect(nameError('Mây_Đèn')).toBeNull();
    expect(nameError('Nguyễn')).toBeNull();
    expect(nameError('a b c')).not.toBeNull();
    expect(nameError('abc!')).not.toBeNull();
  });
  it('sắp xếp điểm giảm dần, bằng điểm thì ai đạt trước đứng trên, giữ top 10', () => {
    let list: LeaderboardEntry[] = [];
    list = insertEntry(list, E('late', 100, '2026-11-20T10:00:05+07:00'));
    list = insertEntry(list, E('early', 100, '2026-11-20T10:00:01+07:00'));
    list = insertEntry(list, E('top', 500, '2026-11-20T11:00:00+07:00'));
    expect(list.map((e) => e.name)).toEqual(['top', 'early', 'late']);
    for (let i = 0; i < 12; i++) list = insertEntry(list, E(`p${String(i).padStart(2, '0')}`, 200 + i, `2026-11-20T12:00:${String(i).padStart(2, '0')}+07:00`));
    expect(list).toHaveLength(10);
    expect(list[0].name).toBe('top');
    expect(list.map((e) => e.score)).toEqual([...list.map((e) => e.score)].sort((a, b) => b - a));
  });
  it('achieved_at là ISO 8601 có múi giờ', () => {
    const s = isoWithOffset(new Date('2026-11-20T09:05:09Z'));
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    expect(Date.parse(s)).toBe(Date.parse('2026-11-20T09:05:09Z'));
    expect(entryError({ name: 'abc', score: 1, nights_won: 4, achieved_at: s, seed: 1 })).not.toBeNull();
    expect(entryError({ name: 'abc', score: 1, nights_won: 3, achieved_at: s, seed: 1 })).toBeNull();
  });
});

describe('bench', () => {
  it('thống kê theo định nghĩa Ticket-04', () => {
    const dts = [...Array(98).fill(10), 40, 50]; // N = 100, k = 1
    const s = benchStats(dts);
    expect(s.frames).toBe(100);
    expect(s.avg_fps).toBeCloseTo((1000 * 100) / (980 + 90), 1);
    expect(s.p1_low_fps).toBe(20); // 1000 / 50
    expect(s.frame_ms_p95).toBe(10);
  });
  it('cảnh bench: 200 bóng wander, 100 đom đóm, L1–L3 sáng fuel 100; không sinh thêm, không sát thương, không hao dầu, không kết thúc', () => {
    const g = createBenchGame(tuning, 42);
    expect(g.shades).toHaveLength(200);
    expect(g.motes).toHaveLength(100);
    expect(g.lanterns.slice(0, 3).every((l) => l.lit && l.fuel === 6000)).toBe(true);
    const events: string[] = [];
    for (let i = 0; i < 60 * 300; i++) for (const e of step(g, NEUTRAL_INPUT)) events.push(e.name); // > thời lượng Đêm 1
    expect(events).toEqual([]);
    expect(g.state).toBe('playing');
    expect(g.shades).toHaveLength(200);
    expect(g.motes).toHaveLength(100);
    expect(g.shades.every((s) => s.state === 'wander')).toBe(true);
    expect(g.lanterns.slice(0, 3).every((l) => l.fuel === 6000)).toBe(true);
    expect(g.player.pos).toEqual([0, 0, 0]);
  });
  it('cảnh bench tất định theo seed', () => {
    const a = createBenchGame(tuning, 42), b = createBenchGame(tuning, 42);
    expect(a.shades.map((s) => s.pos)).toEqual(b.shades.map((s) => s.pos));
  });
});
