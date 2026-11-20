// Kiểm chứng end-to-end qua CLI thật (đúng headless_cmd trong game.contract.json) và lưu bằng chứng.
// Dùng: node scripts/verify.mjs [phase-1]   (cần build trước: npm run build:node)
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';
import { checkOutput, loadScenarios } from './scenario-lib.mjs';

const phase = process.argv[2] ?? 'phase-1';
const outDir = join('docs', 'proof', phase, 'runs');
mkdirSync(outDir, { recursive: true });
const contract = JSON.parse(readFileSync('game.contract.json', 'utf8'));
const [cmd, ...baseArgs] = contract.headless_cmd.split(' ');

function cli(args) {
  const r = spawnSync(cmd, [...baseArgs, ...args], { encoding: 'utf8' });
  return { code: r.status, stderr: r.stderr };
}

const rows = [];
let failed = 0;

for (const sc of loadScenarios('scenarios')) {
  const s = sc.spec;
  const args = ['--seed', String(s.seed), '--night', '1', '--ticks', String(s.ticks), '--snapshot-every', String(s.snapshot_every ?? 10)];
  if (sc.scenarioPath) args.push('--scenario', sc.scenarioPath);
  if (sc.inputsPath) args.push('--inputs', sc.inputsPath);
  const outA = join(outDir, `${sc.name}.jsonl`);
  const outB = join(os.tmpdir(), `ddl-${sc.name}-b.jsonl`);
  const t0 = performance.now();
  const a = cli([...args, '--out', outA]);
  const ms = performance.now() - t0;
  const b = cli([...args, '--out', outB]);
  const errs = [];
  if (a.code !== 0) errs.push(`exit ${a.code}: ${a.stderr}`);
  const textA = a.code === 0 ? readFileSync(outA, 'utf8') : '';
  if (a.code === 0) errs.push(...checkOutput(textA, s));
  const same = b.code === 0 && readFileSync(outB, 'utf8') === textA;
  if (!same) errs.push('hai lần chạy khác nhau (mất tất định)');
  const end = textA ? JSON.parse(textA.trim().split('\n').pop()) : {};
  rows.push({ name: sc.name, req: s.requirement, cmd: `${contract.headless_cmd} ${args.join(' ')} --out ${outA}`.replaceAll('\\', '/'),
    ok: errs.length === 0, errs, same, end, ms });
  if (errs.length) failed++;
}

// Mã thoát khi đầu vào sai
const bad = join(os.tmpdir(), 'ddl-bad.json');
const exitCases = [
  ['inputs JSON hỏng -> 2', () => { writeFileSync(bad, '{ not json'); return cli(['--seed', '1', '--night', '1', '--ticks', '10', '--inputs', bad, '--out', join(os.tmpdir(), 'x.jsonl')]); }, 2],
  ['inputs tick không tăng -> 2', () => { writeFileSync(bad, '{"frames":[{"tick":3},{"tick":1}]}'); return cli(['--seed', '1', '--night', '1', '--ticks', '10', '--inputs', bad, '--out', join(os.tmpdir(), 'x.jsonl')]); }, 2],
  ['scenario sai kiểu -> 2', () => { writeFileSync(bad, '{"player":{"pos":"0,0,0"}}'); return cli(['--seed', '1', '--night', '1', '--ticks', '10', '--scenario', bad, '--out', join(os.tmpdir(), 'x.jsonl')]); }, 2],
  ['file scenario không tồn tại -> 2', () => cli(['--seed', '1', '--night', '1', '--ticks', '10', '--scenario', 'khong-co.json', '--out', join(os.tmpdir(), 'x.jsonl')]), 2],
  ['thiếu --out -> khác 0', () => cli(['--seed', '1', '--night', '1', '--ticks', '10']), 'nonzero'],
];
const exitRows = exitCases.map(([name, fn, want]) => {
  const r = fn();
  const ok = want === 'nonzero' ? r.code !== 0 : r.code === want;
  if (!ok) failed++;
  return { name, code: r.code, ok, stderr: r.stderr.trim() };
});

const md = [
  `# Bằng chứng headless: ${phase}`,
  '',
  `Sinh tự động bởi \`npm run verify\` lúc ${new Date().toISOString()}.`,
  `Máy: ${os.type()} ${os.release()} · ${os.cpus()[0]?.model ?? '?'} · Node ${process.version}.`,
  `Commit: ${spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout.trim()}.`,
  'Mỗi scenario chạy CLI thật **2 lần** và so sánh byte-by-byte (tất định). Output lần 1 lưu trong `runs/`.',
  '',
  '| Scenario | Yêu cầu kiểm | Kết thúc | Tất định | Thời gian | Kết quả |',
  '|---|---|---|---|---:|---|',
  ...rows.map((r) => `| \`${r.name}\` | ${r.req} | ${r.end.state ?? '-'} @${r.end.ticks ?? '-'}, score ${r.end.score ?? '-'} | ${r.same ? 'giống hệt' : 'KHÁC'} | ${r.ms.toFixed(0)} ms | ${r.ok ? 'ĐẠT' : 'CHƯA ĐẠT: ' + r.errs.join('; ')} |`),
  '',
  '## Mã thoát khi đầu vào sai',
  '',
  '| Trường hợp | Mã thoát | stderr | Kết quả |',
  '|---|---:|---|---|',
  ...exitRows.map((r) => `| ${r.name} | ${r.code} | ${r.stderr.replaceAll('|', '/').replaceAll('\\', '/').slice(0, 90)} | ${r.ok ? 'ĐẠT' : 'CHƯA ĐẠT'} |`),
  '',
  '## Lệnh tái lập',
  '',
  '```bash',
  ...rows.map((r) => r.cmd),
  '```',
  '',
].join('\n');
writeFileSync(join('docs', 'proof', phase, 'headless-report.md'), md);
console.log(md.split('## Lệnh')[0]);
console.log(failed ? `${failed} mục CHƯA ĐẠT` : 'Tất cả ĐẠT');
process.exitCode = failed ? 1 : 0;
