// Âm thanh tổng hợp bằng WebAudio (tự tạo trong code, không dùng file ngoài).
type Sfx = 'pickup' | 'lit' | 'pulse' | 'hit' | 'jump' | 'dash' | 'win' | 'lose' | 'spawn' | 'tick' | 'wind' | 'charm' | 'steal';

export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private musicTimer: number | null = null;
  volume = 0.6;

  ensure() {
    if (this.ctx) { void this.ctx.resume(); return; }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.18;
      this.musicGain.connect(this.master);
    } catch { this.ctx = null; }
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.ctx) this.master.gain.value = v;
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.3, slideTo?: number, delay = 0, dest?: AudioNode) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest ?? this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(s: Sfx) {
    switch (s) {
      case 'pickup': this.tone(1320, 0.12, 'sine', 0.2, 1760); break;
      case 'lit': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.25, undefined, i * 0.08)); break;
      case 'pulse': this.tone(220, 0.6, 'sine', 0.35, 880); this.tone(440, 0.5, 'triangle', 0.15, 1320); break;
      case 'hit': this.tone(180, 0.35, 'sawtooth', 0.3, 60); break;
      case 'jump': this.tone(392, 0.15, 'square', 0.1, 620); break;
      case 'dash': this.tone(900, 0.18, 'sawtooth', 0.08, 300); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.7, 'triangle', 0.25, undefined, i * 0.14)); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.25, undefined, i * 0.2)); break;
      case 'spawn': this.tone(110, 0.6, 'sawtooth', 0.15, 70); break;
      case 'tick': this.tone(1000, 0.08, 'square', 0.12); break;
      case 'wind': this.tone(300, 1.6, 'sine', 0.08, 150); this.tone(450, 1.4, 'sine', 0.05, 220, 0.2); break;
      case 'charm': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.2, undefined, i * 0.06)); break;
      case 'steal': this.tone(700, 0.3, 'triangle', 0.2, 250); break;
    }
  }

  /** Nhạc nền đêm: chuỗi nốt ngũ cung chậm, lặp lại. */
  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    const notes = [220, 262, 294, 330, 392, 440, 392, 330];
    let i = 0;
    const tick = () => {
      const f = notes[i++ % notes.length];
      this.tone(f, 1.6, 'sine', 0.5, undefined, 0, this.musicGain);
      if (i % 4 === 0) this.tone(f / 2, 3, 'triangle', 0.35, undefined, 0, this.musicGain);
    };
    tick();
    this.musicTimer = window.setInterval(tick, 900);
  }

  stopMusic() {
    if (this.musicTimer !== null) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }
}
