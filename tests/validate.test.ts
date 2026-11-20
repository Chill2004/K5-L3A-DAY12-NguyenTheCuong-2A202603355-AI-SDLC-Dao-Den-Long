import { describe, expect, it } from 'vitest';
import { InputError, parseInputs, parseScenario } from '../src/headless/validate.js';

describe('validate inputs', () => {
  it('tick phải tăng nghiêm ngặt', () => {
    expect(() => parseInputs({ frames: [{ tick: 5 }, { tick: 5 }] })).toThrow(InputError);
    expect(() => parseInputs({ frames: [{ tick: 5 }, { tick: 3 }] })).toThrow(InputError);
  });
  it('kiểu sai -> InputError', () => {
    expect(() => parseInputs({ frames: [{ tick: 0, move: [1] }] })).toThrow(InputError);
    expect(() => parseInputs({ frames: [{ tick: 0, pulse: 'yes' }] })).toThrow(InputError);
    expect(() => parseInputs({})).toThrow(InputError);
  });
  it('move ngoài [-1,1] được kẹp', () => {
    expect(parseInputs({ frames: [{ tick: 0, move: [3, -2] }] })[0].move).toEqual([1, -1]);
  });
});

describe('validate scenario', () => {
  it('id đèn ngoài L1..L5 -> InputError', () => {
    expect(() => parseScenario({ lanterns: [{ id: 'L6' }] }, 5)).toThrow(InputError);
  });
  it('pos sai -> InputError', () => {
    expect(() => parseScenario({ player: { pos: [0, 0] } }, 5)).toThrow(InputError);
    expect(() => parseScenario({ motes: [[0, 'a', 0]] }, 5)).toThrow(InputError);
  });
  it('scenario hợp lệ đi qua', () => {
    const sc = parseScenario({ player: { pos: [0, 0, 0], carried: 0, flames: 3 }, random_motes: false, random_shades: false,
      motes: [[0, 0, 5]], shades: [{ pos: [10, 0, 0] }], lanterns: [{ id: 'L1', pos: [0, 0, 25], deposited: 0 }], time_left_s: 300 }, 5);
    expect(sc.motes).toEqual([[0, 0, 5]]);
  });
});
