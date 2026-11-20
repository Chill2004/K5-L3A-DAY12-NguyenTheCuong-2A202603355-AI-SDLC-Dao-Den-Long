#!/usr/bin/env node
// CLI headless: <headless_cmd> --seed <int> --night 1 [--scenario f] [--inputs f] --ticks <int> --out f [--snapshot-every n]
// Mã thoát: 0 = ổn, 1 = tham số/IO sai, 2 = file scenario/inputs sai định dạng.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Tuning } from '../core/types.js';
import { runHeadless } from './runner.js';
import { InputError, parseInputs, parseScenario } from './validate.js';

class ArgError extends Error {}

function parseArgs(argv: string[]) {
  const a: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) throw new ArgError(`Tham số không hợp lệ: ${k}`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) throw new ArgError(`Thiếu giá trị cho ${k}`);
    a[k.slice(2)] = v;
    i++;
  }
  const int = (name: string, required: boolean, min: number) => {
    if (a[name] === undefined) {
      if (required) throw new ArgError(`Thiếu --${name}`);
      return undefined;
    }
    if (!/^-?\d+$/.test(a[name]) || +a[name] < min) throw new ArgError(`--${name} phải là số nguyên >= ${min}`);
    return +a[name];
  };
  const seed = int('seed', true, -2147483648)!;
  const night = int('night', true, 1)!;
  if (night !== 1) throw new ArgError(`--night ${night} chưa được hỗ trợ (chỉ có Đêm 1)`);
  const ticks = int('ticks', true, 0)!;
  const snapshotEvery = int('snapshot-every', false, 1) ?? 10;
  if (!a.out) throw new ArgError('Thiếu --out');
  const known = new Set(['seed', 'night', 'ticks', 'snapshot-every', 'out', 'scenario', 'inputs']);
  for (const k of Object.keys(a)) if (!known.has(k)) throw new ArgError(`Tham số không biết: --${k}`);
  return { seed, ticks, snapshotEvery, out: a.out, scenario: a.scenario, inputs: a.inputs };
}

function readJson(path: string, what: string): unknown {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    throw new InputError(`Không đọc được file ${what}: ${path}`);
  }
  try {
    return JSON.parse(text.replace(/^﻿/, ''));
  } catch (e) {
    throw new InputError(`File ${what} không phải JSON hợp lệ: ${(e as Error).message}`);
  }
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const contract = JSON.parse(readFileSync(resolve(here, '../../game.contract.json'), 'utf8'));
  const tuning = contract.tuning as Tuning;
  const args = parseArgs(process.argv.slice(2));
  const scenario = args.scenario ? parseScenario(readJson(args.scenario, 'scenario'), tuning.lantern_count_night1) : undefined;
  const frames = args.inputs ? parseInputs(readJson(args.inputs, 'inputs')) : undefined;
  const lines = runHeadless({ tuning, seed: args.seed, scenario, frames, ticks: args.ticks, snapshotEvery: args.snapshotEvery });
  writeFileSync(args.out, lines.join('\n') + '\n');
}

try {
  main();
  process.exitCode = 0;
} catch (e) {
  process.stderr.write(`Lỗi: ${(e as Error).message}\n`);
  process.exitCode = e instanceof InputError ? 2 : 1;
}
