// Đọc scenarios/<tên>/{scenario,inputs,expect}.json và so output JSONL với expect.
// Dùng chung cho tests/scenarios.test.ts (chạy in-process) và scripts/verify.mjs (chạy CLI thật).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadScenarios(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const p = join(dir, d.name);
      const read = (f) => (existsSync(join(p, f)) ? JSON.parse(readFileSync(join(p, f), 'utf8')) : undefined);
      return {
        name: d.name,
        dir: p,
        scenarioPath: existsSync(join(p, 'scenario.json')) ? join(p, 'scenario.json') : undefined,
        inputsPath: existsSync(join(p, 'inputs.json')) ? join(p, 'inputs.json') : undefined,
        scenario: read('scenario.json'),
        inputs: read('inputs.json'),
        spec: read('expect.json'),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// So khớp con: object chỉ kiểm các key có trong expected; mảng phải cùng độ dài; {"$gt": n} / {"$gte": n} / {"$lt": n}.
function match(actual, expected, path, errs) {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    const ops = Object.keys(expected).filter((k) => k.startsWith('$'));
    if (ops.length) {
      for (const op of ops) {
        const v = expected[op];
        const ok = op === '$gt' ? actual > v : op === '$gte' ? actual >= v : op === '$lt' ? actual < v : op === '$lte' ? actual <= v : false;
        if (!ok) errs.push(`${path}: ${JSON.stringify(actual)} không thỏa ${op} ${v}`);
      }
      return;
    }
    if (!actual || typeof actual !== 'object') { errs.push(`${path}: thiếu object`); return; }
    for (const k of Object.keys(expected)) match(actual[k], expected[k], `${path}.${k}`, errs);
    return;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      errs.push(`${path}: mong ${JSON.stringify(expected)}, nhận ${JSON.stringify(actual)}`);
      return;
    }
    expected.forEach((e, i) => match(actual[i], e, `${path}[${i}]`, errs));
    return;
  }
  if (actual !== expected) errs.push(`${path}: mong ${JSON.stringify(expected)}, nhận ${JSON.stringify(actual)}`);
}

/** Kiểm tra cấu trúc chung của output theo contract + các kỳ vọng riêng. Trả về danh sách lỗi. */
export function checkOutput(text, spec) {
  const errs = [];
  const lines = text.trim().split('\n');
  let objs;
  try { objs = lines.map((l) => JSON.parse(l)); } catch (e) { return [`output không phải JSONL: ${e.message}`]; }
  const snaps = objs.filter((o) => o.type === 'snapshot');
  const events = objs.filter((o) => o.type === 'event');
  const end = objs[objs.length - 1];
  const every = spec.snapshot_every ?? 10;

  // Cấu trúc chung (Test Contract mục E)
  if (end.type !== 'end') errs.push('dòng cuối không phải end');
  if (objs.filter((o) => o.type === 'end').length !== 1) errs.push('phải có đúng 1 dòng end');
  if (!snaps.length || snaps[0].tick !== 0) errs.push('thiếu snapshot tick 0');
  for (const s of snaps) if (s.tick % every !== 0) errs.push(`snapshot tick ${s.tick} không chia hết ${every}`);
  for (const o of objs) if (!['snapshot', 'event', 'end'].includes(o.type)) errs.push(`type lạ: ${o.type}`);
  const names = ['mote_picked', 'deposit', 'lantern_lit', 'pulse', 'player_hit', 'shade_spawned', 'game_over'];
  for (const e of events) if (!names.includes(e.name)) errs.push(`event lạ: ${e.name}`);
  for (const s of snaps) {
    for (const k of ['tick', 'sim_tick', 'state', 'time_left_s', 'score', 'player', 'lanterns', 'shades', 'motes_active']) {
      if (!(k in s)) errs.push(`snapshot tick ${s.tick} thiếu ${k}`);
    }
  }
  const go = events.filter((e) => e.name === 'game_over');
  if (end.state !== 'playing' && go.length !== 1) errs.push('kết thúc nhưng không có đúng 1 game_over');

  const x = spec.expect ?? {};
  if (x.end) match(end, x.end, 'end', errs);
  // events: dãy con theo đúng thứ tự
  if (x.events) {
    let i = 0;
    for (const want of x.events) {
      while (i < events.length) {
        const sub = [];
        match(events[i], want, 'e', sub);
        i++;
        if (!sub.length) { want.__ok = true; break; }
      }
      if (!want.__ok) errs.push(`không thấy event (đúng thứ tự): ${JSON.stringify(want)}`);
      delete want.__ok;
    }
  }
  for (const [n, c] of Object.entries(x.event_count ?? {})) {
    const got = events.filter((e) => e.name === n).length;
    if (got !== c) errs.push(`số event ${n}: mong ${c}, nhận ${got}`);
  }
  for (const n of x.no_events ?? []) if (events.some((e) => e.name === n)) errs.push(`không được có event ${n}`);
  for (const s of x.snapshots ?? []) {
    const snap = snaps.find((o) => o.tick === s.tick);
    if (!snap) errs.push(`không có snapshot tick ${s.tick}`);
    else match(snap, s.match, `snapshot@${s.tick}`, errs);
  }
  return errs;
}
