// Luồng game có đồ họa: menu → giới thiệu Đêm → chơi → kết quả → Đêm kế → Bình Minh.
// Core chạy 60 tick/giây cố định; tạm dừng thì không gọi step (logic dừng hoàn toàn).
import * as THREE from 'three';
import contract from '../../game.contract.json';
import { createGame, step, timeLeft, distXZ, capacity, type Game } from '../core/sim.js';
import { TICK_RATE } from '../core/constants.js';
import { MAPS } from '../core/maps.js';
import type { GameEvent, Input, Scenario, Tuning } from '../core/types.js';
import { World } from './world.js';
import { createBenchGame, benchStats } from '../core/bench.js';
import { Audio } from './audio.js';
import { loadSettings, saveSettings, ACTIONS, ACTION_LABEL, DEFAULT_KEYS, duplicateKeys, keyName, type Action } from './settings.js';
import { fetchLeaderboard, submitScore } from './leaderboardClient.js';
import { isoWithOffset, nameError } from '../core/leaderboard.js';

const tuning = contract.tuning as Tuning;
const $ = (id: string) => document.getElementById(id)!;
const params = new URLSearchParams(location.search);

const world = new World($('app'));
const audio = new Audio();
const settings = loadSettings();
audio.setVolume(settings.volume);
const applyColorblind = () => { world.setColorblind(settings.colorblind); document.body.classList.toggle('cb', settings.colorblind); };
applyColorblind();
const applyText = () => document.documentElement.style.setProperty('--scale', settings.largeText ? '1.25' : '1');
applyText();

// Phụ đề / chỉ báo hình ảnh (Ticket-04 mục 4)
function subtitle(text: string) {
  const el = document.createElement('div');
  el.textContent = text;
  $('subs').appendChild(el);
  setTimeout(() => el.remove(), 3000);
  while ($('subs').children.length > 3) $('subs').firstElementChild!.remove();
}
let shadeAlert: { id: string; until: number } | null = null;
const warnedLow = new Set<string>();
let shakeUntil = 0;

const ONG_DANG: Record<number, string> = {
  1: '“Mây à, sương đen tràn về Đảo Bến rồi. Gom đom đóm, thắp lại năm ngọn đèn trước khi trời sáng nhé.” – Ông Đăng',
  2: '“Đảo Cau có hai hòn, nối bằng cây cầu tre. Coi chừng Gió Lạc, nó thích giật đom đóm của con lắm.” – Ông Đăng',
  3: '“Đảo Chuông cao nhất làng. Đi dốc mà lên, nhún bục mà nhảy, và nhớ giữ chân khi gió mạnh nổi lên.” – Ông Đăng',
};

type Mode = 'menu' | 'intro' | 'play' | 'paused' | 'result' | 'dawn' | 'settings' | 'keys' | 'leaderboard';
let mode: Mode = 'menu';
let settingsBack: Mode = 'menu';
let night = 1;
let campaignSeed = (Math.random() * 2 ** 31) | 0;
let rebinding: Action | null = null;
let game: Game = createGame(tuning, 1, 1, {});
const nightScores: Record<number, number> = {};
let camYaw = 0;
let facingYaw = 0;
let acc = 0;
let last = performance.now();
let lastCountdown = -1;

// ---------- Input ----------
const keys = new Set<string>();
let dragging = false;
addEventListener('keydown', (e) => {
  audio.ensure();
  if (rebinding) { // đang chờ phím mới cho một hành động
    e.preventDefault();
    settings.keys[rebinding] = e.code;
    rebinding = null;
    saveSettings(settings);
    showKeys();
    return;
  }
  if ((e.target as HTMLElement)?.tagName === 'INPUT') { if (e.code === 'Enter') ($('screen').querySelector('button') as HTMLButtonElement | null)?.click(); return; }
  keys.add(e.code);
  if (['Space', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.code === settings.keys.pause && (mode === 'play' || mode === 'paused')) togglePause();
  else if (e.code === 'Enter') ($('screen').querySelector('button') as HTMLButtonElement | null)?.click();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); if (mode === 'play') togglePause(); });
world.renderer.domElement.addEventListener('pointerdown', () => (dragging = true));
addEventListener('pointerup', () => (dragging = false));
addEventListener('pointermove', (e) => { if (dragging && mode === 'play') camYaw -= e.movementX * 0.3 * settings.sensitivity; });
addEventListener('resize', () => world.resize());

function readInput(): Input {
  const k = (a: Action) => keys.has(settings.keys[a]);
  // Camera nhìn về hướng yaw; bên phải màn hình là -X khi yaw = 0, nên phím "phải" -> x = -1.
  const x = (k('left') ? 1 : 0) - (k('right') ? 1 : 0);
  const z = (k('up') ? 1 : 0) - (k('down') ? 1 : 0);
  return { move: [x, z], cam_yaw_deg: camYaw, jump: k('jump'), interact: k('interact'), pulse: k('pulse'), dash: k('dash'), pause: false };
}

// ---------- Màn hình ----------
function screen(html: string, buttons: [string, () => void, boolean?][]) {
  const el = $('screen');
  el.innerHTML = `<div class="box">${html}<div id="btns"></div></div>`;
  for (const [label, fn, alt] of buttons) {
    const b = document.createElement('button');
    b.textContent = label;
    if (alt) b.className = 'alt';
    b.onclick = () => { audio.ensure(); fn(); };
    $('btns').appendChild(b);
  }
  el.style.display = 'flex';
}
const hideScreen = () => ($('screen').style.display = 'none');

const keysHelp = () => {
  const n = (a: Action) => keyName(settings.keys[a]);
  return `<div class="keys">${n('up')}${n('left')}${n('down')}${n('right')}: đi · ${n('jump')}: nhảy · ${n('dash')}: lướt · ${n('interact')}: nạp / châm dầu · ${n('pulse')}: Tỏa Sáng<br>Kéo chuột / ← →: xoay camera · ${n('pause')}: tạm dừng</div>`;
};

function resetCampaign() {
  Object.keys(nightScores).forEach((k) => delete nightScores[+k]);
  campaignSeed = (Math.random() * 2 ** 31) | 0;
}

function showMenu() {
  mode = 'menu';
  $('hud').style.display = 'none';
  screen(`<h1>Đảo Đèn Lồng</h1><p>Ba đêm sương đen. Giúp Mây giữ các Đèn Lồng Lớn sáng tới bình minh.</p>${keysHelp()}`, [
    ['Bắt đầu (Enter)', () => { resetCampaign(); showIntro(1); }],
    ['Đêm 2: Đảo Cau', () => { resetCampaign(); showIntro(2); }, true],
    ['Đêm 3: Đảo Chuông', () => { resetCampaign(); showIntro(3); }, true],
    ['Bảng xếp hạng', showLeaderboard, true],
    ['Cài đặt', () => showSettings('menu'), true],
  ]);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

async function showLeaderboard() {
  mode = 'leaderboard';
  screen('<h1>Bảng xếp hạng</h1><p>Đang tải…</p>', []);
  const { entries, where } = await fetchLeaderboard();
  const rows = entries.map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.name)}</td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${esc(e.achieved_at.slice(0, 16).replace('T', ' '))}</td></tr>`).join('');
  screen(`<h1>Bảng xếp hạng</h1>${entries.length ? `<table class="lb"><tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm</th><th>Lúc</th></tr>${rows}</table>` : '<p>Chưa có điểm nào.</p>'}
    <p class="small">${where === 'disk' ? 'Lưu trên đĩa (.data/leaderboard.json)' : 'Không có server: đang dùng bộ nhớ trình duyệt'}</p>`, [['Về menu', showMenu]]);
}

/** Màn nhập tên sau Bình Minh hoặc sau khi thua (Ticket-04 mục 3). */
function scoreForm(title: string, body: string, after: [string, () => void, boolean?][]) {
  const total = Object.values(nightScores).reduce((a, b) => a + b, 0);
  const won = Object.keys(nightScores).length;
  screen(`<h1>${title}</h1>${body}<p>Tổng điểm: <b>${total}</b> · Đêm đã thắng: ${won}/3</p>
    <label>Tên (3–12 ký tự, có thể có dấu): <input id="lbname" maxlength="24" autocomplete="off"></label><p id="lberr" class="err"></p>`,
  [['Lưu điểm (Enter)', async () => {
    const name = ($('lbname') as HTMLInputElement).value;
    const err = nameError(name);
    if (err) { $('lberr').textContent = err; return; }
    try {
      await submitScore({ name, score: total, nights_won: won, achieved_at: isoWithOffset(new Date()), seed: campaignSeed });
      showLeaderboard();
    } catch (x) { $('lberr').textContent = (x as Error).message; }
  }], ...after]);
  setTimeout(() => ($('lbname') as HTMLInputElement | null)?.focus(), 50);
}

function showKeys() {
  mode = 'keys';
  const dups = duplicateKeys(settings.keys);
  const dupMsg = [...dups].map(([k, a]) => `Phím ${keyName(k)} bị trùng: ${a.map((x) => ACTION_LABEL[x]).join(', ')}`).join('<br>');
  const rows = ACTIONS.map((a) => `<tr><td>${ACTION_LABEL[a]}</td><td><button class="key ${dups.has(settings.keys[a]) ? 'dup' : ''}" data-a="${a}">${rebinding === a ? 'Nhấn phím…' : keyName(settings.keys[a])}</button></td></tr>`).join('');
  screen(`<h1>Đổi phím</h1><table class="lb">${rows}</table><p class="err">${dupMsg ? '⚠ ' + dupMsg : ''}</p>`, [
    ['Xong', () => showSettings(settingsBack)],
    ['Khôi phục mặc định', () => { settings.keys = { ...DEFAULT_KEYS }; saveSettings(settings); showKeys(); }, true],
  ]);
  document.querySelectorAll<HTMLButtonElement>('button.key').forEach((b) => (b.onclick = () => { rebinding = b.dataset.a as Action; b.textContent = 'Nhấn phím…'; }));
}

function showIntro(n: number) {
  mode = 'intro';
  night = n;
  newGame();
  screen(`<h2>Đêm ${n}</h2><h1>${MAPS[n].name}</h1><p class="quote">${ONG_DANG[n]}</p>
    <p>${game.lanterns.length} Đèn Lồng · ${Math.round(timeLeft(game))} giây</p>`, [['Vào Đêm (Enter)', startPlay]]);
}

function showSettings(back: Mode) {
  if (back !== 'keys') settingsBack = back;
  back = settingsBack;
  mode = 'settings';
  screen(`<h1>Cài đặt</h1>
    <label>Âm lượng: <span id="vv">${Math.round(settings.volume * 100)}%</span><input id="vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}"></label>
    <label>Độ nhạy chuột: <span id="sv">${settings.sensitivity.toFixed(1)}</span><input id="sens" type="range" min="0.2" max="3" step="0.1" value="${settings.sensitivity}"></label>
    <label><input id="cb" type="checkbox" ${settings.colorblind ? 'checked' : ''}> Bảng màu dễ phân biệt (mù màu)</label>
    <label><input id="rm" type="checkbox" ${settings.reducedMotion ? 'checked' : ''}> Giảm chuyển động (tắt rung camera, chớp màn hình)</label>
    <label><input id="lt" type="checkbox" ${settings.largeText ? 'checked' : ''}> Chữ lớn (×1.25)</label>`,
  [['Xong', () => (back === 'paused' ? showPause() : showMenu())], ['Đổi phím', showKeys, true]]);
  const rm = $('rm') as HTMLInputElement, lt = $('lt') as HTMLInputElement;
  rm.onchange = () => { settings.reducedMotion = rm.checked; saveSettings(settings); };
  lt.onchange = () => { settings.largeText = lt.checked; applyText(); saveSettings(settings); };
  const vol = $('vol') as HTMLInputElement, sens = $('sens') as HTMLInputElement;
  vol.oninput = () => { settings.volume = +vol.value; audio.setVolume(settings.volume); $('vv').textContent = `${Math.round(settings.volume * 100)}%`; saveSettings(settings); };
  sens.oninput = () => { settings.sensitivity = +sens.value; $('sv').textContent = settings.sensitivity.toFixed(1); saveSettings(settings); };
  const cb = $('cb') as HTMLInputElement;
  cb.onchange = () => { settings.colorblind = cb.checked; applyColorblind(); saveSettings(settings); };
}

function showPause() {
  mode = 'paused';
  screen(`<h1>Tạm dừng</h1><p>Đêm ${night}: ${MAPS[night].name}</p>`, [
    ['Tiếp tục (Esc)', togglePause],
    ['Chơi lại Đêm', () => showIntro(night), true],
    ['Cài đặt', () => showSettings('paused'), true],
    ['Về menu', showMenu, true],
  ]);
}

function togglePause() {
  if (mode === 'play') { showPause(); audio.stopMusic(); }
  else if (mode === 'paused') { hideScreen(); mode = 'play'; last = performance.now(); acc = 0; audio.startMusic(); }
}

function showResult(result: string, reason: string) {
  mode = 'result';
  audio.stopMusic();
  const why: Record<string, string> = { dawn_survived: 'Bình minh tới và đảo vẫn đủ sáng!', dawn: 'Bình minh tới mà đảo chưa sáng đủ.', no_flames: 'Mây đã hết Ngọn Lửa.' };
  if (result === 'won') {
    nightScores[night] = game.score;
    const total = Object.values(nightScores).reduce((a, b) => a + b, 0);
    if (night === 3) {
      mode = 'dawn';
      scoreForm('Bình Minh', '<p>Ba hòn đảo đã sáng trở lại. Cảm ơn con, Mây!</p>', [['Về menu', showMenu, true]]);
    } else {
      screen(`<h1>Đêm ${night} hoàn thành</h1><p>${why[reason]}</p><p>Điểm Đêm: <b>${game.score}</b> · Tổng: <b>${total}</b></p>`,
        [['Đêm kế tiếp (Enter)', () => showIntro(night + 1)], ['Về menu', showMenu, true]]);
    }
  } else {
    scoreForm('Thua rồi', `<p>${why[reason] ?? reason}</p>`, [['Chơi lại Đêm', () => showIntro(night), true], ['Về menu', showMenu, true]]);
  }
}

// ---------- Game ----------
function newGame() {
  const sc: Scenario = {};
  const preLit = Number(params.get('lit') ?? 0); // chỉ để chụp ảnh bằng chứng
  if (preLit > 0) sc.lanterns = Array.from({ length: Math.min(preLit, MAPS[night].lanterns.length - 1) }, (_, i) => ({ id: `L${i + 1}`, lit: true }));
  game = createGame(tuning, (campaignSeed + night) | 0, night, sc);
  world.build(game);
  camYaw = 0;
  facingYaw = 0;
  lastCountdown = -1;
  warnedLow.clear();
  shadeAlert = null;
}

function startPlay() {
  hideScreen();
  $('hud').style.display = 'block';
  mode = 'play';
  acc = 0;
  last = performance.now();
  audio.ensure();
  audio.startMusic();
}

function onEvents(evs: GameEvent[]) {
  for (const e of evs) {
    switch (e.name) {
      case 'mote_picked': audio.play('pickup'); break;
      case 'lantern_lit': audio.play('lit'); break;
      case 'pulse': audio.play('pulse'); world.onPulse(game); break;
      case 'player_hit':
        audio.play('hit');
        if (!settings.reducedMotion) { // giảm chuyển động: tắt chớp màn hình và rung camera
          $('flash').style.opacity = '0.45';
          setTimeout(() => ($('flash').style.opacity = '0'), 160);
          shakeUntil = performance.now() + 300;
        }
        break;
      case 'dash': audio.play('dash'); break;
      case 'shade_spawned': audio.play('spawn'); subtitle('⚠ Bóng Mực xuất hiện'); shadeAlert = { id: e.data.id as string, until: performance.now() + 3000 }; break;
      case 'lantern_out': subtitle(`🏮 Đèn ${e.data.lantern_id} đã tắt`); break;
      case 'charm_picked': audio.play('charm'); break;
      case 'drifter_steal': audio.play('steal'); break;
      case 'game_over': audio.play(e.data.result === 'won' ? 'win' : 'lose'); setTimeout(() => showResult(e.data.result as string, e.data.reason as string), 600); break;
    }
  }
}

// ---------- HUD ----------
const moteCells: HTMLElement[] = [];
for (let i = 0; i < tuning.capacity_max; i++) { const c = document.createElement('i'); $('hud-motes').appendChild(c); moteCells.push(c); }
const moteText = document.createElement('span');
moteText.style.marginLeft = '8px';
$('hud-motes').appendChild(moteText);
const v3 = new THREE.Vector3();

function hud() {
  const g = game, p = g.player;
  $('hud-flames').textContent = '🔥'.repeat(p.flames) + '·'.repeat(Math.max(0, tuning.flames - p.flames));
  const tl = Math.max(0, timeLeft(g));
  const timer = $('hud-timer');
  timer.textContent = `${String(Math.floor(tl / 60)).padStart(2, '0')}:${String(Math.floor(tl % 60)).padStart(2, '0')}`;
  timer.classList.toggle('danger', tl <= 30);
  if (tl <= 30 && settings.colorblind) timer.textContent = '⚠ ' + timer.textContent;
  const lit = g.lanterns.filter((l) => l.lit).length;
  $('hud-right').innerHTML = `Đèn <b>${lit}/${g.lanterns.length}</b><br>Điểm <b>${g.score}</b>`;
  const cap = capacity(g);
  moteCells.forEach((c, i) => { c.classList.toggle('on', i < p.carried); c.style.display = i < cap ? 'block' : 'none'; });
  moteText.textContent = `${p.carried}/${cap}`;
  const dashFrac = p.charmTicks > 0 ? 0 : p.dashCdTicks / (tuning.dash_cooldown_s * TICK_RATE);
  const pulseFrac = p.pulseCdTicks / (tuning.pulse_cooldown_s * TICK_RATE);
  ($('cd-dash').firstElementChild as HTMLElement).style.height = `${(1 - dashFrac) * 100}%`;
  ($('cd-pulse').firstElementChild as HTMLElement).style.height = `${(1 - pulseFrac) * 100}%`;
  $('cd-pulse').style.opacity = p.carried >= tuning.pulse_cost ? '1' : '.45';
  const charm = $('hud-charm');
  charm.style.display = p.charmTicks > 0 ? 'block' : 'none';
  charm.textContent = `Bùa Gió ${(p.charmTicks / TICK_RATE).toFixed(1)}s`;

  const full = (l: (typeof g.lanterns)[number]) => l.lit && l.fuel >= tuning.fuel_max * 60;
  const near = g.lanterns.find((l) => !full(l) && distXZ(l.pos, p.pos) <= tuning.interact_radius);
  const hint = $('hint');
  if (near && g.state === 'playing') { hint.style.display = 'block'; const ik = keyName(settings.keys.interact); hint.textContent = near.lit ? `${ik} — Châm dầu (${(near.fuel / 60).toFixed(0)}/100)` : `${ik} — Nạp ánh sáng (${near.deposited}/${near.everLit ? tuning.relight_cost : tuning.lantern_cost})`; }
  else hint.style.display = 'none';

  // Mũi tên tới đèn chưa sáng gần nhất khi nó ở ngoài màn hình
  const arrow = $('arrow');
  let target = null as null | (typeof g.lanterns)[number];
  let best = Infinity;
  for (const l of g.lanterns) if (!l.lit) { const d = distXZ(l.pos, p.pos); if (d < best) { best = d; target = l; } }
  arrow.style.display = 'none';
  if (target && g.state === 'playing') {
    v3.set(target.pos[0], target.pos[1] + 3, target.pos[2]).project(world.camera);
    const behind = v3.z > 1;
    let x = v3.x, y = v3.y;
    if (behind) { x = -x; y = -y; }
    if (behind || Math.abs(x) > 1 || Math.abs(y) > 1) {
      const m = Math.max(Math.abs(x), Math.abs(y)) || 1;
      x = (x / m) * 0.9; y = (y / m) * 0.9;
      arrow.style.display = 'block';
      arrow.style.left = `${((x + 1) / 2) * innerWidth - 14}px`;
      arrow.style.top = `${((1 - y) / 2) * innerHeight - 14}px`;
      arrow.style.transform = `rotate(${Math.atan2(x, y)}rad)`;
    }
  }

  // Mũi tên ở mép màn hình chỉ tới Bóng Mực vừa xuất hiện (3 s)
  const sa = $('shade-arrow');
  sa.style.display = 'none';
  const sh = shadeAlert && performance.now() < shadeAlert.until ? g.shades.find((s) => s.id === shadeAlert!.id) : undefined;
  if (sh) {
    v3.set(sh.pos[0], sh.pos[1], sh.pos[2]).project(world.camera);
    let x = v3.x, y = v3.y;
    if (v3.z > 1) { x = -x; y = -y; }
    const m = Math.max(Math.abs(x), Math.abs(y), 1e-6);
    x = (x / m) * 0.85; y = (y / m) * 0.85;
    sa.style.display = 'block';
    sa.style.left = `${((x + 1) / 2) * innerWidth - 14}px`;
    sa.style.top = `${((1 - y) / 2) * innerHeight - 14}px`;
    sa.style.transform = `rotate(${Math.atan2(x, y)}rad)`;
  }

  // Phụ đề: đèn dầu < 30
  for (const l of g.lanterns) {
    const low = l.lit && l.fuel < tuning.low_fuel_threshold * 60;
    if (low && !warnedLow.has(l.id)) { warnedLow.add(l.id); subtitle(`🏮 Đèn ${l.id} sắp cạn dầu`); }
    if (!low) warnedLow.delete(l.id);
  }

  // Đếm ngược 10 s cuối
  const sec = Math.ceil(tl);
  if (sec <= 10 && sec > 0 && sec !== lastCountdown) {
    if (sec === 10) subtitle('⏳ Còn 10 giây tới bình minh');
    lastCountdown = sec;
    audio.play('tick');
  }
}

// ---------- Vòng lặp ----------
let fpsFrames = 0, fpsT = performance.now(), fpsSum = 0, fpsN = 0;
const showFps = params.has('fps');
if (showFps) $('fps').style.display = 'block';
let prevWindWarn = false;

function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (mode === 'play') {
    if (keys.has('ArrowLeft')) camYaw += 120 * dt * settings.sensitivity;
    if (keys.has('ArrowRight')) camYaw -= 120 * dt * settings.sensitivity;
    acc += dt;
    while (acc >= 1 / TICK_RATE && mode === 'play' && game.state === 'playing') {
      acc -= 1 / TICK_RATE;
      const inp = readInput();
      const wasGrounded = game.player.grounded;
      onEvents(step(game, inp));
      if (inp.jump && wasGrounded && !game.player.grounded && game.player.vel[1] > 0) audio.play('jump');
    }
    const f = game.player.facing;
    facingYaw = Math.atan2(f[0], f[1]);
    const warn = game.map.wind && game.windEnabled && (1800 - (game.simTick % 1800)) <= 120;
    if (warn && !prevWindWarn) { audio.play('wind'); subtitle('🍃 Gió mạnh sắp thổi'); }
    prevWindWarn = warn;
    hud();
  }
  world.sync(game, now, camYaw, facingYaw);
  if (now < shakeUntil && !settings.reducedMotion) {
    world.camera.position.x += (Math.random() - 0.5) * 0.3;
    world.camera.position.y += (Math.random() - 0.5) * 0.3;
  }
  world.render();

  fpsFrames++;
  if (now - fpsT >= 1000) {
    const fps = (fpsFrames * 1000) / (now - fpsT);
    fpsSum += fps; fpsN++;
    (window as unknown as { __fps: { avg: number; n: number } }).__fps = { avg: fpsSum / fpsN, n: fpsN };
    if (showFps) $('fps').textContent = `${fps.toFixed(0)} FPS (TB ${(fpsSum / fpsN).toFixed(1)})`;
    fpsFrames = 0; fpsT = now;
  }
}

// ---------- Benchmark (Ticket-04 mục 1): ?bench&seed=42&duration=30 ----------
function runBench() {
  const seed = Number(params.get('seed') ?? 42);
  const duration = Number(params.get('duration') ?? 30);
  const WARMUP = 3;
  game = createBenchGame(tuning, seed);
  world.build(game);
  hideScreen();
  const idle: Input = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  const dts: number[] = [], sims: number[] = [], renders: number[] = [];
  const p95 = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.max(0, Math.ceil(0.95 * s.length) - 1)] * 10) / 10; };
  let start = -1, lastT = 0, accB = 0, heapPeak = 0;
  const w = window as unknown as Record<string, unknown>;
  const bf = (now: number) => {
    if (start < 0) { start = now; lastT = now; w.__benchFirstFrameEpoch = Date.now(); }
    const dtms = now - lastT;
    lastT = now;
    const el = (now - start) / 1000;
    accB += dtms / 1000;
    const s0 = performance.now();
    for (let i = 0; i < 8 && accB >= 1 / TICK_RATE; i++) { accB -= 1 / TICK_RATE; step(game, idle); }
    if (accB > 1) accB = 0;
    const simMs = performance.now() - s0;
    // Camera bay vòng tròn tâm (0,0,0), r = 30, Y = 15, bắt đầu ở góc 0° (30,15,0), ngược chiều kim đồng hồ, 15 s/vòng
    const th = (2 * Math.PI * el) / 15;
    world.camera.position.set(30 * Math.cos(th), 15, 30 * Math.sin(th));
    world.camera.lookAt(0, 0, 0);
    const r0 = performance.now();
    world.sync(game, now, 0, 0, true);
    world.render();
    const renderMs = performance.now() - r0;
    if (el > WARMUP && el <= WARMUP + duration) { dts.push(dtms); sims.push(simMs); renders.push(renderMs); }
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    if (mem) heapPeak = Math.max(heapPeak, mem.usedJSHeapSize);
    if (el >= WARMUP + duration) {
      w.__bench = { ...benchStats(dts), js_heap_peak_mb: heapPeak ? Math.round(heapPeak / 1048576) : null,
        viewport: `${innerWidth}x${innerHeight}`, shades: game.shades.length, motes: game.motes.length,
        sim_ms_p95: p95(sims), cpu_render_ms_p95: p95(renders) };
      return;
    }
    requestAnimationFrame(bf);
  };
  requestAnimationFrame(bf);
}

// ?night=N&autostart: vào thẳng Đêm N (dùng để chụp ảnh / đo FPS)
if (params.has('bench')) runBench();
else {
  if (params.has('autostart')) { night = Math.min(3, Math.max(1, Number(params.get('night') ?? 1))); newGame(); startPlay(); }
  else { world.build(game); showMenu(); }
  requestAnimationFrame(frame);
}
