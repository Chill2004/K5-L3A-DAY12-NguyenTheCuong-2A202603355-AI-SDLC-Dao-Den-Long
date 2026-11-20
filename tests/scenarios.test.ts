// Chạy mọi scenario trong scenarios/ in-process và so với expect.json; kiểm tra tính tất định.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error: module JS thuần dùng chung với scripts/verify.mjs
import { checkOutput, loadScenarios } from '../scripts/scenario-lib.mjs';
import { runHeadless } from '../src/headless/runner.js';
import { parseInputs, parseScenario } from '../src/headless/validate.js';
import type { Tuning } from '../src/core/types.js';
import { MAPS } from '../src/core/maps.js';

const tuning = JSON.parse(readFileSync('game.contract.json', 'utf8')).tuning as Tuning;

function run(sc: any, seed = sc.spec.seed) {
  const night = sc.spec.night ?? 1;
  return runHeadless({
    tuning,
    seed,
    night,
    scenario: sc.scenario ? parseScenario(sc.scenario, MAPS[night].lanterns.length) : undefined,
    frames: sc.inputs ? parseInputs(sc.inputs) : undefined,
    ticks: sc.spec.ticks,
    snapshotEvery: sc.spec.snapshot_every,
  }).join('\n');
}

describe('scenarios', () => {
  for (const sc of loadScenarios('scenarios')) {
    it(`${sc.name}: ${sc.spec.requirement}`, () => {
      const out = run(sc);
      expect(checkOutput(out, sc.spec)).toEqual([]);
      expect(run(sc)).toBe(out); // tất định
    });
  }
});

describe('determinism', () => {
  const night = { name: 'x', scenario: undefined, inputs: { frames: [
    { tick: 0, move: [0.3, 1], cam_yaw_deg: 20 }, { tick: 300, move: [-1, 0.2], pulse: true },
    { tick: 301, pulse: false }, { tick: 900, move: [0, -1], cam_yaw_deg: -45, jump: true }, { tick: 901, jump: false },
  ] }, spec: { seed: 7, ticks: 3000, snapshot_every: 10 } };

  it('cùng seed + inputs -> output giống hệt (kể cả id tự sinh)', () => {
    expect(run(night)).toBe(run(night));
  });
  it('khác seed -> khác bản đồ đom đóm', () => {
    expect(run(night, 7)).not.toBe(run(night, 8));
  });
});
