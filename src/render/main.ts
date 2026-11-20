// Luồng game có đồ họa: menu → giới thiệu Đêm → chơi → kết quả → Đêm kế → Bình Minh.
// Core chạy 60 tick/giây cố định; tạm dừng thì không gọi step (logic dừng hoàn toàn).
import * as THREE from 'three';
import contract from '../../game.contract.json';
import { createGame, step, timeLeft, distXZ, type Game } from '../core/sim.js';
import { TICK_RATE } from '../core/constants.js';
import { MAPS } from '../core/maps.js';
import type { GameEvent, Input, Scenario, Tuning } from '../core/types.js';
import { World } from './world.js';
import { Audio } from './audio.js';
import { loadSettings, saveSettings } from './settings.js';

const tuning = contract.tuning as Tuning;
const $ = (id: string) => document.getElementById(id)!;
const params = new URLSearchParams(location.search);

const world = new World($('app'));
const audio = new Audio();
const settings = loadSettings();
audio.setVolume(settings.volume);

const ONG_DANG: Record<number, string> = {
  1: '“Mây à, sương đen tràn về Đảo Bến rồi. Gom đom đóm, thắp lại năm ngọn đèn trước khi trời sáng nhé.” – Ông Đăng',
  2: '“Đảo Cau có hai hòn, nối bằng cây cầu tre. Coi chừng Gió Lạc, nó thích giật đom đóm của con lắm.” – Ông Đăng',
  3: '“Đảo Chuông cao nhất làng. Đi dốc mà lên, nhún bục mà nhảy, và nhớ giữ chân khi gió mạnh nổi lên.” – Ông Đăng',
};

type Mode = 'menu' | 'intro' | 'play' | 'paused' | 'result' | 'dawn' | 'settings';
let mode: Mode = 'menu';
let settingsBack: Mode = 'menu';
let night = 1;
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
  keys.add(e.code);
  if (['Space', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if ((e.code === 'Escape' || e.code === 'KeyP') && (mode === 'play' || mode === 'paused')) togglePause();
  else if (e.code === 'Enter') ($('screen').querySelector('button') as HTMLButtonElement | null)?.click();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); if (mode === 'play') togglePause(); });
world.renderer.domElement.addEventListener('pointerdown', () => (dragging = true));
addEventListener('pointerup', () => (dragging = false));
addEventListener('pointermove', (e) => { if (dragging && mode === 'play') camYaw -= e.movementX * 0.3 * settings.sensitivity; });
addEventListener('resize', () => world.resize());

function readInput(): Input {
  const k = (c: string) => keys.has(c);
  // Camera nhìn về hướng yaw; bên phải màn hình là -X khi yaw = 0, nên D -> x = -1.
  const x = (k('KeyA') ? 1 : 0) - (k('KeyD') ? 1 : 0);
  const z = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0);
  return { move: [x, z], cam_yaw_deg: camYaw, jump: k('Space'), interact: k('KeyE'), pulse: k('KeyF'),
    dash: k('ShiftLeft') || k('ShiftRight'), pause: false };
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

const KEYS_HELP = `<div class="keys">WASD: đi · Space: nhảy · Shift: lướt · E: nạp đèn · F: Tỏa Sáng<br>Kéo chuột / ← →: xoay camera · Esc / P: tạm dừng</div>`;

function showMenu() {
  mode = 'menu';
  $('hud').style.display = 'none';
  screen(`<h1>Đảo Đèn Lồng</h1><p>Ba đêm sương đen. Giúp Mây gom đom đóm và thắp lại các Đèn Lồng Lớn.</p>${KEYS_HELP}`, [
    ['Bắt đầu (Enter)', () => { Object.keys(nightScores).forEach((k) => delete nightScores[+k]); showIntro(1); }],
    ['Đêm 2: Đảo Cau', () => showIntro(2), true],
    ['Đêm 3: Đảo Chuông', () => showIntro(3), true],
    ['Cài đặt', () => showSettings('menu'), true],
  ]);
}

function showIntro(n: number) {
  mode = 'intro';
  night = n;
  newGame();
  screen(`<h2>Đêm ${n}</h2><h1>${MAPS[n].name}</h1><p class="quote">${ONG_DANG[n]}</p>
    <p>${game.lanterns.length} Đèn Lồng · ${Math.round(timeLeft(game))} giây</p>`, [['Vào Đêm (Enter)', startPlay]]);
}

function showSettings(back: Mode) {
  settingsBack = back;
  mode = 'settings';
  screen(`<h1>Cài đặt</h1>
    <label>Âm lượng: <span id="vv">${Math.round(settings.volume * 100)}%</span><input id="vol" type="range" min="0" max="1" step="0.05" value="${settings.volume}"></label>
    <label>Độ nhạy chuột: <span id="sv">${settings.sensitivity.toFixed(1)}</span><input id="sens" type="range" min="0.2" max="3" step="0.1" value="${settings.sensitivity}"></label>`,
  [['Xong', () => (back === 'paused' ? showPause() : showMenu())]]);
  const vol = $('vol') as HTMLInputElement, sens = $('sens') as HTMLInputElement;
  vol.oninput = () => { settings.volume = +vol.value; audio.setVolume(settings.volume); $('vv').textContent = `${Math.round(settings.volume * 100)}%`; saveSettings(settings); };
  sens.oninput = () => { settings.sensitivity = +sens.value; $('sv').textContent = settings.sensitivity.toFixed(1); saveSettings(settings); };
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
  const why: Record<string, string> = { all_lit: 'Tất cả Đèn Lồng đã sáng lại!', dawn: 'Bình minh tới mà đảo chưa sáng đủ.', no_flames: 'Mây đã hết Ngọn Lửa.' };
  if (result === 'won') {
    nightScores[night] = game.score;
    const total = Object.values(nightScores).reduce((a, b) => a + b, 0);
    if (night === 3) {
      mode = 'dawn';
      screen(`<h1>Bình Minh</h1><p>Ba hòn đảo đã sáng trở lại. Cảm ơn con, Mây!</p><p>Tổng điểm: <b>${total}</b></p>`, [['Về menu', showMenu]]);
    } else {
      screen(`<h1>Đêm ${night} hoàn thành</h1><p>${why[reason]}</p><p>Điểm Đêm: <b>${game.score}</b> · Tổng: <b>${total}</b></p>`,
        [['Đêm kế tiếp (Enter)', () => showIntro(night + 1)], ['Về menu', showMenu, true]]);
    }
  } else {
    screen(`<h1>Thua rồi</h1><p>${why[reason] ?? reason}</p>`, [['Chơi lại Đêm (Enter)', () => showIntro(night)], ['Về menu', showMenu, true]]);
  }
}

// ---------- Game ----------
function newGame() {
  const sc: Scenario = {};
  const preLit = Number(params.get('lit') ?? 0); // chỉ để chụp ảnh bằng chứng
  if (preLit > 0) sc.lanterns = Array.from({ length: Math.min(preLit, MAPS[night].lanterns.length - 1) }, (_, i) => ({ id: `L${i + 1}`, lit: true }));
  game = createGame(tuning, (Math.random() * 2 ** 31) | 0, night, sc);
  world.build(game);
  camYaw = 0;
  facingYaw = 0;
  lastCountdown = -1;
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
      case 'player_hit': audio.play('hit'); $('flash').style.opacity = '0.45'; setTimeout(() => ($('flash').style.opacity = '0'), 160); break;
      case 'dash': audio.play('dash'); break;
      case 'shade_spawned': audio.play('spawn'); break;
      case 'charm_picked': audio.play('charm'); break;
      case 'drifter_steal': audio.play('steal'); break;
      case 'game_over': audio.play(e.data.result === 'won' ? 'win' : 'lose'); setTimeout(() => showResult(e.data.result as string, e.data.reason as string), 600); break;
    }
  }
}

// ---------- HUD ----------
const moteCells: HTMLElement[] = [];
for (let i = 0; i < tuning.carry_capacity; i++) { const c = document.createElement('i'); $('hud-motes').appendChild(c); moteCells.push(c); }
const v3 = new THREE.Vector3();

function hud() {
  const g = game, p = g.player;
  $('hud-flames').textContent = '🔥'.repeat(p.flames) + '·'.repeat(Math.max(0, tuning.flames - p.flames));
  const tl = Math.max(0, timeLeft(g));
  const timer = $('hud-timer');
  timer.textContent = `${String(Math.floor(tl / 60)).padStart(2, '0')}:${String(Math.floor(tl % 60)).padStart(2, '0')}`;
  timer.classList.toggle('danger', tl <= 30);
  const lit = g.lanterns.filter((l) => l.lit).length;
  $('hud-right').innerHTML = `Đèn <b>${lit}/${g.lanterns.length}</b><br>Điểm <b>${g.score}</b>`;
  moteCells.forEach((c, i) => c.classList.toggle('on', i < p.carried));
  const dashFrac = p.charmTicks > 0 ? 0 : p.dashCdTicks / (tuning.dash_cooldown_s * TICK_RATE);
  const pulseFrac = p.pulseCdTicks / (tuning.pulse_cooldown_s * TICK_RATE);
  ($('cd-dash').firstElementChild as HTMLElement).style.height = `${(1 - dashFrac) * 100}%`;
  ($('cd-pulse').firstElementChild as HTMLElement).style.height = `${(1 - pulseFrac) * 100}%`;
  $('cd-pulse').style.opacity = p.carried >= tuning.pulse_cost ? '1' : '.45';
  const charm = $('hud-charm');
  charm.style.display = p.charmTicks > 0 ? 'block' : 'none';
  charm.textContent = `Bùa Gió ${(p.charmTicks / TICK_RATE).toFixed(1)}s`;

  const near = g.lanterns.find((l) => !l.lit && distXZ(l.pos, p.pos) <= tuning.interact_radius);
  const hint = $('hint');
  if (near && g.state === 'playing') { hint.style.display = 'block'; hint.textContent = `E — Nạp ánh sáng (${near.deposited}/${tuning.lantern_cost})`; }
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

  // Đếm ngược 10 s cuối
  const sec = Math.ceil(tl);
  if (sec <= 10 && sec > 0 && sec !== lastCountdown) { lastCountdown = sec; audio.play('tick'); }
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
    if (warn && !prevWindWarn) audio.play('wind');
    prevWindWarn = warn;
    hud();
  }
  world.sync(game, now, camYaw, facingYaw);
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

// ?night=N&autostart: vào thẳng Đêm N (dùng để chụp ảnh / đo FPS)
if (params.has('autostart')) { night = Math.min(3, Math.max(1, Number(params.get('night') ?? 1))); newGame(); startPlay(); }
else { world.build(game); showMenu(); }
requestAnimationFrame(frame);
