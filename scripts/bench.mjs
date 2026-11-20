#!/usr/bin/env node
// Benchmark (Ticket-04 mục 1): node scripts/bench.mjs --seed 42 --duration 30 --out bench.json [--headless]
// Mở Chrome ở cửa sổ (không toàn màn hình) với vùng hiển thị đúng 1280x720, tắt vsync (--disable-gpu-vsync
// --disable-frame-rate-limit), chạy trang ?bench, đọc kết quả qua Chrome DevTools Protocol rồi thoát mã 0.
// Cần: npm run build và Google Chrome/Chromium (đặt biến CHROME nếu không tự tìm thấy).
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { startServer } from './serve.mjs';

const PROC_START = Date.now() - performance.now(); // mốc "tiến trình bắt đầu"
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const seed = Number(arg('seed', '42'));
const duration = Number(arg('duration', '30'));
const out = arg('out', 'bench.json');
const headless = process.argv.includes('--headless');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const candidates = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const chrome = candidates.find((p) => existsSync(p));
if (!chrome) { console.error('Không tìm thấy Chrome/Chromium; đặt biến môi trường CHROME=<đường dẫn>'); process.exit(1); }

const { server, port } = await startServer({ port: 0, quiet: true });
const dbg = 9500 + Math.floor(Math.random() * 400);
const proc = spawn(chrome, [
  ...(headless ? ['--headless=new'] : []),
  `--remote-debugging-port=${dbg}`, `--user-data-dir=${mkdtempSync(join(os.tmpdir(), 'ddl-bench-'))}`,
  '--window-size=1280,720', '--window-position=40,40', '--no-first-run', '--no-default-browser-check',
  '--disable-gpu-vsync', '--disable-frame-rate-limit', '--ignore-gpu-blocklist', '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--app=data:text/html,<title>Dao Den Long bench</title>',
], { stdio: 'ignore' });

let exitCode = 0;
try {
  let list = [];
  for (let i = 0; i < 100 && !list.find((t) => t.type === 'page'); i++) {
    try { list = await (await fetch(`http://127.0.0.1:${dbg}/json/list`)).json(); } catch {}
    await sleep(100);
  }
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('không kết nối được Chrome');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id) pending.get(m.id)?.(m); });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value;

  // Chỉnh cửa sổ để vùng hiển thị đúng 1280x720
  if (headless) await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  else {
    const win = (await send('Browser.getWindowForTarget', { targetId: page.id })).result;
    if (win) {
      const [iw, ih] = JSON.parse(await ev('JSON.stringify([innerWidth, innerHeight])'));
      const b = win.bounds;
      await send('Browser.setWindowBounds', { windowId: win.windowId, bounds: { windowState: 'normal', width: b.width + (1280 - iw), height: b.height + (720 - ih) } });
    }
  }
  await send('Page.navigate', { url: `http://localhost:${port}/?bench&seed=${seed}&duration=${duration}` });
  let result = null;
  const deadline = Date.now() + (duration + 90) * 1000;
  while (!result && Date.now() < deadline) {
    await sleep(500);
    const v = await ev('JSON.stringify(window.__bench ? { ...window.__bench, first: window.__benchFirstFrameEpoch } : null)');
    result = v ? JSON.parse(v) : null;
  }
  if (!result) throw new Error('bench không kết thúc đúng hạn');
  const gpu = await ev(`(() => { const gl = document.createElement('canvas').getContext('webgl2'); const x = gl && gl.getExtension('WEBGL_debug_renderer_info'); return x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : 'unknown'; })()`);
  const version = (await send('Browser.getVersion')).result?.product ?? 'Chrome';
  ws.close();
  const report = {
    contract_version: '1.3',
    avg_fps: result.avg_fps,
    p1_low_fps: result.p1_low_fps,
    frame_ms_p95: result.frame_ms_p95,
    frames: result.frames,
    load_ms: Math.round(result.first - PROC_START),
    peak_mem_mb: null,
    peak_mem_note: 'Bản web: RSS của Chrome trải trên nhiều tiến trình (browser/GPU/renderer) nên không đo được một cách thống nhất; ghi null theo Ticket-04. js_heap_peak_mb là JS heap đỉnh của trang.',
    js_heap_peak_mb: result.js_heap_peak_mb,
    vsync_off: true,
    renderer: `three.js r170 WebGLRenderer · ${version} · ${gpu}`,
    os: `${os.type()} ${os.release()} (${os.platform()}) · ${os.cpus()[0]?.model} · ${Math.round(os.totalmem() / 1073741824)} GB RAM`,
    sim_ms_p95: result.sim_ms_p95, cpu_render_ms_p95: result.cpu_render_ms_p95,
    viewport: result.viewport, shades: result.shades, motes: result.motes, seed, duration_s: duration, headless,
  };
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  console.error('Lỗi bench:', e.message);
  exitCode = 1;
} finally {
  proc.kill();
  server.close();
}
process.exit(exitCode);
