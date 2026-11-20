// Cảnh 3D: dựng bản đồ từ MapDef và đồng bộ thực thể từ state của core. Không chứa luật game.
import * as THREE from 'three';
import type { Game } from '../core/sim.js';
import { ticksToNextWind } from '../core/sim.js';
import { WIND_WARN_TICKS } from '../core/constants.js';

// Bảng màu chuẩn (Ticket-02 Phần 2)
export const PAL = {
  sky: '#0E1430', fog: '#1B2350', grass: '#2F5D50', sand: '#C9B48A', wood: '#6B4A2F', sea: '#12384A',
  lampOn: '#FFB347', lampCore: '#FFE9B0', lampOff: '#5B5F6E', moteCore: '#FFF6C2', moteHalo: '#FFE58A',
  shadeBody: '#120A1A', shadeRim: '#7A3CFF', shadeStun: '#3A3450', robe: '#E8E2D0', scarf: '#C8102E',
  gold: '#F2C14E', drifter: '#8FA3B8', danger: '#FF5A5F', text: '#F5F1E6',
};

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 400);
  private ambient = new THREE.HemisphereLight('#8a90c8', '#1a1830', 0.15);
  private mapGroup = new THREE.Group();
  private lanterns: { glass: THREE.Mesh; light: THREE.PointLight; halo: THREE.Mesh }[] = [];
  private charms: THREE.Group[] = [];
  private motes = new Map<string, THREE.Group>();
  private shades = new Map<string, THREE.Group>();
  private drifters = new Map<string, THREE.Mesh>();
  private may = new THREE.Group();
  private orbit: THREE.Mesh[] = [];
  private pulseRing: THREE.Mesh;
  private leaves: THREE.Points;
  private pulseT = 1;
  private geo = {
    moteCore: new THREE.SphereGeometry(0.13, 8, 6), moteHalo: new THREE.SphereGeometry(0.3, 8, 6),
    shade: new THREE.SphereGeometry(0.8, 16, 12), shadeRim: new THREE.SphereGeometry(0.88, 16, 12),
    drifter: new THREE.BoxGeometry(0.35, 0.06, 1.8),
  };
  private mat = {
    moteCore: new THREE.MeshBasicMaterial({ color: PAL.moteCore }),
    moteHalo: new THREE.MeshBasicMaterial({ color: PAL.moteHalo, transparent: true, opacity: 0.35, depthWrite: false }),
    dropped: new THREE.MeshBasicMaterial({ color: PAL.moteHalo, transparent: true, opacity: 0.6, depthWrite: false }),
    shade: std(PAL.shadeBody), shadeStun: std(PAL.shadeStun),
    shadeRim: new THREE.MeshBasicMaterial({ color: PAL.shadeRim, side: THREE.BackSide, transparent: true, opacity: 0.8 }),
    drifter: std(PAL.drifter, { emissive: PAL.drifter, emissiveIntensity: 0.35, side: THREE.DoubleSide }),
  };

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(PAL.sky);
    this.scene.fog = new THREE.Fog(PAL.fog, 25, 110);
    this.scene.add(this.ambient);
    const moon = new THREE.DirectionalLight('#9fb0ff', 0.5);
    moon.position.set(-30, 60, -20);
    this.scene.add(moon, this.mapGroup);
    const sea = new THREE.Mesh(new THREE.CircleGeometry(400, 48), std(PAL.sea, { emissive: PAL.sea, emissiveIntensity: 0.3 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -12;
    this.scene.add(sea);
    this.buildMay();
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(this.geo.moteCore, this.mat.moteCore);
      this.scene.add(m);
      this.orbit.push(m);
    }
    this.pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 48), new THREE.MeshBasicMaterial({ color: PAL.lampCore, transparent: true, opacity: 0, side: THREE.DoubleSide }));
    this.pulseRing.rotation.x = -Math.PI / 2;
    this.scene.add(this.pulseRing);
    const lp = new Float32Array(80 * 3);
    for (let i = 0; i < 80; i++) { lp[i * 3] = Math.random() * 40 - 20; lp[i * 3 + 1] = Math.random() * 4; lp[i * 3 + 2] = Math.random() * 40 - 20; }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    this.leaves = new THREE.Points(lg, new THREE.PointsMaterial({ color: '#7fae6a', size: 0.25 }));
    this.leaves.visible = false;
    this.scene.add(this.leaves);
    this.resize();
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  private buildMay() {
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 14), std(PAL.robe));
    robe.position.y = 0.6;
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 8, 16), std(PAL.scarf));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.15;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), std('#f1c9a0'));
    head.position.y = 1.4;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.42, 20), std(PAL.sand));
    hat.position.y = 1.75;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: PAL.lampOn }));
    lamp.position.set(0, 1.4, 0.72);
    const light = new THREE.PointLight(PAL.lampOn, 3, 10, 2);
    light.position.set(0, 1.6, 0.5);
    this.may.add(robe, scarf, head, hat, lamp, light);
    this.scene.add(this.may);
  }

  /** Dựng lại bản đồ cho Đêm của game g. */
  build(g: Game) {
    for (const c of [...this.mapGroup.children]) this.mapGroup.remove(c);
    for (const m of this.motes.values()) this.scene.remove(m);
    for (const s of this.shades.values()) this.scene.remove(s);
    for (const d of this.drifters.values()) this.scene.remove(d);
    this.motes.clear(); this.shades.clear(); this.drifters.clear();
    this.lanterns = []; this.charms = [];
    const add = (o: THREE.Object3D) => this.mapGroup.add(o);
    const island = (x: number, z: number, r: number) => {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, 6, 64), std(PAL.grass));
      top.position.set(x, -3, z);
      const beach = new THREE.Mesh(new THREE.RingGeometry(r - 2.5, r, 64), std(PAL.sand));
      beach.rotation.x = -Math.PI / 2;
      beach.position.set(x, 0.02, z);
      add(top); add(beach);
    };
    const pad = (x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.15, 24), std(PAL.gold, { emissive: PAL.gold, emissiveIntensity: 0.6 }));
      m.position.set(x, y + 0.08, z);
      add(m);
    };
    if (g.night === 1) island(0, 0, 40);
    if (g.night === 2) {
      island(0, 0, 28); island(70, 0, 28);
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), std(PAL.wood));
      bridge.position.set(35, -0.15, 0);
      add(bridge);
      for (const p of g.map.pads) pad(p.pos[0], p.pos[1], p.pos[2]);
    }
    if (g.night === 3) {
      island(0, 0, 45);
      const shape = new THREE.Shape();
      shape.absarc(0, 0, 24, Math.PI, 2 * Math.PI, false);
      shape.absarc(0, 0, 12, 2 * Math.PI, Math.PI, true);
      const tier1 = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false, curveSegments: 32 }), std('#3a6b5c'));
      tier1.rotation.x = -Math.PI / 2;
      add(tier1);
      const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), std('#457a69'));
      tier2.position.y = 3;
      add(tier2);
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 8, 24), std(PAL.wood));
      tower.position.y = 10;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 2, 24), std('#8a3a2a'));
      roof.position.y = 15;
      add(tower); add(roof);
      for (const a of [30, 150]) {
        const grp = new THREE.Group();
        grp.rotation.y = -(a * Math.PI) / 180;
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(6, 3), 0.3, 3), std(PAL.sand));
        ramp.position.set(27, 1.35, 0);
        ramp.rotation.z = -Math.atan2(3, 6);
        grp.add(ramp);
        add(grp);
      }
      for (const p of g.map.pads) pad(p.pos[0], p.pos[1], p.pos[2]);
    }
    for (const l of g.lanterns) {
      const grp = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3, 8), std(PAL.wood));
      pole.position.y = 1.5;
      const glass = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), std(PAL.lampOff, { emissive: '#000000' }));
      glass.position.y = 3.3;
      const light = new THREE.PointLight(PAL.lampOn, 0, 26, 1.5);
      light.position.y = 3.3;
      const halo = new THREE.Mesh(new THREE.RingGeometry(g.tuning.safe_radius - 0.12, g.tuning.safe_radius, 64), new THREE.MeshBasicMaterial({ color: PAL.lampOn, transparent: true, opacity: 0, side: THREE.DoubleSide }));
      halo.rotation.x = -Math.PI / 2;
      halo.position.y = 0.05;
      grp.add(pole, glass, light, halo);
      grp.position.set(l.pos[0], l.pos[1], l.pos[2]);
      add(grp);
      this.lanterns.push({ glass, light, halo });
    }
    for (const c of g.charms) {
      const grp = new THREE.Group();
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.04), std(PAL.scarf, { emissive: PAL.scarf, emissiveIntensity: 0.4 }));
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(card.geometry), new THREE.LineBasicMaterial({ color: PAL.gold }));
      grp.add(card, edge);
      grp.position.set(c.pos[0], c.pos[1] + 1, c.pos[2]);
      add(grp);
      this.charms.push(grp);
    }
  }

  onPulse(g: Game) {
    this.pulseT = 0;
    this.pulseRing.position.set(g.player.pos[0], g.player.pos[1] + 0.1, g.player.pos[2]);
  }

  sync(g: Game, t: number, camYaw: number, facingYaw: number) {
    const p = g.player;
    this.may.position.set(p.pos[0], p.pos[1], p.pos[2]);
    this.may.rotation.y = facingYaw;
    this.may.visible = p.fallWait === 0 && (p.invulnTicks === 0 || Math.floor(t / 80) % 2 === 0);

    const lit = g.lanterns.filter((l) => l.lit).length;
    g.lanterns.forEach((l, i) => {
      const v = this.lanterns[i];
      if (!v) return;
      const m = v.glass.material as THREE.MeshStandardMaterial;
      m.color.set(l.lit ? PAL.lampOn : PAL.lampOff);
      m.emissive.set(l.lit ? PAL.lampCore : '#000000');
      m.emissiveIntensity = l.lit ? 1 : 0;
      v.light.intensity = l.lit ? 40 : 0;
      (v.halo.material as THREE.MeshBasicMaterial).opacity = l.lit ? 0.4 : 0;
    });
    this.ambient.intensity = 0.15 + 0.55 * (lit / g.lanterns.length); // công thức chuẩn

    g.charms.forEach((c, i) => {
      const v = this.charms[i];
      v.visible = c.available;
      v.rotation.y = t / 600;
      v.position.y = c.pos[1] + 1 + 0.15 * Math.sin(t / 300);
    });

    const seen = new Set<string>();
    for (const m of g.motes) {
      seen.add(m.id);
      let v = this.motes.get(m.id);
      if (!v) {
        v = new THREE.Group();
        v.add(new THREE.Mesh(this.geo.moteCore, this.mat.moteCore), new THREE.Mesh(this.geo.moteHalo, m.kind === 'dropped' ? this.mat.dropped : this.mat.moteHalo));
        this.scene.add(v);
        this.motes.set(m.id, v);
      }
      const blink = m.kind === 'dropped' && m.ttl < 120 && Math.floor(t / 120) % 2 === 0;
      v.visible = !blink;
      v.position.set(m.pos[0], m.pos[1] + 0.6 + 0.15 * Math.sin(t / 300 + m.pos[0]), m.pos[2]);
    }
    for (const [id, v] of this.motes) if (!seen.has(id)) { this.scene.remove(v); this.motes.delete(id); }

    seen.clear();
    for (const s of g.shades) {
      seen.add(s.id);
      let v = this.shades.get(s.id);
      if (!v) {
        v = new THREE.Group();
        v.add(new THREE.Mesh(this.geo.shade, this.mat.shade), new THREE.Mesh(this.geo.shadeRim, this.mat.shadeRim));
        this.scene.add(v);
        this.shades.set(s.id, v);
      }
      (v.children[0] as THREE.Mesh).material = s.state === 'stunned' ? this.mat.shadeStun : this.mat.shade;
      v.children[1].visible = s.state !== 'stunned';
      const k = s.state === 'spawning' ? Math.max(0.15, 1 - s.stateTicks / 60) : s.state === 'stunned' ? 0.75 : 1 + 0.06 * Math.sin(t / 150);
      v.scale.setScalar(k);
      v.position.set(s.pos[0], s.pos[1] + 0.12 * Math.sin(t / 200 + s.pos[2]), s.pos[2]);
    }
    for (const [id, v] of this.shades) if (!seen.has(id)) { this.scene.remove(v); this.shades.delete(id); }

    seen.clear();
    for (const d of g.drifters) {
      if (d.state === 'removed') continue;
      seen.add(d.id);
      let v = this.drifters.get(d.id);
      if (!v) { v = new THREE.Mesh(this.geo.drifter, this.mat.drifter); this.scene.add(v); this.drifters.set(d.id, v); }
      v.position.set(d.pos[0], d.pos[1] + 0.3 * Math.sin(t / 180), d.pos[2]);
      v.rotation.set(0.4 * Math.sin(t / 120), Math.atan2(p.pos[0] - d.pos[0], p.pos[2] - d.pos[2]), 0.5 * Math.sin(t / 90));
    }
    for (const [id, v] of this.drifters) if (!seen.has(id)) { this.scene.remove(v); this.drifters.delete(id); }

    this.orbit.forEach((m, i) => {
      m.visible = p.fallWait === 0 && i < p.carried;
      const a = t / 500 + (i * Math.PI * 2) / Math.max(1, p.carried);
      m.position.set(p.pos[0] + Math.sin(a) * 0.9, p.pos[1] + 1.1 + 0.2 * Math.sin(t / 250 + i), p.pos[2] + Math.cos(a) * 0.9);
    });

    const ring = this.pulseRing.material as THREE.MeshBasicMaterial;
    if (this.pulseT < 1) {
      this.pulseT += 1 / 30;
      this.pulseRing.scale.setScalar(Math.max(0.01, this.pulseT * g.tuning.pulse_radius));
      ring.opacity = 1 - this.pulseT;
    } else ring.opacity = 0;

    // Gió: lá bay báo trước 2 s và trong lúc gió thổi
    const warn = ticksToNextWind(g) <= WIND_WARN_TICKS || g.wind.ticks > 0;
    this.leaves.visible = warn;
    if (warn) {
      const a = (g.wind.dirDeg * Math.PI) / 180;
      const pos = this.leaves.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i) + Math.cos(a) * 0.3, z = pos.getZ(i) + Math.sin(a) * 0.3;
        if (Math.abs(x) > 20) x = -Math.sign(x) * 20;
        if (Math.abs(z) > 20) z = -Math.sign(z) * 20;
        pos.setXYZ(i, x, pos.getY(i), z);
      }
      pos.needsUpdate = true;
      this.leaves.position.set(p.pos[0], p.pos[1], p.pos[2]);
    }

    const th = (camYaw * Math.PI) / 180;
    this.camera.position.set(p.pos[0] - Math.sin(th) * 9, p.pos[1] + 5.5, p.pos[2] - Math.cos(th) * 9);
    this.camera.lookAt(p.pos[0], p.pos[1] + 1.2, p.pos[2]);
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
