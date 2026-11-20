// Đo FPS trung bình bản thường ở 1280x720 bằng Chrome (CDP), đọc window.__fps do game tự đo.
// Dùng: npm run build && npx vite preview --port 4173 &  rồi  node scripts/measure-fps.mjs [url] [giây]
// Biến môi trường CHROME = đường dẫn Chrome nếu không tự tìm được.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir, cpus, type, release } from 'node:os';
import { join } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:4173/';
const secs = Number(process.argv[3] ?? 15);
const candidates = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const chrome = candidates.find((p) => existsSync(p));
if (!chrome) { console.error('Không tìm thấy Chrome; đặt biến CHROME'); process.exit(1); }

const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, '--window-size=1280,720', '--ignore-gpu-blocklist',
  '--enable-gpu', '--disable-frame-rate-limit=false', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'ddl-fps-'))}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpPage() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('không kết nối được Chrome');
}

const results = [];
try {
  const ws = new WebSocket(await cdpPage());
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); pending.get(m.id)?.(m.result); });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  for (const night of [1, 2, 3]) {
    await send('Page.navigate', { url: `${base}?autostart&night=${night}` });
    await sleep(secs * 1000);
    const fps = await evalJs('JSON.stringify(window.__fps || null)');
    const gpu = await evalJs(`(() => { const gl = document.createElement('canvas').getContext('webgl2');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info'); return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'; })()`);
    const size = await evalJs('innerWidth + "x" + innerHeight');
    results.push({ night, ...JSON.parse(fps ?? '{}'), gpu, size });
    console.log(`Đêm ${night}: TB ${JSON.parse(fps)?.avg?.toFixed(1)} FPS trong ${JSON.parse(fps)?.n}s · ${size} · GPU: ${gpu}`);
  }
  ws.close();
} finally {
  proc.kill();
}
const out = process.env.OUT;
if (out) {
  mkdirSync(join(out, '..'), { recursive: true });
  writeFileSync(out, JSON.stringify({ when: new Date().toISOString(), machine: `${type()} ${release()} · ${cpus()[0]?.model}`, browser: chrome, results }, null, 2) + '\n');
}
