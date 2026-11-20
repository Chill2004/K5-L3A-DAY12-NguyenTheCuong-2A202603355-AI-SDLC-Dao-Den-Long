#!/usr/bin/env node
// Chạy game (run_cmd): phục vụ thư mục dist/ và API bảng xếp hạng lưu trên đĩa (.data/leaderboard.json).
//   node scripts/serve.mjs [--port 4173]
//   node scripts/serve.mjs --export-leaderboard out.json     -> {"entries": [...]} đúng thứ tự
// Cần build trước: npm run build (dùng build/core/leaderboard.js và dist/).
import http from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const DATA_DIR = process.env.DDL_DATA_DIR ?? join(ROOT, '.data');
const LB_FILE = join(DATA_DIR, 'leaderboard.json');
const lb = await import(pathToFileURL(join(ROOT, 'build/core/leaderboard.js')).href);

export function readLeaderboard() {
  try {
    const data = JSON.parse(readFileSync(LB_FILE, 'utf8'));
    return Array.isArray(data.entries) ? data.entries : [];
  } catch { return []; }
}
function writeLeaderboard(entries) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(LB_FILE, JSON.stringify({ entries }, null, 2) + '\n');
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' };

function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/leaderboard') {
    if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ entries: readLeaderboard() })); }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 10000) req.destroy(); });
      req.on('end', () => {
        let e;
        try { e = JSON.parse(body); } catch { res.writeHead(400); return res.end('{"error":"JSON hỏng"}'); }
        if (!e.achieved_at) e.achieved_at = lb.isoWithOffset(new Date());
        const err = lb.entryError(e);
        if (err) { res.writeHead(400, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: err })); }
        const entry = { name: lb.normalizeName(e.name), score: e.score, nights_won: e.nights_won, achieved_at: e.achieved_at, seed: e.seed };
        const entries = lb.insertEntry(readLeaderboard(), entry);
        writeLeaderboard(entries);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ entries, saved: entries.some((x) => x.achieved_at === entry.achieved_at && x.name === entry.name) }));
      });
      return;
    }
    res.writeHead(405); return res.end();
  }
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  let file = join(DIST, p || 'index.html');
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) { res.writeHead(404); return res.end('Not found (đã chạy npm run build chưa?)'); }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
  res.end(readFileSync(file));
}

export function startServer({ port = 4173, quiet = false } = {}) {
  return new Promise((ok, fail) => {
    const server = http.createServer(handler);
    server.on('error', fail);
    server.listen(port, '127.0.0.1', () => {
      const actual = server.address().port;
      if (!quiet) console.log(`Đảo Đèn Lồng: http://localhost:${actual}/  (Ctrl+C để dừng; bảng xếp hạng lưu ở ${LB_FILE})`);
      ok({ server, port: actual });
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--export-leaderboard');
  if (i >= 0) {
    const out = process.argv[i + 1];
    if (!out) { console.error('Thiếu đường dẫn: --export-leaderboard out.json'); process.exit(1); }
    writeFileSync(out, JSON.stringify({ entries: readLeaderboard() }, null, 2) + '\n');
    console.log(`Đã xuất ${readLeaderboard().length} mục ra ${out}`);
  } else {
    const pi = process.argv.indexOf('--port');
    await startServer({ port: pi >= 0 ? Number(process.argv[pi + 1]) : 4173 });
  }
}
