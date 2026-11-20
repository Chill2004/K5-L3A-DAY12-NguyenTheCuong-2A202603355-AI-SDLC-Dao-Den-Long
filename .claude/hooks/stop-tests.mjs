// Hook Stop: chặn agent kết thúc lượt khi test đang đỏ (exit 2 -> Claude Code đưa stderr lại cho agent).
import { spawnSync } from 'node:child_process';

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let data = {};
  try { data = JSON.parse(input || '{}'); } catch {}
  if (data.stop_hook_active) process.exit(0); // tránh vòng lặp vô hạn
  const r = spawnSync('npx', ['vitest', 'run', '--reporter=dot'], { encoding: 'utf8', shell: true });
  if (r.status !== 0) {
    process.stderr.write('Test đang ĐỎ, chưa được kết thúc. Sửa cho xanh (không sửa expect để lách):\n' + (r.stdout + r.stderr).slice(-3000));
    process.exit(2);
  }
  process.exit(0);
});
