// Bản chơi có đồ họa: core chạy ở 60 tick/giây cố định, Three.js chỉ vẽ lại state.
import * as THREE from 'three';
import contract from '../../game.contract.json';
import { createGame, step, timeLeft, distXZ, type Game } from '../core/sim.js';
import { ISLAND_RADIUS, TICK_RATE } from '../core/constants.js';
import type { GameEvent, Input, Tuning } from '../core/types.js';

const tuning = contract.tuning as Tuning;
const $ = (id: string) => document.getElementById(id)!;

// ---------- Scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const DARK = new THREE.Color('#140a24');
const WARM = new THREE.Color('#3a2a3a');
scene.background = DARK.clone();
scene.fog = new THREE.Fog(DARK.clone(), 18, 70);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);

const ambient = new THREE.HemisphereLight('#6a5a9a', '#1a1020', 0.35);
scene.add(ambient);
const moon = new THREE.DirectionalLight('#8f9bd6', 0.35);
moon.position.set(-20, 40, -10);
scene.add(moon);

const water = new THREE.Mesh(new THREE.CircleGeometry(200, 48), new THREE.MeshStandardMaterial({ color: '#0d1530', roughness: 0.4 }));
water.rotation.x = -Math.PI / 2;
water.position.y = -0.6;
scene.add(water);
const island = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS + 3, 1.2, 64), new THREE.MeshStandardMaterial({ color: '#2e4a32', roughness: 1 }));
island.position.y = -0.6;
scene.add(island);
// Vài bụi cây trang trí (cố định, không ảnh hưởng logic)
const bushMat = new THREE.MeshStandardMaterial({ color: '#23402b' });
for (let i = 0; i < 40; i++) {
  const a = i * 2.39996, r = 8 + ((i * 37) % 29);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.6 + (i % 3) * 0.3, 8, 6), bushMat);
  b.position.set(r * Math.sin(a), 0.2, r * Math.cos(a));
  scene.add(b);
}

// ---------- Mây ----------
const may = new THREE.Group();
const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 1.1, 12), new THREE.MeshStandardMaterial({ color: '#3d6fb0' }));
body.position.y = 0.55;
const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshStandardMaterial({ color: '#f1c9a0' }));
head.position.y = 1.35;
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.45, 20), new THREE.MeshStandardMaterial({ color: '#d9b56b' }));
hat.position.y = 1.72;
const hatLamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffb547' }));
hatLamp.position.set(0, 1.35, 0.72);
const hatLight = new THREE.PointLight('#ffb547', 2, 8, 2);
hatLight.position.copy(hatLamp.position);
may.add(body, head, hat, hatLamp, hatLight);
scene.add(may);

// ---------- Thực thể động ----------
const moteGeo = new THREE.SphereGeometry(0.15, 8, 6);
const moteMat = new THREE.MeshBasicMaterial({ color: '#fff27a' });
const shadeGeo = new THREE.SphereGeometry(0.8, 16, 12);
const shadeMat = new THREE.MeshStandardMaterial({ color: '#2a0f3a', emissive: '#3b0d55', emissiveIntensity: 0.6 });
const shadeStunMat = new THREE.MeshStandardMaterial({ color: '#8a7aa0', emissive: '#c9b8ff', emissiveIntensity: 0.4, transparent: true, opacity: 0.6 });
const motes = new Map<string, THREE.Mesh>();
const shades = new Map<string, THREE.Mesh>();
const lanternViews: { glass: THREE.Mesh; light: THREE.PointLight; halo: THREE.Mesh }[] = [];
const carriedOrbit: THREE.Mesh[] = [];
for (let i = 0; i < tuning.carry_capacity; i++) {
  const m = new THREE.Mesh(moteGeo, moteMat);
  m.scale.setScalar(0.7);
  scene.add(m);
  carriedOrbit.push(m);
}
const pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, side: THREE.DoubleSide }));
pulseRing.rotation.x = -Math.PI / 2;
scene.add(pulseRing);

function buildLanterns(g: Game) {
  for (const v of lanternViews) { scene.remove(v.glass.parent!); }
  lanternViews.length = 0;
  for (const l of g.lanterns) {
    const grp = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3, 8), new THREE.MeshStandardMaterial({ color: '#4a3424' }));
    pole.position.y = 1.5;
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), new THREE.MeshStandardMaterial({ color: '#553322', emissive: '#000000' }));
    glass.position.y = 3.3;
    const light = new THREE.PointLight('#ffa040', 0, 22, 1.6);
    light.position.y = 3.3;
    const halo = new THREE.Mesh(new THREE.RingGeometry(tuning.safe_radius - 0.1, tuning.safe_radius, 48), new THREE.MeshBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0, side: THREE.DoubleSide }));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.05;
    grp.add(pole, glass, light, halo);
    grp.position.set(l.pos[0], 0, l.pos[2]);
    scene.add(grp);
    lanternViews.push({ glass, light, halo });
  }
}

// ---------- Input ----------
const keys = new Set<string>();
let camYaw = 0; // độ, theo quy ước contract: yaw 0 -> camera nhìn về +Z
let dragging = false;
addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'Enter' && !running) start();
  if (e.code === 'KeyR') start();
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
renderer.domElement.addEventListener('pointerdown', () => (dragging = true));
addEventListener('pointerup', () => (dragging = false));
addEventListener('pointermove', (e) => { if (dragging) camYaw -= e.movementX * 0.3; });
$('start').addEventListener('click', () => start());

function readInput(): Input {
  const k = (c: string) => keys.has(c);
  // Nhìn về +Z thì bên phải màn hình là -X, nên D -> x = -1.
  const x = (k('KeyA') ? 1 : 0) - (k('KeyD') ? 1 : 0);
  const z = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0);
  return { move: [x, z], cam_yaw_deg: camYaw, jump: k('Space'), interact: k('KeyE'), pulse: k('KeyF'), dash: false };
}

// ---------- Vòng lặp ----------
let game: Game;
let running = false;
let acc = 0;
let last = performance.now();
let pulseT = 1;

function start() {
  // ?lit=N: thắp sẵn N đèn (chỉ để chụp ảnh bằng chứng hiệu ứng đảo sáng dần)
  const preLit = Number(new URLSearchParams(location.search).get('lit') ?? 0);
  const lanterns = Array.from({ length: Math.min(preLit, 4) }, (_, i) => ({ id: `L${i + 1}`, lit: true }));
  game = createGame(tuning, (Math.random() * 2 ** 31) | 0, { lanterns });
  buildLanterns(game);
  for (const m of motes.values()) scene.remove(m);
  for (const s of shades.values()) scene.remove(s);
  motes.clear(); shades.clear();
  camYaw = 0;
  running = true;
  $('overlay').style.display = 'none';
}

function onEvents(evs: GameEvent[]) {
  for (const e of evs) {
    if (e.name === 'pulse') { pulseT = 0; pulseRing.position.set(game.player.pos[0], 0.1, game.player.pos[2]); }
    if (e.name === 'player_hit') { $('flash').style.opacity = '0.5'; setTimeout(() => ($('flash').style.opacity = '0'), 160); }
    if (e.name === 'game_over') showEnd(e.data.result as string, e.data.reason as string);
  }
}

function showEnd(result: string, reason: string) {
  const why: Record<string, string> = { all_lit: 'Cả 5 Đèn Lồng Lớn đã sáng lại!', dawn: 'Bình minh đã tới mà đảo vẫn chưa sáng đủ.', no_flames: 'Mây đã hết lửa.' };
  $('overlay').innerHTML = `<div class="box"><h1>${result === 'won' ? 'Đảo đã sáng!' : 'Thua rồi'}</h1>
    <p>${why[reason] ?? reason}</p><p>Điểm: <b>${game.score}</b></p><button id="again">Chơi lại (R)</button></div>`;
  $('overlay').style.display = 'flex';
  $('again').addEventListener('click', () => start());
}

function sync(t: number) {
  const g = game;
  const p = g.player;
  may.position.set(p.pos[0], p.pos[1], p.pos[2]);
  const mv = readInput().move;
  if (mv[0] || mv[1]) {
    const th = (camYaw * Math.PI) / 180;
    const wx = mv[0] * Math.cos(th) + mv[1] * Math.sin(th);
    const wz = -mv[0] * Math.sin(th) + mv[1] * Math.cos(th);
    may.rotation.y = Math.atan2(wx, wz);
  }
  may.visible = p.invulnTicks === 0 || Math.floor(t / 80) % 2 === 0;

  const lit = g.lanterns.filter((l) => l.lit).length;
  g.lanterns.forEach((l, i) => {
    const v = lanternViews[i];
    (v.glass.material as THREE.MeshStandardMaterial).emissive.set(l.lit ? '#ffa040' : '#000000');
    v.light.intensity = l.lit ? 30 : 0;
    (v.halo.material as THREE.MeshBasicMaterial).opacity = l.lit ? 0.35 : 0;
  });
  const k = lit / g.lanterns.length;
  (scene.background as THREE.Color).copy(DARK).lerp(WARM, k);
  (scene.fog as THREE.Fog).color.copy(scene.background as THREE.Color);
  (scene.fog as THREE.Fog).far = 70 + 60 * k;
  ambient.intensity = 0.6 + 0.8 * k;

  const seenM = new Set<string>();
  for (const m of g.motes) {
    seenM.add(m.id);
    let mesh = motes.get(m.id);
    if (!mesh) { mesh = new THREE.Mesh(moteGeo, moteMat); scene.add(mesh); motes.set(m.id, mesh); }
    mesh.position.set(m.pos[0], 0.6 + 0.2 * Math.sin(t / 300 + m.pos[0]), m.pos[2]);
  }
  for (const [id, mesh] of motes) if (!seenM.has(id)) { scene.remove(mesh); motes.delete(id); }

  const seenS = new Set<string>();
  for (const s of g.shades) {
    seenS.add(s.id);
    let mesh = shades.get(s.id);
    if (!mesh) { mesh = new THREE.Mesh(shadeGeo, shadeMat); scene.add(mesh); shades.set(s.id, mesh); }
    mesh.material = s.state === 'stunned' ? shadeStunMat : shadeMat;
    mesh.position.set(s.pos[0], s.pos[1] + 0.15 * Math.sin(t / 200 + s.pos[2]), s.pos[2]);
    mesh.scale.set(1, s.state === 'stunned' ? 0.6 : 1 + 0.08 * Math.sin(t / 150), 1);
  }
  for (const [id, mesh] of shades) if (!seenS.has(id)) { scene.remove(mesh); shades.delete(id); }

  // Sáng tạo (chỉ hiển thị): đom đóm đang mang bay vòng quanh Mây
  carriedOrbit.forEach((m, i) => {
    m.visible = i < p.carried;
    const a = t / 500 + (i * Math.PI * 2) / Math.max(1, p.carried);
    m.position.set(p.pos[0] + Math.sin(a) * 0.9, p.pos[1] + 1.1 + 0.25 * Math.sin(t / 250 + i), p.pos[2] + Math.cos(a) * 0.9);
  });

  if (pulseT < 1) {
    pulseT += 1 / 30;
    pulseRing.scale.setScalar(Math.max(0.01, pulseT * tuning.pulse_radius));
    (pulseRing.material as THREE.MeshBasicMaterial).opacity = 1 - pulseT;
  } else (pulseRing.material as THREE.MeshBasicMaterial).opacity = 0;

  const th = (camYaw * Math.PI) / 180;
  camera.position.set(p.pos[0] - Math.sin(th) * 9, p.pos[1] + 5.5, p.pos[2] - Math.cos(th) * 9);
  camera.lookAt(p.pos[0], p.pos[1] + 1.2, p.pos[2]);

  const tl = Math.max(0, timeLeft(g));
  const cd = p.pulseCooldownTicks > 0 ? ` (hồi ${(p.pulseCooldownTicks / TICK_RATE).toFixed(1)}s)` : '';
  $('hud').innerHTML = `Đèn: <b>${lit}/${g.lanterns.length}</b> · Lửa: <b>${'●'.repeat(p.flames)}${'○'.repeat(Math.max(0, tuning.flames - p.flames))}</b><br>
    Đom đóm: <b>${p.carried}/${tuning.carry_capacity}</b> · Xung sáng${cd}<br>
    Còn: <b>${Math.floor(tl / 60)}:${String(Math.floor(tl % 60)).padStart(2, '0')}</b> · Điểm: <b>${g.score}</b>`;
  const near = g.lanterns.find((l) => !l.lit && distXZ(l.pos, p.pos) <= tuning.interact_radius);
  const hint = $('hint');
  if (near && g.state === 'playing') {
    hint.style.display = 'block';
    hint.textContent = p.carried > 0 ? `E: nạp đom đóm vào ${near.id} (${near.deposited}/${tuning.lantern_cost})` : `${near.id} cần ${tuning.lantern_cost - near.deposited} đom đóm nữa`;
  } else hint.style.display = 'none';
}

function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (keys.has('ArrowLeft')) camYaw += 120 * dt;
  if (keys.has('ArrowRight')) camYaw -= 120 * dt;
  if (running && game.state === 'playing') {
    acc += dt;
    while (acc >= 1 / TICK_RATE) {
      acc -= 1 / TICK_RATE;
      onEvents(step(game, readInput()));
      if (game.state !== 'playing') { running = false; break; }
    }
  }
  if (game) sync(now);
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

game = createGame(tuning, 1);
buildLanterns(game);
if (new URLSearchParams(location.search).has('autostart')) start(); // dùng khi chụp ảnh bằng chứng
requestAnimationFrame(frame);
