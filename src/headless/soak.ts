#!/usr/bin/env node
// Soak test (Ticket-04 mục 2): <soak_cmd> --seed 7 --nights 10 --out soak.json
// 10 Đêm liên tiếp trong cùng tiến trình (1 → 2 → 3 xoay vòng), Đêm thứ i (1-based) dùng seed + i, input ngẫu nhiên theo seed.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Rng } from '../core/rng.js';
import { createGame, step, nightDuration, type Game } from '../core/sim.js';
import type { Input, Tuning } from '../core/types.js';

function arg(name: string, def?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0 || process.argv[i + 1] === undefined) {
    if (def !== undefined) return def;
    throw new Error(`Thiếu --${name}`);
  }
  return process.argv[i + 1];
}
const rssMb = () => Math.round((process.memoryUsage().rss / 1048576) * 10) / 10;
const gc = (globalThis as { gc?: () => void }).gc;

function playNight(tuning: Tuning, night: number, seed: number, first: { done: boolean; mem: number }): string {
  let g: Game | null = createGame(tuning, seed, night, {});
  if (!first.done) { gc?.(); first.mem = rssMb(); first.done = true; } // RSS sau khi tải xong Đêm đầu tiên
  const rng = new Rng(seed ^ 0xa11ce);
  const input: Input = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  const maxTicks = Math.round(nightDuration(tuning, night) * 60);
  for (let k = 0; k < maxTicks && g.state === 'playing'; k++) {
    if (k % 30 === 0) { const a = rng.range(0, Math.PI * 2); input.move = [Math.cos(a), Math.sin(a)]; }
    input.jump = rng.next() < 0.05;
    input.dash = rng.next() < 0.03;
    input.pulse = rng.next() < 0.02;
    input.interact = rng.next() < 0.1;
    step(g, input);
  }
  const result = g.state === 'playing' ? 'timeout' : g.state;
  g = null; // reset: bỏ tham chiếu để GC thu hồi
  return result;
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const tuning = JSON.parse(readFileSync(resolve(here, '../../game.contract.json'), 'utf8')).tuning as Tuning;
  const seed = Number(arg('seed', '7'));
  const nights = Number(arg('nights', '10'));
  const out = arg('out');
  if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1) throw new Error('--seed/--nights phải là số nguyên');
  const t0 = performance.now();
  const results: string[] = [];
  let crashes = 0;
  const first = { done: false, mem: 0 };
  for (let i = 1; i <= nights; i++) {
    const night = ((i - 1) % 3) + 1;
    try {
      results.push(playNight(tuning, night, seed + i, first));
    } catch (e) {
      crashes++;
      results.push('crash');
      process.stderr.write(`Đêm thứ ${i} crash: ${(e as Error).stack}\n`);
    }
  }
  gc?.();
  const report = {
    nights, crashes, results,
    mem_start_mb: first.mem,
    mem_end_mb: rssMb(), // RSS sau khi reset xong Đêm cuối
    duration_s: Math.round((performance.now() - t0) / 100) / 10,
    seed, gc_exposed: !!gc, node: process.version,
  };
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}

try {
  main();
} catch (e) {
  process.stderr.write(`Lỗi: ${(e as Error).message}\n`);
  process.exitCode = 1;
}
